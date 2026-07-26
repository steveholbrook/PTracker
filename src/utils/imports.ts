import type {
  ActualEntry,
  ActualResource,
  FiReconciliation,
  ForecastLine,
  Location,
} from "@/types/domain";
import { weekFromDate } from "@/utils/dates";

type SheetRow = Record<string, unknown>;

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normaliseRow(row: SheetRow) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normaliseHeader(key), value]),
  );
}

function asString(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function asNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function asDate(value: unknown): string {
  if (value instanceof Date) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    excelEpoch.setDate(excelEpoch.getDate() + value);
    return asDate(excelEpoch);
  }
  const raw = asString(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : asDate(parsed);
}

export type ForecastParseResult = {
  lines: ForecastLine[];
  errors: string[];
  numberOfWeeks: number;
};

export function parseForecastRows(
  rows: SheetRow[],
  baselineId: string,
): ForecastParseResult {
  const errors: string[] = [];
  const lines: ForecastLine[] = [];
  let maxWeek = 0;
  rows.forEach((source, index) => {
    const row = normaliseRow(source);
    const required = ["stream", "role", "code", "name", "location", "dayrate"];
    const missing = required.filter((field) => !asString(row[field]));
    if (missing.length) {
      if (Object.values(row).some((value) => asString(value))) {
        errors.push(`Row ${index + 2}: missing ${missing.join(", ")}`);
      }
      return;
    }
    const location = asString(row.location).toUpperCase() as Location;
    if (!["ANZ", "IND"].includes(location)) {
      errors.push(`Row ${index + 2}: Location must be ANZ or IND`);
      return;
    }
    const weeks: Record<string, number> = {};
    for (const [key, value] of Object.entries(row)) {
      const match = key.match(/^w(\d+)$/);
      if (!match) continue;
      const week = Number(match[1]);
      maxWeek = Math.max(maxWeek, week);
      weeks[`W${week}`] = asNumber(value);
    }
    const contractEffortDays =
      asNumber(row.contracteffortdays) ||
      Object.values(weeks).reduce((total, value) => total + value, 0);
    const dayRate = asNumber(row.dayrate);
    lines.push({
      id: crypto.randomUUID(),
      baselineId,
      stream: asString(row.stream),
      role: asString(row.role),
      code: asString(row.code),
      name: asString(row.name),
      location,
      dayRate,
      contractEffortDays,
      contractTotal: asNumber(row.contracttotal) || contractEffortDays * dayRate,
      plannedStartDate: asDate(row.plannedstartdate),
      plannedEndDate: asDate(row.plannedenddate),
      weeks,
    });
  });
  return { lines, errors, numberOfWeeks: maxWeek };
}

export type FiImportResult = {
  entries: ActualEntry[];
  newResources: ActualResource[];
  reconciliation: FiReconciliation;
};

export function parseFiRows(input: {
  rows: SheetRow[];
  projectStartDate: string;
  numberOfWeeks: number;
  forecastLines: ForecastLine[];
  actualResources: ActualResource[];
  existingEntries: ActualEntry[];
}): FiImportResult {
  const groups = new Map<
    string,
    {
      code: string;
      name: string;
      week: number;
      days: number[];
      hours: number[];
      location?: Location;
      rows: number;
    }
  >();
  const errors: string[] = [];
  let invalidLocations = 0;
  input.rows.forEach((source, index) => {
    const row = normaliseRow(source);
    const code = asString(row.project || row.code);
    const name = asString(row.employeesupplier || row.name);
    const itemDate = asDate(row.itemdate);
    if (!code || !name || !itemDate) {
      errors.push(`Row ${index + 2}: Project, Employee/Supplier and Item Date are required`);
      return;
    }
    const week = weekFromDate(itemDate, input.projectStartDate);
    if (week < 1 || week > input.numberOfWeeks) {
      errors.push(`Row ${index + 2}: Item Date is outside the project horizon`);
      return;
    }
    const rawLocation = asString(row.location).toUpperCase();
    let location: Location | undefined;
    if (rawLocation) {
      if (rawLocation === "ANZ" || rawLocation === "IND") location = rawLocation;
      else invalidLocations += 1;
    }
    const key = `${code.toLowerCase()}|${name.toLowerCase()}|${week}`;
    const group = groups.get(key) ?? {
      code,
      name,
      week,
      days: [],
      hours: [],
      location,
      rows: 0,
    };
    const hasDays =
      row.days !== undefined &&
      row.days !== null &&
      asString(row.days) !== "";
    if (hasDays) group.days.push(asNumber(row.days));
    if (
      asString(row.uom).toLowerCase().includes("hour") &&
      asString(row.quantity) !== ""
    ) {
      group.hours.push(asNumber(row.quantity));
    }
    group.location = group.location ?? location;
    group.rows += 1;
    groups.set(key, group);
  });

  const entries: ActualEntry[] = [];
  const newResources: ActualResource[] = [];
  let importedRows = 0;
  let skippedRows = 0;
  let groupsUsingDays = 0;
  let groupsUsingHours = 0;
  let lockedCellsSkipped = 0;
  let totalImportedDays = 0;

  for (const group of groups.values()) {
    const forecast = input.forecastLines.find(
      (line) =>
        line.code.toLowerCase() === group.code.toLowerCase() &&
        line.name.toLowerCase() === group.name.toLowerCase(),
    );
    let resource = input.actualResources.find(
      (line) =>
        line.code.toLowerCase() === group.code.toLowerCase() &&
        line.name.toLowerCase() === group.name.toLowerCase(),
    );
    if (!resource && forecast) {
      resource = {
        id: forecast.id,
        forecastLineId: forecast.id,
        stream: forecast.stream,
        role: forecast.role,
        code: forecast.code,
        name: forecast.name,
        location: forecast.location,
        dayRate: forecast.dayRate,
        contractEffortDays: forecast.contractEffortDays,
        contractTotal: forecast.contractTotal,
        plannedStartDate: forecast.plannedStartDate,
        plannedEndDate: forecast.plannedEndDate,
        actualOnly: false,
      };
    }
    if (!resource) {
      const location = group.location;
      if (!location) {
        errors.push(
          `${group.code}/${group.name}/W${group.week}: no valid Location for hours conversion`,
        );
        skippedRows += group.rows;
        continue;
      }
      resource = {
        id: crypto.randomUUID(),
        stream: "Actual only",
        role: "Unmatched",
        code: group.code,
        name: group.name,
        location,
        dayRate: 0,
        contractEffortDays: 0,
        contractTotal: 0,
        plannedStartDate: "",
        plannedEndDate: "",
        actualOnly: true,
      };
      newResources.push(resource);
    }
    const existing = input.existingEntries.find(
      (entry) =>
        entry.resourceId === resource!.id && entry.week === group.week,
    );
    if (existing?.lockedByInvoiceId) {
      lockedCellsSkipped += 1;
      skippedRows += group.rows;
      continue;
    }
    let days = 0;
    if (group.days.length) {
      days = group.days.reduce((total, value) => total + value, 0);
      groupsUsingDays += 1;
    } else if (group.hours.length) {
      const location = group.location ?? resource.location;
      days =
        group.hours.reduce((total, value) => total + value, 0) /
        (location === "IND" ? 9 : 8);
      groupsUsingHours += 1;
    } else {
      errors.push(
        `${group.code}/${group.name}/W${group.week}: neither Days nor Hours supplied`,
      );
      skippedRows += group.rows;
      continue;
    }
    entries.push({
      id: existing?.id ?? crypto.randomUUID(),
      resourceId: resource.id,
      code: group.code,
      week: group.week,
      days,
      source: "FI_UPLOAD",
      updatedAt: new Date().toISOString(),
    });
    importedRows += group.rows;
    totalImportedDays += days;
  }

  return {
    entries,
    newResources,
    reconciliation: {
      sourceRows: input.rows.length,
      importedRows,
      skippedRows,
      groupsUsingDays,
      groupsUsingHours,
      newResources: newResources.length,
      unmatchedResources: newResources.length,
      lockedCellsSkipped,
      invalidLocations,
      totalImportedDays,
      errors,
    },
  };
}
