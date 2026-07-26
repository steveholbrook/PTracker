import type {
  ActualEntry,
  ActualResource,
  ForecastLine,
  PoapActivity,
  Project,
  ProjectWorkspace,
} from "@/types/domain";

function weeks(values: number[]) {
  return Object.fromEntries(values.map((value, index) => [`W${index + 1}`, value]));
}

const createdAt = "2026-07-27T00:00:00.000Z";

export const demoProjects: Project[] = [
  {
    id: "demo-alpha",
    name: "Demo Delivery Alpha",
    code: "DEMO-A",
    description: "Fictional delivery controls example",
    archived: false,
    createdAt,
    createdBy: "demo-admin",
  },
  {
    id: "demo-beta",
    name: "Demo Delivery Beta",
    code: "DEMO-B",
    description: "Fictional programme controls example",
    archived: false,
    createdAt,
    createdBy: "demo-admin",
  },
];

const forecastLines: ForecastLine[] = [
  {
    id: "forecast-resource-01",
    baselineId: "baseline-1",
    stream: "PMO",
    role: "Project Manager",
    code: "CG01",
    name: "Demo Resource 01",
    location: "ANZ",
    dayRate: 1000,
    contractEffortDays: 40,
    contractTotal: 40000,
    plannedStartDate: "2026-04-13",
    plannedEndDate: "2026-10-30",
    weeks: weeks([
      4, 5, 5, 5, 4, 5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 4, 4, 3, 3, 2, 2,
      1, 1, 0, 0, 0, 0, 0, 0,
    ]),
  },
  {
    id: "forecast-resource-02",
    baselineId: "baseline-1",
    stream: "Technical",
    role: "Integration Lead",
    code: "CG02",
    name: "Demo Resource 02",
    location: "IND",
    dayRate: 800,
    contractEffortDays: 45,
    contractTotal: 36000,
    plannedStartDate: "2026-05-04",
    plannedEndDate: "2026-11-27",
    weeks: weeks([
      0, 0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3,
      3, 2, 2, 2, 1, 1, 0, 0,
    ]),
  },
  {
    id: "forecast-resource-03",
    baselineId: "baseline-1",
    stream: "Functional",
    role: "IBP Supply Consultant",
    code: "CG03",
    name: "Demo Resource 03",
    location: "IND",
    dayRate: 750,
    contractEffortDays: 50,
    contractTotal: 37500,
    plannedStartDate: "2026-06-01",
    plannedEndDate: "2026-10-30",
    weeks: weeks([
      0, 0, 0, 0, 0, 0, 0, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
      4, 3, 2, 1, 0, 0, 0, 0,
    ]),
  },
];

export function forecastToActualResource(
  line: ForecastLine,
): ActualResource {
  return {
    id: line.id,
    forecastLineId: line.id,
    stream: line.stream,
    role: line.role,
    code: line.code,
    name: line.name,
    location: line.location,
    dayRate: line.dayRate,
    contractEffortDays: line.contractEffortDays,
    contractTotal: line.contractTotal,
    plannedStartDate: line.plannedStartDate,
    plannedEndDate: line.plannedEndDate,
    actualOnly: false,
  };
}

const actualResources: ActualResource[] = forecastLines.map(
  forecastToActualResource,
);

const actualEntries: ActualEntry[] = forecastLines.flatMap((line, lineIndex) =>
  Array.from({ length: 15 }, (_, index) => {
    const week = index + 1;
    const forecast = line.weeks[`W${week}`] ?? 0;
    const variance = lineIndex === 0 && week === 13 ? 0.25 : 0;
    return {
      id: `${line.id}-w${week}`,
      resourceId: line.id,
      code: line.code,
      week,
      days: Math.max(0, forecast + variance),
      source: "MANUAL" as const,
      updatedAt: createdAt,
    };
  }),
);

const activities: PoapActivity[] = [
  {
    id: "activity-design",
    projectId: "demo-alpha",
    workstreamId: "ws-design",
    name: "Complete FDD walkthrough",
    owner: "Demo Owner 01",
    startDate: "2026-04-13",
    endDate: "2026-06-26",
    durationWorkingDays: 55,
    colour: "#2874d0",
    status: "COMPLETE",
    priority: "HIGH",
    weight: 1,
    isMilestone: false,
    useManualProgress: false,
    baselineStartDate: "2026-04-13",
    baselineEndDate: "2026-06-19",
    createdBy: "demo-admin",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "activity-wave1",
    projectId: "demo-alpha",
    workstreamId: "ws-build",
    name: "Wave 1 configuration",
    owner: "Demo Owner 02",
    startDate: "2026-07-20",
    endDate: "2026-08-07",
    durationWorkingDays: 15,
    colour: "#0e91a1",
    status: "IN_PROGRESS",
    priority: "CRITICAL",
    weight: 1.5,
    isMilestone: false,
    useManualProgress: false,
    baselineStartDate: "2026-07-15",
    baselineEndDate: "2026-08-05",
    createdBy: "demo-admin",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "activity-ut",
    projectId: "demo-alpha",
    workstreamId: "ws-test",
    name: "Wave 1 unit testing",
    owner: "Demo Owner 03",
    startDate: "2026-08-03",
    endDate: "2026-08-14",
    durationWorkingDays: 10,
    colour: "#6e56cf",
    status: "NOT_STARTED",
    priority: "HIGH",
    weight: 1,
    isMilestone: false,
    useManualProgress: false,
    baselineStartDate: "2026-08-03",
    baselineEndDate: "2026-08-14",
    createdBy: "demo-admin",
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "activity-exit",
    projectId: "demo-alpha",
    workstreamId: "ws-test",
    name: "Wave 1 exit",
    owner: "Demo Owner 01",
    startDate: "2026-08-17",
    endDate: "2026-08-17",
    durationWorkingDays: 0,
    colour: "#c27900",
    status: "NOT_STARTED",
    priority: "CRITICAL",
    weight: 0,
    isMilestone: true,
    useManualProgress: false,
    createdBy: "demo-admin",
    createdAt,
    updatedAt: createdAt,
  },
];

export const emptyWorkspace: ProjectWorkspace = {
  settings: {
    projectStartDate: "2026-04-13",
    numberOfWeeks: 30,
    progressSource: "POAP_AUTOMATIC",
    manualPercentComplete: 25,
    displayPrecision: "STANDARD",
    holidays: [],
    customerSafeMode: false,
    invoicePattern: "AR_CODE_YEAR_SEQ",
    activeForecastBaselineId: undefined,
  },
  members: [],
  forecastBaselines: [],
  forecastLines: [],
  actualResources: [],
  actualEntries: [],
  fiUploads: [],
  workstreams: [],
  activities: [],
  dependencies: [],
  poapBaselines: [],
  purchaseOrders: [],
  invoices: [],
  creditNotes: [],
  auditLog: [],
};

export const demoWorkspace: ProjectWorkspace = {
  ...emptyWorkspace,
  settings: {
    ...emptyWorkspace.settings,
    activeForecastBaselineId: "baseline-1",
  },
  members: [
    {
      userId: "demo-admin",
      email: "admin@demo.invalid",
      displayName: "Demo Administrator",
      role: "ADMIN",
    },
    {
      userId: "demo-viewer",
      email: "viewer@demo.invalid",
      displayName: "Demo Customer Viewer",
      role: "CUSTOMER_VIEWER",
    },
  ],
  forecastBaselines: [
    {
      id: "baseline-1",
      name: "Contract Baseline v1",
      status: "APPROVED",
      sourceFileName: "Demo_Forecast_v1.xlsx",
      createdAt,
      createdBy: "demo-admin",
      active: true,
    },
  ],
  forecastLines,
  actualResources,
  actualEntries,
  fiUploads: [],
  workstreams: [
    {
      id: "ws-design",
      name: "Design",
      colour: "#2874d0",
      owner: "Demo Owner 01",
      description: "Functional design and scope alignment",
      order: 0,
      collapsed: false,
    },
    {
      id: "ws-build",
      name: "Build",
      colour: "#0e91a1",
      owner: "Demo Owner 02",
      description: "Configuration and interfaces",
      order: 1,
      collapsed: false,
    },
    {
      id: "ws-test",
      name: "Test",
      colour: "#6e56cf",
      owner: "Demo Owner 03",
      description: "Unit, SIT and exit gates",
      order: 2,
      collapsed: false,
    },
  ],
  activities,
  dependencies: [
    {
      id: "dep-1",
      predecessorId: "activity-design",
      successorId: "activity-wave1",
      type: "FS",
      lagWorkingDays: 0,
    },
    {
      id: "dep-2",
      predecessorId: "activity-wave1",
      successorId: "activity-ut",
      type: "SS",
      lagWorkingDays: 10,
    },
    {
      id: "dep-3",
      predecessorId: "activity-ut",
      successorId: "activity-exit",
      type: "FS",
      lagWorkingDays: 0,
    },
  ],
  poapBaselines: [],
  purchaseOrders: [
    { code: "CG01", value: 100000, description: "Fictional PMO services" },
    { code: "CG02", value: 80000, description: "Fictional technical services" },
    { code: "CG03", value: 75000, description: "Fictional functional services" },
  ],
  invoices: [],
  creditNotes: [],
  auditLog: [],
};

export const demoWorkspaces: Record<string, ProjectWorkspace> = {
  "demo-alpha": demoWorkspace,
  "demo-beta": {
    ...emptyWorkspace,
    settings: {
      ...emptyWorkspace.settings,
      projectStartDate: "2026-06-01",
      numberOfWeeks: 26,
    },
    members: demoWorkspace.members,
    workstreams: [
      {
        id: "ws-discovery",
        name: "Discovery",
        colour: "#2874d0",
        owner: "Delivery Lead",
        description: "Initial discovery",
        order: 0,
        collapsed: false,
      },
    ],
  },
};
