import type {
  PoapActivity,
  PoapDependency,
  Workstream,
} from "@/types/domain";
import {
  addWorkingDays,
  parseLocalDate,
  toLocalDateString,
  workingDaysBetween,
} from "@/utils/dates";
import { addDays, differenceInCalendarDays } from "date-fns";

export type PackedActivity = {
  activity: PoapActivity;
  lane: number;
};

export type CriticalPathNode = {
  id: string;
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  totalFloat: number;
  critical: boolean;
};

export function packActivityLanes(
  activities: PoapActivity[],
): PackedActivity[] {
  const sorted = [...activities].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.endDate.localeCompare(b.endDate),
  );
  const laneEnds: string[] = [];
  return sorted.map((activity) => {
    let lane = laneEnds.findIndex((end) => end < activity.startDate);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(activity.endDate);
    } else {
      laneEnds[lane] = activity.endDate;
    }
    return { activity, lane };
  });
}

export function buildWorkstreamLayout(
  workstreams: Workstream[],
  activities: PoapActivity[],
  laneHeight = 34,
) {
  let cursor = 0;
  return [...workstreams]
    .sort((a, b) => a.order - b.order)
    .map((workstream) => {
      const packed = workstream.collapsed
        ? []
        : packActivityLanes(
            activities.filter(
              (activity) => activity.workstreamId === workstream.id,
            ),
          );
      const lanes = Math.max(
        1,
        packed.reduce((max, item) => Math.max(max, item.lane + 1), 0),
      );
      const height = workstream.collapsed ? laneHeight : lanes * laneHeight + 12;
      const row = { workstream, packed, y: cursor, height, lanes };
      cursor += height;
      return row;
    });
}

export function dateToPixel(
  date: string,
  projectStartDate: string,
  pixelsPerDay: number,
) {
  return (
    differenceInCalendarDays(
      parseLocalDate(date),
      parseLocalDate(projectStartDate),
    ) * pixelsPerDay
  );
}

export function pixelToDate(
  pixel: number,
  projectStartDate: string,
  pixelsPerDay: number,
) {
  return toLocalDateString(
    addDays(
      parseLocalDate(projectStartDate),
      Math.round(pixel / pixelsPerDay),
    ),
  );
}

export function hasDependencyCycle(
  activities: PoapActivity[],
  dependencies: PoapDependency[],
) {
  const adjacency = new Map<string, string[]>(
    activities.map((activity) => [activity.id, []]),
  );
  dependencies.forEach((dependency) =>
    adjacency
      .get(dependency.predecessorId)
      ?.push(dependency.successorId),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return activities.some((activity) => visit(activity.id));
}

export function canAddDependency(
  activities: PoapActivity[],
  dependencies: PoapDependency[],
  candidate: PoapDependency,
) {
  if (candidate.predecessorId === candidate.successorId) return false;
  if (
    dependencies.some(
      (dependency) =>
        dependency.predecessorId === candidate.predecessorId &&
        dependency.successorId === candidate.successorId,
    )
  )
    return false;
  return !hasDependencyCycle(activities, [...dependencies, candidate]);
}

function relationOffset(
  dependency: PoapDependency,
  predecessorDuration: number,
  successorDuration: number,
) {
  const lag = dependency.lagWorkingDays;
  if (dependency.type === "FS") return predecessorDuration + lag;
  if (dependency.type === "SS") return lag;
  if (dependency.type === "FF")
    return predecessorDuration + lag - successorDuration;
  return lag - successorDuration;
}

export function calculateCriticalPath(
  activities: PoapActivity[],
  dependencies: PoapDependency[],
): CriticalPathNode[] {
  if (!activities.length || hasDependencyCycle(activities, dependencies))
    return [];
  const activityMap = new Map(activities.map((activity) => [activity.id, activity]));
  const incoming = new Map(activities.map((activity) => [activity.id, 0]));
  const outgoing = new Map<string, PoapDependency[]>(
    activities.map((activity) => [activity.id, []]),
  );
  dependencies.forEach((dependency) => {
    incoming.set(
      dependency.successorId,
      (incoming.get(dependency.successorId) ?? 0) + 1,
    );
    outgoing.get(dependency.predecessorId)?.push(dependency);
  });
  const queue = activities
    .filter((activity) => incoming.get(activity.id) === 0)
    .map((activity) => activity.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependency of outgoing.get(id) ?? []) {
      const next = (incoming.get(dependency.successorId) ?? 0) - 1;
      incoming.set(dependency.successorId, next);
      if (next === 0) queue.push(dependency.successorId);
    }
  }
  const earlyStart = new Map(activities.map((activity) => [activity.id, 0]));
  for (const id of order) {
    const predecessor = activityMap.get(id)!;
    for (const dependency of outgoing.get(id) ?? []) {
      const successor = activityMap.get(dependency.successorId)!;
      const candidate =
        (earlyStart.get(id) ?? 0) +
        relationOffset(
          dependency,
          Math.max(0, predecessor.durationWorkingDays),
          Math.max(0, successor.durationWorkingDays),
        );
      earlyStart.set(
        successor.id,
        Math.max(earlyStart.get(successor.id) ?? 0, candidate),
      );
    }
  }
  const projectFinish = Math.max(
    ...activities.map(
      (activity) =>
        (earlyStart.get(activity.id) ?? 0) + activity.durationWorkingDays,
    ),
  );
  const lateStart = new Map(
    activities.map((activity) => [
      activity.id,
      projectFinish - activity.durationWorkingDays,
    ]),
  );
  for (const id of [...order].reverse()) {
    const predecessor = activityMap.get(id)!;
    for (const dependency of outgoing.get(id) ?? []) {
      const successor = activityMap.get(dependency.successorId)!;
      const candidate =
        (lateStart.get(successor.id) ?? 0) -
        relationOffset(
          dependency,
          Math.max(0, predecessor.durationWorkingDays),
          Math.max(0, successor.durationWorkingDays),
        );
      lateStart.set(id, Math.min(lateStart.get(id) ?? candidate, candidate));
    }
  }
  return activities.map((activity) => {
    const es = earlyStart.get(activity.id) ?? 0;
    const ls = lateStart.get(activity.id) ?? es;
    const totalFloat = Math.max(0, ls - es);
    return {
      id: activity.id,
      earlyStart: es,
      earlyFinish: es + activity.durationWorkingDays,
      lateStart: ls,
      lateFinish: ls + activity.durationWorkingDays,
      totalFloat,
      critical: totalFloat < 0.0001,
    };
  });
}

export function rescheduleSuccessors(
  activities: PoapActivity[],
  dependencies: PoapDependency[],
  changedActivityId: string,
) {
  const result = activities.map((activity) => ({ ...activity }));
  const activityMap = new Map(result.map((activity) => [activity.id, activity]));
  const queue = [changedActivityId];
  const processed = new Set<string>();
  while (queue.length) {
    const predecessorId = queue.shift()!;
    if (processed.has(predecessorId)) continue;
    processed.add(predecessorId);
    const predecessor = activityMap.get(predecessorId);
    if (!predecessor) continue;
    for (const dependency of dependencies.filter(
      (item) => item.predecessorId === predecessorId,
    )) {
      const successor = activityMap.get(dependency.successorId);
      if (!successor) continue;
      if (dependency.type === "FS") {
        const proposedStart = addWorkingDays(
          predecessor.endDate,
          Math.max(1, dependency.lagWorkingDays + 1),
        );
        if (proposedStart > successor.startDate) {
          successor.startDate = proposedStart;
          successor.endDate = addWorkingDays(
            proposedStart,
            Math.max(0, successor.durationWorkingDays - 1),
          );
          successor.updatedAt = new Date().toISOString();
        }
      }
      queue.push(successor.id);
    }
  }
  return result;
}

export function createDefaultActivity(input: {
  projectId: string;
  workstreamId: string;
  startDate: string;
  mode: "WEEK" | "MONTH";
  userId: string;
}): PoapActivity {
  const now = new Date().toISOString();
  const duration = input.mode === "WEEK" ? 5 : 22;
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    workstreamId: input.workstreamId,
    name: "New activity",
    startDate: input.startDate,
    endDate: addWorkingDays(input.startDate, duration - 1),
    durationWorkingDays: duration,
    colour: "#2874d0",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    weight: 1,
    isMilestone: false,
    useManualProgress: false,
    createdBy: input.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export function recalculateDuration(activity: PoapActivity) {
  return {
    ...activity,
    durationWorkingDays: activity.isMilestone
      ? 0
      : workingDaysBetween(activity.startDate, activity.endDate),
  };
}

