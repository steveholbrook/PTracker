"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays } from "date-fns";
import {
  Baseline,
  CircleDot,
  Copy,
  Link2,
  Milestone,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Input, Label, Select, Textarea } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { useProject } from "@/hooks/use-project";
import { GanttCanvas } from "@/modules/poap/gantt-canvas";
import { useAppStore } from "@/state/app-store";
import type {
  ActivityPriority,
  ActivityStatus,
  DependencyType,
  PoapActivity,
  PoapDependency,
  Workstream,
} from "@/types/domain";
import { isLate, todayDateString } from "@/utils/dashboard";
import {
  parseLocalDate,
  toLocalDateString,
  workingDaysBetween,
} from "@/utils/dates";
import { can } from "@/utils/permissions";
import {
  calculateCriticalPath,
  canAddDependency,
  createDefaultActivity,
  rescheduleSuccessors,
} from "@/utils/poap";

type ViewPreset =
  | "ALL"
  | "EXECUTIVE"
  | "CUSTOMER"
  | "CRITICAL"
  | "LATE"
  | "CURRENT_MONTH";

export function PoapPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { project, workspace, role } = useProject(projectId);
  const addWorkstream = useAppStore((state) => state.addWorkstream);
  const updateWorkstream = useAppStore((state) => state.updateWorkstream);
  const deleteWorkstream = useAppStore((state) => state.deleteWorkstream);
  const upsertActivity = useAppStore((state) => state.upsertActivity);
  const setActivities = useAppStore((state) => state.setActivities);
  const deleteActivity = useAppStore((state) => state.deleteActivity);
  const addDependency = useAppStore((state) => state.addDependency);
  const deleteDependency = useAppStore((state) => state.deleteDependency);
  const addPoapBaseline = useAppStore((state) => state.addPoapBaseline);
  const editable = can(role, "EDIT_POAP");
  const today = todayDateString();
  const [mode, setMode] = useState<"WEEK" | "MONTH">("WEEK");
  const [showCritical, setShowCritical] = useState(true);
  const [autoReschedule, setAutoReschedule] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showWorkstreamForm, setShowWorkstreamForm] = useState(false);
  const [workstreamName, setWorkstreamName] = useState("");
  const [view, setView] = useState<ViewPreset>("ALL");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyType, setDependencyType] =
    useState<DependencyType>("FS");
  const [past, setPast] = useState<PoapActivity[][]>([]);
  const [future, setFuture] = useState<PoapActivity[][]>([]);
  const selectedActivity = workspace.activities.find((activity) =>
    selectedIds.has(activity.id),
  );
  const criticalNodes = useMemo(
    () => calculateCriticalPath(workspace.activities, workspace.dependencies),
    [workspace.activities, workspace.dependencies],
  );
  const criticalIds = useMemo(
    () =>
      showCritical
        ? new Set(
            criticalNodes
              .filter((node) => node.critical)
              .map((node) => node.id),
          )
        : new Set<string>(),
    [criticalNodes, showCritical],
  );
  const owners = [...new Set(workspace.activities.map((activity) => activity.owner).filter(Boolean))];
  const activeBaseline = workspace.poapBaselines.find(
    (baseline) => baseline.active,
  );
  const filteredActivities = workspace.activities.filter((activity) => {
    if (ownerFilter && activity.owner !== ownerFilter) return false;
    if (statusFilter && activity.status !== statusFilter) return false;
    if (priorityFilter && activity.priority !== priorityFilter) return false;
    if (view === "EXECUTIVE" && activity.priority === "LOW") return false;
    if (view === "CUSTOMER" && activity.status === "ON_HOLD") return false;
    if (view === "CRITICAL" && !criticalIds.has(activity.id)) return false;
    if (view === "LATE" && !isLate(activity, today)) return false;
    if (
      view === "CURRENT_MONTH" &&
      activity.startDate.slice(0, 7) !== today.slice(0, 7) &&
      activity.endDate.slice(0, 7) !== today.slice(0, 7)
    )
      return false;
    return true;
  });

  function commitActivities(next: PoapActivity[]) {
    setPast((history) => [...history.slice(-49), workspace.activities]);
    setFuture([]);
    setActivities(projectId, next);
  }

  function commitActivity(
    activity: PoapActivity,
    targetWorkstreamId?: string,
  ) {
    const changed = {
      ...activity,
      workstreamId: targetWorkstreamId ?? activity.workstreamId,
    };
    let next = workspace.activities.map((item) =>
      item.id === changed.id ? changed : item,
    );
    if (autoReschedule) {
      next = rescheduleSuccessors(
        next,
        workspace.dependencies,
        changed.id,
      );
    }
    commitActivities(next);
  }

  function createActivity(startDate?: string, workstreamId?: string) {
    const target =
      workstreamId ??
      selectedActivity?.workstreamId ??
      workspace.workstreams[0]?.id;
    if (!target) {
      toast.error("Add a workstream before creating an activity");
      return;
    }
    const horizonStart = workspace.settings.projectStartDate;
    const horizonEnd = toLocalDateString(
      addDays(
        parseLocalDate(horizonStart),
        workspace.settings.numberOfWeeks * 7 - 1,
      ),
    );
    const proposed =
      startDate ??
      (today < horizonStart
        ? horizonStart
        : today > horizonEnd
          ? horizonEnd
          : today);
    const activity = createDefaultActivity({
      projectId,
      workstreamId: target,
      startDate: proposed,
      mode,
      userId: user?.uid ?? "",
    });
    setPast((history) => [...history.slice(-49), workspace.activities]);
    upsertActivity(projectId, activity);
    setSelectedIds(new Set([activity.id]));
  }

  function createWorkstream(event: React.FormEvent) {
    event.preventDefault();
    if (!workstreamName.trim()) return;
    const workstream: Workstream = {
      id: crypto.randomUUID(),
      name: workstreamName.trim(),
      colour: "#2874d0",
      owner: "",
      description: "",
      order: workspace.workstreams.length,
      collapsed: false,
    };
    addWorkstream(projectId, workstream);
    setWorkstreamName("");
    setShowWorkstreamForm(false);
    toast.success(`${workstream.name} added to the POAP`);
  }

  function removeSelected() {
    if (!selectedIds.size) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.size} selected activit${selectedIds.size === 1 ? "y" : "ies"} and related dependencies?`,
      )
    )
      return;
    setPast((history) => [...history.slice(-49), workspace.activities]);
    selectedIds.forEach((id) => deleteActivity(projectId, id));
    setSelectedIds(new Set());
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [workspace.activities, ...items]);
    setPast((items) => items.slice(0, -1));
    setActivities(projectId, previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, workspace.activities]);
    setFuture((items) => items.slice(1));
    setActivities(projectId, next);
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      ) {
        removeSelected();
      }
      if (event.key === "Escape") setSelectedIds(new Set());
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  function addNewDependency() {
    if (!selectedActivity || !dependencyTarget) return;
    const candidate: PoapDependency = {
      id: crypto.randomUUID(),
      predecessorId: selectedActivity.id,
      successorId: dependencyTarget,
      type: dependencyType,
      lagWorkingDays: 0,
    };
    if (
      !canAddDependency(
        workspace.activities,
        workspace.dependencies,
        candidate,
      )
    ) {
      toast.error("That dependency is duplicate, self-referencing or circular");
      return;
    }
    addDependency(projectId, candidate);
    setDependencyTarget("");
    toast.success("Dependency added");
  }

  function createBaseline() {
    const name = window.prompt(
      "Baseline name",
      `POAP Baseline ${workspace.poapBaselines.length + 1}`,
    );
    if (!name?.trim()) return;
    addPoapBaseline(projectId, {
      id: crypto.randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.uid ?? "",
      approvalStatus: "APPROVED",
      active: true,
      activities: workspace.activities.map(
        ({ id, name: activityName, startDate, endDate }) => ({
          id,
          name: activityName,
          startDate,
          endDate,
        }),
      ),
    });
    toast.success("Baseline captured and displayed as ghost bars");
  }

  function duplicateSelected() {
    if (!selectedActivity) return;
    const clone: PoapActivity = {
      ...selectedActivity,
      id: crypto.randomUUID(),
      name: `${selectedActivity.name} (copy)`,
      startDate: toLocalDateString(
        addDays(parseLocalDate(selectedActivity.startDate), 7),
      ),
      endDate: toLocalDateString(
        addDays(parseLocalDate(selectedActivity.endDate), 7),
      ),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPast((history) => [...history.slice(-49), workspace.activities]);
    upsertActivity(projectId, clone);
    setSelectedIds(new Set([clone.id]));
  }

  function splitSelected() {
    if (!selectedActivity || selectedActivity.isMilestone) return;
    const calendarDays = differenceInCalendarDays(
      parseLocalDate(selectedActivity.endDate),
      parseLocalDate(selectedActivity.startDate),
    );
    if (calendarDays < 2) {
      toast.error("The activity is too short to split");
      return;
    }
    const splitDate = addDays(
      parseLocalDate(selectedActivity.startDate),
      Math.floor(calendarDays / 2),
    );
    const first: PoapActivity = {
      ...selectedActivity,
      endDate: toLocalDateString(splitDate),
      durationWorkingDays: workingDaysBetween(
        selectedActivity.startDate,
        toLocalDateString(splitDate),
      ),
      weight: selectedActivity.weight / 2,
      updatedAt: new Date().toISOString(),
    };
    const secondStart = toLocalDateString(addDays(splitDate, 1));
    const second: PoapActivity = {
      ...selectedActivity,
      id: crypto.randomUUID(),
      name: `${selectedActivity.name} · Part 2`,
      startDate: secondStart,
      durationWorkingDays: workingDaysBetween(
        secondStart,
        selectedActivity.endDate,
      ),
      weight: selectedActivity.weight / 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    commitActivities([
      ...workspace.activities.filter(
        (activity) => activity.id !== selectedActivity.id,
      ),
      first,
      second,
    ]);
    setSelectedIds(new Set([second.id]));
  }

  function convertToMilestone() {
    if (!selectedActivity) return;
    commitActivity({
      ...selectedActivity,
      endDate: selectedActivity.startDate,
      durationWorkingDays: 0,
      isMilestone: true,
      weight: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  function bulkUpdate(update: Partial<PoapActivity>) {
    if (!selectedIds.size) return;
    commitActivities(
      workspace.activities.map((activity) =>
        selectedIds.has(activity.id)
          ? { ...activity, ...update, updatedAt: new Date().toISOString() }
          : activity,
      ),
    );
  }

  function reorderWorkstream(sourceId: string, targetId: string) {
    const ordered = [...workspace.workstreams].sort((a, b) => a.order - b.order);
    const sourceIndex = ordered.findIndex((item) => item.id === sourceId);
    const targetIndex = ordered.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    ordered.forEach((workstream, index) =>
      updateWorkstream(projectId, workstream.id, { order: index }),
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={project?.code}
        title="POAP delivery plan"
        description="An SVG planning engine with lane packing, dependencies, critical path, baselines, multi-select and command-based undo."
        actions={
          <>
            <Button variant="outline" onClick={undo} disabled={!past.length}>
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button variant="outline" onClick={redo} disabled={!future.length}>
              <Redo2 className="h-4 w-4" />
              Redo
            </Button>
            {editable ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowWorkstreamForm((value) => !value)}
                >
                  <Plus className="h-4 w-4" />
                  Workstream
                </Button>
                <Button variant="accent" onClick={() => createActivity()}>
                  <Plus className="h-4 w-4" />
                  Activity
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {showWorkstreamForm ? (
        <Card className="mb-4 border-[#b9dfe3]">
          <CardContent>
            <form
              onSubmit={createWorkstream}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Label htmlFor="workstream-name">Workstream name</Label>
                <Input
                  id="workstream-name"
                  autoFocus
                  value={workstreamName}
                  onChange={(event) => setWorkstreamName(event.target.value)}
                  placeholder="e.g. Change and Training"
                  required
                />
              </div>
              <Button type="submit">Add workstream</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowWorkstreamForm(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <Label htmlFor="timeline-mode">Timeline</Label>
            <Select
              id="timeline-mode"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "WEEK" | "MONTH")
              }
            >
              <option value="WEEK">Week</option>
              <option value="MONTH">Month</option>
            </Select>
          </div>
          <div className="w-40">
            <Label htmlFor="saved-view">Saved View</Label>
            <Select
              id="saved-view"
              value={view}
              onChange={(event) => setView(event.target.value as ViewPreset)}
            >
              <option value="ALL">All Activities</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="CUSTOMER">Customer</option>
              <option value="CRITICAL">Critical Path</option>
              <option value="LATE">Late Activities</option>
              <option value="CURRENT_MONTH">Current Month</option>
            </Select>
          </div>
          <div className="w-40">
            <Label htmlFor="owner-filter">Owner</Label>
            <Select
              id="owner-filter"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
            >
              <option value="">All owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETE">Complete</option>
              <option value="ON_HOLD">On hold</option>
            </Select>
          </div>
          <div className="w-36">
            <Label htmlFor="priority-filter">Priority</Label>
            <Select
              id="priority-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
            >
              <option value="">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </div>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#d6dfe8] px-3 text-xs font-semibold text-[#526177]">
            <input
              type="checkbox"
              checked={showCritical}
              onChange={(event) => setShowCritical(event.target.checked)}
              className="accent-[#c43d4f]"
            />
            Critical Path
          </label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#d6dfe8] px-3 text-xs font-semibold text-[#526177]">
            <input
              type="checkbox"
              checked={autoReschedule}
              onChange={(event) => setAutoReschedule(event.target.checked)}
              className="accent-[#0e91a1]"
            />
            Auto-reschedule
          </label>
          {editable ? (
            <Button variant="outline" onClick={createBaseline}>
              <Baseline className="h-4 w-4" />
              Capture baseline
            </Button>
          ) : null}
          {activeBaseline ? (
            <Badge tone="blue">Baseline: {activeBaseline.name}</Badge>
          ) : null}
        </CardContent>
      </Card>

      {selectedIds.size > 1 ? (
        <Card className="mb-4 border-[#c5ddea] bg-[#f6fbfd]">
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge tone="blue">{selectedIds.size} selected</Badge>
            <Select
              aria-label="Bulk status"
              className="w-40"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value)
                  bulkUpdate({
                    status: event.target.value as ActivityStatus,
                  });
                event.target.value = "";
              }}
            >
              <option value="">Bulk status…</option>
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETE">Complete</option>
              <option value="ON_HOLD">On hold</option>
            </Select>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#526177]">
              Bulk colour
              <input
                type="color"
                className="h-9 w-12 rounded border border-[#d6dfe8] bg-white p-1"
                onChange={(event) => bulkUpdate({ colour: event.target.value })}
              />
            </label>
            <Button variant="danger" size="sm" onClick={removeSelected}>
              <Trash2 className="h-4 w-4" />
              Delete selection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {workspace.workstreams.length ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <GanttCanvas
            projectStartDate={workspace.settings.projectStartDate}
            numberOfWeeks={workspace.settings.numberOfWeeks}
            mode={mode}
            workstreams={workspace.workstreams}
            activities={filteredActivities}
            dependencies={workspace.dependencies}
            baseline={activeBaseline}
            criticalIds={criticalIds}
            selectedIds={selectedIds}
            editable={editable}
            onSelect={(id, multi) =>
              setSelectedIds((current) => {
                if (!multi) return new Set([id]);
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onActivityChange={commitActivity}
            onCanvasDoubleClick={(date, workstreamId) =>
              createActivity(date, workstreamId)
            }
            onToggleWorkstream={(workstreamId) => {
              const workstream = workspace.workstreams.find(
                (item) => item.id === workstreamId,
              );
              if (workstream)
                updateWorkstream(projectId, workstreamId, {
                  collapsed: !workstream.collapsed,
                });
            }}
            onReorderWorkstream={reorderWorkstream}
          />

          <Card className="h-max xl:sticky xl:top-24">
            <CardHeader>
              <div>
                <h2 className="text-sm font-bold">Activity details</h2>
                <p className="mt-1 text-xs text-[#758397]">
                  {selectedActivity
                    ? "Changes save on field exit"
                    : "Select an activity on the canvas"}
                </p>
              </div>
              {selectedActivity ? (
                <Badge
                  tone={
                    selectedActivity.status === "COMPLETE"
                      ? "success"
                      : isLate(selectedActivity, today)
                        ? "danger"
                        : "blue"
                  }
                >
                  {selectedActivity.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent>
              {selectedActivity ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="activity-name">Name</Label>
                    <Input
                      key={`${selectedActivity.id}-name`}
                      id="activity-name"
                      defaultValue={selectedActivity.name}
                      disabled={!editable}
                      onBlur={(event) =>
                        commitActivity({
                          ...selectedActivity,
                          name: event.target.value.trim() || selectedActivity.name,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="activity-description">Description</Label>
                    <Textarea
                      key={`${selectedActivity.id}-description`}
                      id="activity-description"
                      defaultValue={selectedActivity.description}
                      disabled={!editable}
                      onBlur={(event) =>
                        commitActivity({
                          ...selectedActivity,
                          description: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="activity-owner">Owner</Label>
                    <Input
                      key={`${selectedActivity.id}-owner`}
                      id="activity-owner"
                      defaultValue={selectedActivity.owner}
                      disabled={!editable}
                      onBlur={(event) =>
                        commitActivity({
                          ...selectedActivity,
                          owner: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="activity-start">Start</Label>
                      <Input
                        id="activity-start"
                        type="date"
                        value={selectedActivity.startDate}
                        disabled={!editable}
                        onChange={(event) => {
                          if (event.target.value <= selectedActivity.endDate)
                            commitActivity({
                              ...selectedActivity,
                              startDate: event.target.value,
                              durationWorkingDays: workingDaysBetween(
                                event.target.value,
                                selectedActivity.endDate,
                              ),
                            });
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="activity-end">End</Label>
                      <Input
                        id="activity-end"
                        type="date"
                        value={selectedActivity.endDate}
                        disabled={!editable}
                        onChange={(event) => {
                          if (event.target.value >= selectedActivity.startDate)
                            commitActivity({
                              ...selectedActivity,
                              endDate: event.target.value,
                              durationWorkingDays: workingDaysBetween(
                                selectedActivity.startDate,
                                event.target.value,
                              ),
                            });
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="activity-status">Status</Label>
                      <Select
                        id="activity-status"
                        value={selectedActivity.status}
                        disabled={!editable}
                        onChange={(event) =>
                          commitActivity({
                            ...selectedActivity,
                            status: event.target.value as ActivityStatus,
                          })
                        }
                      >
                        <option value="NOT_STARTED">Not started</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="COMPLETE">Complete</option>
                        <option value="ON_HOLD">On hold</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="activity-priority">Priority</Label>
                      <Select
                        id="activity-priority"
                        value={selectedActivity.priority}
                        disabled={!editable}
                        onChange={(event) =>
                          commitActivity({
                            ...selectedActivity,
                            priority: event.target.value as ActivityPriority,
                          })
                        }
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <div>
                      <Label htmlFor="activity-workstream">Workstream</Label>
                      <Select
                        id="activity-workstream"
                        value={selectedActivity.workstreamId}
                        disabled={!editable}
                        onChange={(event) =>
                          commitActivity(
                            selectedActivity,
                            event.target.value,
                          )
                        }
                      >
                        {workspace.workstreams.map((workstream) => (
                          <option key={workstream.id} value={workstream.id}>
                            {workstream.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="activity-colour">Colour</Label>
                      <input
                        id="activity-colour"
                        type="color"
                        value={selectedActivity.colour}
                        disabled={!editable}
                        onChange={(event) =>
                          commitActivity({
                            ...selectedActivity,
                            colour: event.target.value,
                          })
                        }
                        className="h-10 w-full rounded-lg border border-[#cbd6e2] bg-white p-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="activity-weight">Completion Weight</Label>
                    <Input
                      id="activity-weight"
                      type="number"
                      min={0}
                      step={0.1}
                      value={selectedActivity.weight}
                      disabled={!editable}
                      onChange={(event) =>
                        commitActivity({
                          ...selectedActivity,
                          weight: Number(event.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="border-t border-[#e1e7ee] pt-4">
                    <Label>Dependencies</Label>
                    <div className="flex gap-2">
                      <Select
                        aria-label="Dependency type"
                        className="w-20"
                        value={dependencyType}
                        disabled={!editable}
                        onChange={(event) =>
                          setDependencyType(
                            event.target.value as DependencyType,
                          )
                        }
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="FF">FF</option>
                        <option value="SF">SF</option>
                      </Select>
                      <Select
                        aria-label="Successor activity"
                        className="min-w-0 flex-1"
                        value={dependencyTarget}
                        disabled={!editable}
                        onChange={(event) =>
                          setDependencyTarget(event.target.value)
                        }
                      >
                        <option value="">Add successor…</option>
                        {workspace.activities
                          .filter(
                            (activity) =>
                              activity.id !== selectedActivity.id,
                          )
                          .map((activity) => (
                            <option key={activity.id} value={activity.id}>
                              {activity.name}
                            </option>
                          ))}
                      </Select>
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={!editable || !dependencyTarget}
                        onClick={addNewDependency}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {workspace.dependencies
                        .filter(
                          (dependency) =>
                            dependency.predecessorId === selectedActivity.id ||
                            dependency.successorId === selectedActivity.id,
                        )
                        .map((dependency) => {
                          const predecessor = workspace.activities.find(
                            (activity) =>
                              activity.id === dependency.predecessorId,
                          );
                          const successor = workspace.activities.find(
                            (activity) =>
                              activity.id === dependency.successorId,
                          );
                          return (
                            <div
                              key={dependency.id}
                              className="flex items-center gap-2 rounded-lg bg-[#f3f6f9] px-2 py-1.5 text-[10px] text-[#526177]"
                            >
                              <Workflow className="h-3 w-3 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {predecessor?.name} {dependency.type}{" "}
                                {successor?.name}
                              </span>
                              {editable ? (
                                <button
                                  onClick={() =>
                                    deleteDependency(
                                      projectId,
                                      dependency.id,
                                    )
                                  }
                                  className="text-[#c43d4f]"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {editable ? (
                    <div className="flex flex-wrap gap-2 border-t border-[#e1e7ee] pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={duplicateSelected}
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={splitSelected}
                        disabled={selectedActivity.isMilestone}
                      >
                        <Scissors className="h-4 w-4" />
                        Split
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={convertToMilestone}
                        disabled={selectedActivity.isMilestone}
                      >
                        <Milestone className="h-4 w-4" />
                        Milestone
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={removeSelected}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  icon={CircleDot}
                  title="Nothing selected"
                  description="Select an activity to edit details, add dependencies, duplicate, split or convert it to a milestone."
                />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={Workflow}
              title="Start with a workstream"
              description="Workstreams remain visible even when empty. Add one for each delivery stream, then double-click the canvas or use Add Activity."
              action={
                editable ? (
                  <Button
                    variant="accent"
                    onClick={() => setShowWorkstreamForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add first workstream
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader>
          <div>
            <h2 className="text-sm font-bold">Workstream controls</h2>
            <p className="mt-1 text-xs text-[#758397]">
              Drag workstream rows on the left of the canvas to reorder them.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[...workspace.workstreams]
            .sort((a, b) => a.order - b.order)
            .map((workstream) => (
              <div
                key={workstream.id}
                className="rounded-xl border border-[#e1e7ee] p-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={workstream.colour}
                    disabled={!editable}
                    onChange={(event) =>
                      updateWorkstream(projectId, workstream.id, {
                        colour: event.target.value,
                      })
                    }
                    className="h-8 w-8 rounded border-0 bg-transparent p-0"
                  />
                  <Input
                    key={`${workstream.id}-name`}
                    defaultValue={workstream.name}
                    disabled={!editable}
                    onBlur={(event) =>
                      updateWorkstream(projectId, workstream.id, {
                        name: event.target.value.trim() || workstream.name,
                      })
                    }
                  />
                  {editable ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${workstream.name} and every activity inside it?`,
                          )
                        )
                          deleteWorkstream(projectId, workstream.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-[#c43d4f]" />
                    </Button>
                  ) : null}
                </div>
                <div className="mt-2">
                  <Label>Owner</Label>
                  <Input
                    key={`${workstream.id}-owner`}
                    defaultValue={workstream.owner}
                    disabled={!editable}
                    onBlur={(event) =>
                      updateWorkstream(projectId, workstream.id, {
                        owner: event.target.value,
                      })
                    }
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </>
  );
}
