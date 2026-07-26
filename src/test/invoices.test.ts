import { describe, expect, it } from "vitest";
import type { ActualResource, Invoice } from "@/types/domain";
import {
  calculateInvoice,
  nextInvoiceNumber,
  unavailableInvoiceWeeks,
} from "@/utils/invoices";

const existing: Invoice = {
  id: "i1",
  invoiceNumber: "AR-CG01-001",
  code: "CG01",
  periodType: "WEEKS",
  startWeek: 1,
  endWeek: 2,
  periodName: "W1–W2",
  actualDays: 8,
  forecastDays: 10,
  amount: 8000,
  status: "DRAFT",
  createdAt: "",
  createdBy: "u",
  evidencePack: {
    resources: [],
    forecastDays: 10,
    actualDays: 8,
    amount: 8000,
    capturedAt: "",
  },
};

describe("invoice controls", () => {
  it("excludes every week covered by an existing invoice", () => {
    expect([...unavailableInvoiceWeeks([existing], "CG01")]).toEqual([1, 2]);
  });

  it("generates sequential invoice numbers", () => {
    expect(nextInvoiceNumber("AR_CODE_SEQ", "CG01", [existing], 2026)).toBe(
      "AR-CG01-002",
    );
  });

  it("calculates evidence from actual days and rates", () => {
    const resource: ActualResource = {
      id: "r1",
      stream: "Delivery",
      role: "Consultant",
      code: "CG01",
      name: "Alex",
      location: "ANZ",
      dayRate: 1200,
      contractEffortDays: 10,
      contractTotal: 12000,
      plannedStartDate: "",
      plannedEndDate: "",
      actualOnly: false,
    };
    const result = calculateInvoice({
      code: "CG01",
      startWeek: 1,
      endWeek: 2,
      actualResources: [resource],
      actualEntries: [
        { id: "a1", resourceId: "r1", code: "CG01", week: 1, days: 4, source: "MANUAL", updatedAt: "" },
        { id: "a2", resourceId: "r1", code: "CG01", week: 2, days: 5, source: "MANUAL", updatedAt: "" },
      ],
      forecastLines: [],
    });
    expect(result.actualDays).toBe(9);
    expect(result.amount).toBe(10800);
  });
});

