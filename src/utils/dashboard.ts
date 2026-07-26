import type {
  ActualEntry,
  ForecastLine,
  PoapActivity,
  ProjectSettings,
} from "@/types/domain";
import {
  clampPercent,
  currentProjectWeek,
  parseLocalDate,
  workingDaysBetween,
} from "@/utils/dates";

export type DashboardMetrics = {
  bac: number;
  ac: number;
  ev: number;
  etc: number;
  eac: number;
  vac: number;
  forecastDaysTotal: number;
  forecastDaysToDate: number;
  actualDaysToDate: number;
  actualVsForecastVariance: number;
  currentWeekForecast: number;
  currentWeekActual: number;
  effectivePercentComplete: number;
  currentWeek: number;
};

export function activityProgress(activity: PoapActivity, today: string): number {
  if (activity.useManualProgress && activity.manualProgress !== undefined) {
    return clampPercent(activity.manualProgress);
  }
  if (activity.status === "COMPLETE") return 100;
  if (today < activity.startDate) return 0;
  if (today > activity.endDate || activity.isMilestone) return 100;
  const total = Math.max(
    1,
    workingDaysBetween(activity.startDate, activity.endDate),
  );
  const elapsed = workingDaysBetween(activity.startDate, today);
  return clampPercent((elapsed / total) * 100);
}

export function poapPercentComplete(
  activities: PoapActivity[],
  today: string,
): number {
  const weighted = activities.filter(
    (activity) => activity.weight > 0 && !activity.isMilestone,
  );
  const totalWeight = weighted.reduce(
    (total, activity) => total + activity.weight,
    0,
  );
  if (!totalWeight) return 0;
  return (
    weighted.reduce(
      (total, activity) =>
        total + activityProgress(activity, today) * activity.weight,
      0,
    ) / totalWeight
  );
}

function forecastRateMap(lines: ForecastLine[]) {
  return new Map(lines.map((line) => [line.id, line.dayRate]));
}

export function calculateDashboardMetrics(input: {
  settings: ProjectSettings;
  forecastLines: ForecastLine[];
  actualEntries: ActualEntry[];
  activities: PoapActivity[];
  today: string;
}): DashboardMetrics {
  const { settings, forecastLines, actualEntries, activities, today } = input;
  const currentWeek = currentProjectWeek(
    today,
    settings.projectStartDate,
    settings.numberOfWeeks,
  );
  const rates = forecastRateMap(forecastLines);
  const forecastDaysTotal = forecastLines.reduce(
    (total, line) =>
      total +
      Object.values(line.weeks).reduce((lineTotal, days) => lineTotal + days, 0),
    0,
  );
  const forecastDaysToDate = forecastLines.reduce(
    (total, line) =>
      total +
      Object.entries(line.weeks).reduce((lineTotal, [week, days]) => {
        return lineTotal + (Number(week.replace(/\D/g, "")) <= currentWeek ? days : 0);
      }, 0),
    0,
  );
  const actualToDate = actualEntries.filter(
    (entry) => entry.week <= currentWeek,
  );
  const actualDaysToDate = actualToDate.reduce(
    (total, entry) => total + entry.days,
    0,
  );
  const bac = forecastLines.reduce(
    (total, line) =>
      total +
      Object.values(line.weeks).reduce(
        (lineTotal, days) => lineTotal + days * line.dayRate,
        0,
      ),
    0,
  );
  const ac = actualToDate.reduce(
    (total, entry) => total + entry.days * (rates.get(entry.resourceId) ?? 0),
    0,
  );
  const effectivePercentComplete =
    settings.progressSource === "MANUAL"
      ? clampPercent(settings.manualPercentComplete)
      : poapPercentComplete(activities, today);
  const ev = bac * (effectivePercentComplete / 100);
  const etc = bac - ev;
  const eac = ac + etc;
  const currentWeekForecast = forecastLines.reduce(
    (total, line) => total + (line.weeks[`W${currentWeek}`] ?? 0),
    0,
  );
  const currentWeekActual = actualEntries
    .filter((entry) => entry.week === currentWeek)
    .reduce((total, entry) => total + entry.days, 0);

  return {
    bac,
    ac,
    ev,
    etc,
    eac,
    vac: bac - eac,
    forecastDaysTotal,
    forecastDaysToDate,
    actualDaysToDate,
    actualVsForecastVariance: actualDaysToDate - forecastDaysToDate,
    currentWeekForecast,
    currentWeekActual,
    effectivePercentComplete,
    currentWeek,
  };
}

export function todayDateString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isLate(activity: PoapActivity, today: string) {
  return (
    parseLocalDate(activity.endDate) < parseLocalDate(today) &&
    activityProgress(activity, today) < 100
  );
}

