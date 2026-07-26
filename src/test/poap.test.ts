import { describe, expect, it } from "vitest";
import type { PoapActivity, PoapDependency } from "@/types/domain";
import {
  calculateCriticalPath,
  canAddDependency,
  dateToPixel,
  hasDependencyCycle,
  packActivityLanes,
  pixelToDate,
  rescheduleSuccessors,
} from "@/utils/poap";

function activity(
  id: string,
  startDate: string,
  endDate: string,
  durationWorkingDays = 5,
): PoapActivity {
  return {
    id,
    projectId: "p",
    workstreamId: "w",
    name: id,
    startDate,
    endDate,
    durationWorkingDays,
    colour: "#2874d0",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    weight: 1,
    isMilestone: false,
    useManualProgress: false,
    createdBy: "u",
    createdAt: "",
    updatedAt: "",
  };
}

describe("POAP layout and scheduling", () => {
  const activities = [
    activity("a", "2026-07-06", "2026-07-10"),
    activity("b", "2026-07-08", "2026-07-14"),
    activity("c", "2026-07-15", "2026-07-17"),
  ];

  it("packs overlaps into separate lanes and reuses free lanes", () => {
    const packed = packActivityLanes(activities);
    expect(packed.find((item) => item.activity.id === "a")?.lane).toBe(0);
    expect(packed.find((item) => item.activity.id === "b")?.lane).toBe(1);
    expect(packed.find((item) => item.activity.id === "c")?.lane).toBe(0);
  });

  it("round-trips timeline coordinates", () => {
    const pixel = dateToPixel("2026-07-20", "2026-07-06", 10);
    expect(pixel).toBe(140);
    expect(pixelToDate(pixel, "2026-07-06", 10)).toBe("2026-07-20");
  });

  it("prevents circular dependencies", () => {
    const dependencies: PoapDependency[] = [
      {
        id: "d1",
        predecessorId: "a",
        successorId: "b",
        type: "FS",
        lagWorkingDays: 0,
      },
      {
        id: "d2",
        predecessorId: "b",
        successorId: "c",
        type: "FS",
        lagWorkingDays: 0,
      },
    ];
    expect(hasDependencyCycle(activities, dependencies)).toBe(false);
    expect(
      canAddDependency(activities, dependencies, {
        id: "d3",
        predecessorId: "c",
        successorId: "a",
        type: "FS",
        lagWorkingDays: 0,
      }),
    ).toBe(false);
  });

  it("calculates a critical path", () => {
    const chain = [
      activity("a", "2026-07-06", "2026-07-10", 5),
      activity("b", "2026-07-13", "2026-07-17", 5),
      activity("c", "2026-07-20", "2026-07-24", 5),
    ];
    const dependencies: PoapDependency[] = [
      { id: "1", predecessorId: "a", successorId: "b", type: "FS", lagWorkingDays: 0 },
      { id: "2", predecessorId: "b", successorId: "c", type: "FS", lagWorkingDays: 0 },
    ];
    expect(calculateCriticalPath(chain, dependencies).every((node) => node.critical)).toBe(true);
  });

  it("automatically reschedules FS successors", () => {
    const chain = [
      activity("a", "2026-07-06", "2026-07-17", 10),
      activity("b", "2026-07-13", "2026-07-17", 5),
    ];
    const result = rescheduleSuccessors(
      chain,
      [{ id: "1", predecessorId: "a", successorId: "b", type: "FS", lagWorkingDays: 0 }],
      "a",
    );
    expect(result.find((item) => item.id === "b")?.startDate).toBe("2026-07-20");
  });
});

