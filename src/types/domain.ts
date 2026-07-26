export type ProjectRole =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "DELIVERY_LEAD"
  | "FINANCE_REVIEWER"
  | "INTERNAL_VIEWER"
  | "CUSTOMER_VIEWER";

export type Location = "ANZ" | "IND";
export type DisplayPrecision = "WHOLE" | "STANDARD" | "FINANCE";
export type ProgressSource = "POAP_AUTOMATIC" | "MANUAL";

export type Project = {
  id: string;
  name: string;
  code: string;
  description: string;
  archived: boolean;
  createdAt: string;
  createdBy: string;
};

export type ProjectMember = {
  userId: string;
  email: string;
  displayName: string;
  role: ProjectRole;
};

export type ProjectSettings = {
  projectStartDate: string;
  numberOfWeeks: number;
  progressSource: ProgressSource;
  manualPercentComplete: number;
  displayPrecision: DisplayPrecision;
  holidays: string[];
  customerSafeMode: boolean;
  invoicePattern: "AR_CODE_SEQ" | "AR_CODE_YEAR_SEQ" | "INV_CODE_N";
  activeForecastBaselineId?: string;
};

export type ForecastLine = {
  id: string;
  baselineId: string;
  stream: string;
  role: string;
  code: string;
  name: string;
  location: Location;
  dayRate: number;
  contractEffortDays: number;
  contractTotal: number;
  plannedStartDate: string;
  plannedEndDate: string;
  weeks: Record<string, number>;
};

export type ForecastBaseline = {
  id: string;
  name: string;
  status: "DRAFT" | "APPROVED" | "SUPERSEDED";
  sourceFileName: string;
  sourceStoragePath?: string;
  createdAt: string;
  createdBy: string;
  active: boolean;
};

export type ActualResource = Omit<ForecastLine, "baselineId" | "weeks"> & {
  forecastLineId?: string;
  actualOnly: boolean;
};

export type ActualEntry = {
  id: string;
  resourceId: string;
  code: string;
  week: number;
  days: number;
  monthAllocations?: Record<string, number>;
  source: "MANUAL" | "FI_UPLOAD";
  lockedByInvoiceId?: string;
  updatedAt: string;
};

export type FiUpload = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  summary: FiReconciliation;
};

export type FiReconciliation = {
  sourceRows: number;
  importedRows: number;
  skippedRows: number;
  groupsUsingDays: number;
  groupsUsingHours: number;
  newResources: number;
  unmatchedResources: number;
  lockedCellsSkipped: number;
  invalidLocations: number;
  totalImportedDays: number;
  errors: string[];
};

export type Workstream = {
  id: string;
  name: string;
  colour: string;
  owner: string;
  description: string;
  order: number;
  collapsed: boolean;
};

export type ActivityStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "ON_HOLD";
export type ActivityPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PoapActivity = {
  id: string;
  projectId: string;
  workstreamId: string;
  name: string;
  description?: string;
  owner?: string;
  startDate: string;
  endDate: string;
  durationWorkingDays: number;
  colour: string;
  status: ActivityStatus;
  priority: ActivityPriority;
  weight: number;
  isMilestone: boolean;
  manualProgress?: number;
  useManualProgress: boolean;
  baselineStartDate?: string;
  baselineEndDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type PoapDependency = {
  id: string;
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagWorkingDays: number;
};

export type PoapBaseline = {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  approvalStatus: "DRAFT" | "APPROVED";
  active: boolean;
  activities: Array<
    Pick<PoapActivity, "id" | "name" | "startDate" | "endDate">
  >;
};

export type PurchaseOrder = {
  code: string;
  value: number;
  description: string;
};

export type InvoiceStatus =
  | "DRAFT"
  | "PM_REVIEWED"
  | "FINANCE_REVIEWED"
  | "SENT_TO_CUSTOMER"
  | "PAID";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  code: string;
  periodType: "WEEKS" | "MONTHS";
  startWeek: number;
  endWeek: number;
  periodName: string;
  actualDays: number;
  forecastDays: number;
  amount: number;
  status: InvoiceStatus;
  createdAt: string;
  createdBy: string;
  evidencePack: {
    baselineId?: string;
    resources: Array<{
      resourceId: string;
      name: string;
      days: number;
      dayRate: number;
      amount: number;
    }>;
    forecastDays: number;
    actualDays: number;
    amount: number;
    capturedAt: string;
  };
};

export type CreditNote = {
  id: string;
  invoiceId: string;
  number: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
};

export type AuditEntry = {
  id: string;
  userId: string;
  email: string;
  projectId: string;
  timestamp: string;
  action: string;
  entity: string;
  summary: string;
  reason?: string;
  correlationId: string;
};

export type ProjectWorkspace = {
  settings: ProjectSettings;
  members: ProjectMember[];
  forecastBaselines: ForecastBaseline[];
  forecastLines: ForecastLine[];
  actualResources: ActualResource[];
  actualEntries: ActualEntry[];
  fiUploads: FiUpload[];
  workstreams: Workstream[];
  activities: PoapActivity[];
  dependencies: PoapDependency[];
  poapBaselines: PoapBaseline[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
  auditLog: AuditEntry[];
};

export type Permission =
  | "CREATE_PROJECT"
  | "MANAGE_ACCESS"
  | "EDIT_SETTINGS"
  | "EDIT_POAP"
  | "LOAD_FORECAST"
  | "EDIT_ACTUALS"
  | "FI_UPLOAD"
  | "CREATE_INVOICE"
  | "APPROVE_INVOICE"
  | "VIEW_INTERNAL_RATES";

export type SessionUser = {
  uid: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  systemRole?: "ADMIN";
};
