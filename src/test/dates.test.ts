import { describe, expect, it } from "vitest";
import {
  currentProjectWeek,
  isMonday,
  splitWeekAcrossMonths,
  weekFromDate,
  workingDaysBetween,
} from "@/utils/dates";

describe("project calendar calculations", () => {
  it("validates Monday without UTC conversion", () => {
    expect(isMonday("2026-04-13")).toBe(true);
    expect(isMonday("2026-04-14")).toBe(false);
  });

  it("derives and clamps the current project week", () => {
    expect(weekFromDate("2026-04-13", "2026-04-13")).toBe(1);
    expect(currentProjectWeek("2026-04-27", "2026-04-13", 30)).toBe(3);
    expect(currentProjectWeek("2025-01-01", "2026-04-13", 30)).toBe(1);
    expect(currentProjectWeek("2028-01-01", "2026-04-13", 30)).toBe(30);
  });

  it("counts working days inclusively", () => {
    expect(workingDaysBetween("2026-07-24", "2026-07-27")).toBe(2);
    expect(workingDaysBetween("2026-07-27", "2026-07-31")).toBe(5);
  });

  it("splits a boundary week across calendar months", () => {
    const split = splitWeekAcrossMonths("2026-06-01", 5, 5);
    expect(split["Jun 2026"]).toBe(2);
    expect(split["Jul 2026"]).toBe(3);
    expect(Object.values(split).reduce((total, value) => total + value, 0)).toBe(5);
  });
});
