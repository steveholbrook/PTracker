import {
  addDays,
  differenceInCalendarDays,
  format,
  getDay,
  isAfter,
  isBefore,
  isEqual,
  parse,
} from "date-fns";

export function parseLocalDate(value: string): Date {
  const parsed = parse(value, "yyyy-MM-dd", new Date(2000, 0, 1));
  parsed.setHours(12, 0, 0, 0);
  return parsed;
}

export function toLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isMonday(value: string): boolean {
  return getDay(parseLocalDate(value)) === 1;
}

export function weekFromDate(date: string, projectStartDate: string): number {
  return (
    Math.floor(
      differenceInCalendarDays(
        parseLocalDate(date),
        parseLocalDate(projectStartDate),
      ) / 7,
    ) + 1
  );
}

export function currentProjectWeek(
  today: string,
  projectStartDate: string,
  numberOfWeeks: number,
): number {
  const raw = weekFromDate(today, projectStartDate);
  return Math.min(numberOfWeeks, Math.max(1, raw));
}

export function weekStartDate(projectStartDate: string, week: number) {
  return toLocalDateString(
    addDays(parseLocalDate(projectStartDate), Math.max(0, week - 1) * 7),
  );
}

export function weekLabel(projectStartDate: string, week: number) {
  return `W${week} - ${format(parseLocalDate(weekStartDate(projectStartDate, week)), "dd-MMM")}`;
}

export function monthLabel(projectStartDate: string, week: number) {
  return format(parseLocalDate(weekStartDate(projectStartDate, week)), "MMM yyyy");
}

export function splitWeekAcrossMonths(
  projectStartDate: string,
  week: number,
  value: number,
) {
  const monday = parseLocalDate(weekStartDate(projectStartDate, week));
  const workingDays = Array.from({ length: 5 }, (_, index) =>
    addDays(monday, index),
  );
  const counts = workingDays.reduce<Record<string, number>>((result, day) => {
    const key = format(day, "MMM yyyy");
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  return Object.fromEntries(
    Object.entries(counts).map(([month, days]) => [
      month,
      value * (days / workingDays.length),
    ]),
  );
}

export function workingDaysBetween(start: string, end: string): number {
  const first = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (isAfter(first, last)) return 0;
  let cursor = first;
  let days = 0;
  while (isBefore(cursor, last) || isEqual(cursor, last)) {
    const day = getDay(cursor);
    if (day !== 0 && day !== 6) days += 1;
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function addWorkingDays(value: string, numberOfDays: number): string {
  let cursor = parseLocalDate(value);
  let remaining = Math.max(0, numberOfDays);
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    const day = getDay(cursor);
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return toLocalDateString(cursor);
}

export function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function formatNumber(
  value: number,
  precision: "WHOLE" | "STANDARD" | "FINANCE",
) {
  if (precision === "WHOLE") return Math.round(value).toLocaleString("en-AU");
  if (precision === "FINANCE")
    return value.toLocaleString("en-AU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(value: number) {
  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}
