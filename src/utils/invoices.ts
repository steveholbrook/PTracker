import type {
  ActualEntry,
  ActualResource,
  ForecastLine,
  Invoice,
  PurchaseOrder,
} from "@/types/domain";

export function unavailableInvoiceWeeks(invoices: Invoice[], code: string) {
  const weeks = new Set<number>();
  invoices
    .filter((invoice) => invoice.code === code)
    .forEach((invoice) => {
      for (let week = invoice.startWeek; week <= invoice.endWeek; week += 1) {
        weeks.add(week);
      }
    });
  return weeks;
}

export function calculateInvoice(input: {
  code: string;
  startWeek: number;
  endWeek: number;
  actualEntries: ActualEntry[];
  actualResources: ActualResource[];
  forecastLines: ForecastLine[];
}) {
  const resources = input.actualResources
    .filter((resource) => resource.code === input.code)
    .map((resource) => {
      const days = input.actualEntries
        .filter(
          (entry) =>
            entry.resourceId === resource.id &&
            entry.week >= input.startWeek &&
            entry.week <= input.endWeek,
        )
        .reduce((total, entry) => total + entry.days, 0);
      return {
        resourceId: resource.id,
        name: resource.name,
        days,
        dayRate: resource.dayRate,
        amount: days * resource.dayRate,
      };
    })
    .filter((resource) => resource.days !== 0);
  const forecastDays = input.forecastLines
    .filter((line) => line.code === input.code)
    .reduce((total, line) => {
      let lineDays = 0;
      for (let week = input.startWeek; week <= input.endWeek; week += 1) {
        lineDays += line.weeks[`W${week}`] ?? 0;
      }
      return total + lineDays;
    }, 0);
  return {
    resources,
    actualDays: resources.reduce((total, resource) => total + resource.days, 0),
    forecastDays,
    amount: resources.reduce((total, resource) => total + resource.amount, 0),
  };
}

export function poSummary(
  purchaseOrder: PurchaseOrder | undefined,
  invoices: Invoice[],
  creditAmount: number,
) {
  const poValue = purchaseOrder?.value ?? 0;
  const invoicedToDate = invoices.reduce(
    (total, invoice) => total + invoice.amount,
    0,
  );
  return {
    poValue,
    invoicedToDate,
    creditsToDate: creditAmount,
    remainingPo: poValue - invoicedToDate + creditAmount,
  };
}

export function nextInvoiceNumber(
  pattern: "AR_CODE_SEQ" | "AR_CODE_YEAR_SEQ" | "INV_CODE_N",
  code: string,
  existing: Invoice[],
  year: number,
) {
  const sequence = String(
    existing.filter((invoice) => invoice.code === code).length + 1,
  ).padStart(3, "0");
  if (pattern === "AR_CODE_YEAR_SEQ")
    return `AR-${code}-${year}-${sequence}`;
  if (pattern === "INV_CODE_N") return `INV-${code}-${sequence}`;
  return `AR-${code}-${sequence}`;
}

