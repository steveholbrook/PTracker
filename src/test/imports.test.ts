import { describe, expect, it } from "vitest";
import type { ForecastLine } from "@/types/domain";
import { parseFiRows, parseForecastRows } from "@/utils/imports";

const forecast: ForecastLine = {
  id: "f1",
  baselineId: "b1",
  stream: "Delivery",
  role: "Consultant",
  code: "CG01",
  name: "Alex",
  location: "ANZ",
  dayRate: 1000,
  contractEffortDays: 10,
  contractTotal: 10000,
  plannedStartDate: "2026-07-06",
  plannedEndDate: "2026-07-17",
  weeks: { W1: 5, W2: 5 },
};

describe("spreadsheet imports", () => {
  it("detects forecast columns in any order", () => {
    const result = parseForecastRows(
      [
        {
          Name: "Alex",
          W2: 5,
          Code: "CG01",
          Location: "ANZ",
          Role: "Consultant",
          "Day Rate": 1000,
          Stream: "Delivery",
          W1: 5,
        },
      ],
      "b1",
    );
    expect(result.errors).toEqual([]);
    expect(result.lines[0].weeks).toEqual({ W2: 5, W1: 5 });
    expect(result.numberOfWeeks).toBe(2);
  });

  it("uses Days before Hours for the same FI group", () => {
    const result = parseFiRows({
      rows: [
        {
          Project: "CG01",
          "Employee/Supplier": "Alex",
          "Item Date": "2026-07-07",
          Days: 1,
          Quantity: 80,
          UOM: "Hours",
        },
      ],
      projectStartDate: "2026-07-06",
      numberOfWeeks: 4,
      forecastLines: [forecast],
      actualResources: [],
      existingEntries: [],
    });
    expect(result.entries[0].days).toBe(1);
    expect(result.reconciliation.groupsUsingDays).toBe(1);
  });

  it("converts ANZ and IND hours using different working days", () => {
    const anz = parseFiRows({
      rows: [
        {
          Project: "CG01",
          "Employee/Supplier": "Alex",
          "Item Date": "2026-07-07",
          Quantity: 8,
          UOM: "Hours",
        },
      ],
      projectStartDate: "2026-07-06",
      numberOfWeeks: 4,
      forecastLines: [forecast],
      actualResources: [],
      existingEntries: [],
    });
    const ind = parseFiRows({
      rows: [
        {
          Project: "CG02",
          "Employee/Supplier": "Priya",
          "Item Date": "2026-07-07",
          Quantity: 9,
          UOM: "Hours",
          Location: "IND",
        },
      ],
      projectStartDate: "2026-07-06",
      numberOfWeeks: 4,
      forecastLines: [],
      actualResources: [],
      existingEntries: [],
    });
    expect(anz.entries[0].days).toBe(1);
    expect(ind.entries[0].days).toBe(1);
  });
});

