import { z } from "zod";

export const locationSchema = z.enum(["ANZ", "IND"]);
export const roleSchema = z.enum([
  "ADMIN",
  "PROJECT_MANAGER",
  "DELIVERY_LEAD",
  "FINANCE_REVIEWER",
  "INTERNAL_VIEWER",
  "CUSTOMER_VIEWER",
]);

export const projectSettingsSchema = z.object({
  projectStartDate: z.iso.date(),
  numberOfWeeks: z.number().int().min(1).max(520),
  progressSource: z.enum(["POAP_AUTOMATIC", "MANUAL"]),
  manualPercentComplete: z.number().min(0).max(100),
  displayPrecision: z.enum(["WHOLE", "STANDARD", "FINANCE"]),
  holidays: z.array(z.iso.date()),
  customerSafeMode: z.boolean(),
  invoicePattern: z.enum([
    "AR_CODE_SEQ",
    "AR_CODE_YEAR_SEQ",
    "INV_CODE_N",
  ]),
  activeForecastBaselineId: z.string().optional(),
});

export const forecastLineSchema = z.object({
  id: z.string().min(1),
  baselineId: z.string().min(1),
  stream: z.string().min(1),
  role: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  location: locationSchema,
  dayRate: z.number().nonnegative(),
  contractEffortDays: z.number().nonnegative(),
  contractTotal: z.number().nonnegative(),
  plannedStartDate: z.iso.date().or(z.literal("")),
  plannedEndDate: z.iso.date().or(z.literal("")),
  weeks: z.record(z.string(), z.number()),
});

export const activitySchema = z
  .object({
    id: z.string().min(1),
    projectId: z.string().min(1),
    workstreamId: z.string().min(1),
    name: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    durationWorkingDays: z.number().nonnegative(),
    colour: z.string().min(1),
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE", "ON_HOLD"]),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    weight: z.number().nonnegative(),
    isMilestone: z.boolean(),
    useManualProgress: z.boolean(),
    createdBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot be before start date",
    path: ["endDate"],
  });
