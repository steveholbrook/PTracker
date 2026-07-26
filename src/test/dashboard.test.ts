import { describe, expect, it } from "vitest";
import type {
  ActualEntry,
  ForecastLine,
  PoapActivity,
  ProjectSettings,
} from "@/types/domain";
import {
  activityProgress,
  calculateDashboardMetrics,
} from "@/utils/dashboard";

const settings: ProjectSettings = {
  projectStartDate: "2026-07-06",
  numberOfWeeks: 4,
  progressSource: "MANUAL",
  manualPercentComplete: 50,
  displayPrecision: "STANDARD",
  holidays: [],
  customerSafeMode: false,
  invoicePattern: "AR_CODE_SEQ",
};

const forecast: ForecastLine[] = [
  {
    id: "f1",
    baselineId: "b1",
    stream: "Delivery",
    role: "Consultant",
    code: "CG01",
    name: "A",
    location: "ANZ",
    dayRate: 1000,
    contractEffortDays: 20,
    contractTotal: 20000,
    plannedStartDate: "2026-07-06",
    plannedEndDate: "2026-07-31",
    weeks: { W1: 5, W2: 5, W3: 5, W4: 5 },
  },
];

const actuals: ActualEntry[] = [
  {
    id: "a1",
    resourceId: "f1",
    code: "CG01",
    week: 1,
    days: 4,
    source: "MANUAL",
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
  {
    id: "a2",
    resourceId: "f1",
    code: "CG01",
    week: 2,
    days: 5,
    source: "MANUAL",
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
];

describe("dashboard formulas", () => {
  it("calculates BAC, AC, EV, ETC, EAC and VAC", () => {
    const metrics = calculateDashboardMetrics({
      settings,
      forecastLines: forecast,
      actualEntries: actuals,
      activities: [],
      today: "2026-07-13",
    });
    expect(metrics.bac).toBe(20000);
    expect(metrics.ac).toBe(9000);
    expect(metrics.ev).toBe(10000);
    expect(metrics.etc).toBe(10000);
    expect(metrics.eac).toBe(19000);
    expect(metrics.vac).toBe(1000);
    expect(metrics.forecastDaysToDate).toBe(10);
    expect(metrics.actualDaysToDate).toBe(9);
  });

  it("calculates automatic activity progress", () => {
    const activity = {
      id: "a",
      projectId: "p",
      workstreamId: "w",
      name: "Build",
      startDate: "2026-07-20",
      endDate: "2026-07-24",
      durationWorkingDays: 5,
      colour: "#000",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      weight: 1,
      isMilestone: false,
      useManualProgress: false,
      createdBy: "u",
      createdAt: "",
      updatedAt: "",
    } satisfies PoapActivity;
    expect(activityProgress(activity, "2026-07-19")).toBe(0);
    expect(activityProgress(activity, "2026-07-22")).toBe(60);
    expect(activityProgress(activity, "2026-07-25")).toBe(100);
  });
});

