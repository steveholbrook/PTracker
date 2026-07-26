"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Expand,
  FileSpreadsheet,
  LockKeyhole,
  Minimize2,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Input, Label, Select } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { uploadProjectFile } from "@/firebase/storage";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import type {
  ActualEntry,
  ActualResource,
  FiUpload,
  Location,
} from "@/types/domain";
import {
  formatCurrency,
  formatNumber,
  monthLabel,
  splitWeekAcrossMonths,
  weekLabel,
} from "@/utils/dates";
import { parseFiRows } from "@/utils/imports";
import { can } from "@/utils/permissions";

function BoundaryValue({
  allocations,
  precision,
}: {
  allocations: Record<string, number>;
  precision: "WHOLE" | "STANDARD" | "FINANCE";
}) {
  const parts = Object.entries(allocations);
  if (parts.length === 1)
    return (
      <span className="tabular-nums">
        {formatNumber(parts[0][1], precision)}
      </span>
    );
  return (
    <span className="block min-w-20">
      {parts.map(([month, value]) => (
        <span
          key={month}
          className="flex justify-between gap-2 border-b border-[#dbe4ec] py-0.5 last:border-0"
        >
          <small className="text-[9px] font-semibold text-[#7a8799]">
            {month.split(" ")[0]}
          </small>
          <span className="tabular-nums">{formatNumber(value, precision)}</span>
        </span>
      ))}
      <span className="mt-1 flex h-1 overflow-hidden rounded-full bg-[#dce5ed]">
        {parts.map(([month, value], index) => {
          const total = parts.reduce((sum, item) => sum + item[1], 0);
          return (
            <span
              key={month}
              className={index ? "bg-[#0e91a1]" : "bg-[#2874d0]"}
              style={{ width: `${total ? (value / total) * 100 : 50}%` }}
            />
          );
        })}
      </span>
    </span>
  );
}

export function ActualsPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { project, workspace, role } = useProject(projectId);
  const upsertActuals = useAppStore((state) => state.upsertActuals);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"WEEKS" | "MONTHS">("WEEKS");
  const [fullScreen, setFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState(11);
  const [loading, setLoading] = useState(false);
  const [newResource, setNewResource] = useState<{
    code: string;
    name: string;
    location: Location;
    dayRate: number;
  } | null>(null);
  const editable = can(role, "EDIT_ACTUALS");
  const canUpload = can(role, "FI_UPLOAD");
  const canViewRates = can(role, "VIEW_INTERNAL_RATES");
  const precision = workspace.settings.displayPrecision;
  const latestUpload = workspace.fiUploads.at(-1);
  const entriesByCell = useMemo(
    () =>
      new Map(
        workspace.actualEntries.map((entry) => [
          `${entry.resourceId}-${entry.week}`,
          entry,
        ]),
      ),
    [workspace.actualEntries],
  );

  const monthGroups = useMemo(() => {
    const result = new Map<string, number[]>();
    for (let week = 1; week <= workspace.settings.numberOfWeeks; week += 1) {
      const month = monthLabel(workspace.settings.projectStartDate, week);
      result.set(month, [...(result.get(month) ?? []), week]);
    }
    return [...result.entries()];
  }, [
    workspace.settings.numberOfWeeks,
    workspace.settings.projectStartDate,
  ]);

  function saveCell(resource: ActualResource, week: number, days: number) {
    const existing = entriesByCell.get(`${resource.id}-${week}`);
    if (existing?.lockedByInvoiceId) return;
    const entry: ActualEntry = {
      id: existing?.id ?? `${resource.id}-w${week}`,
      resourceId: resource.id,
      code: resource.code,
      week,
      days: Number.isFinite(days) ? days : 0,
      source: "MANUAL",
      updatedAt: new Date().toISOString(),
    };
    upsertActuals(projectId, [], [entry]);
  }

  async function uploadFi(file: File) {
    if (!workspace.forecastLines.length) {
      toast.error("Load a forecast baseline before importing FI actuals");
      return;
    }
    setLoading(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: true,
      });
      const result = parseFiRows({
        rows,
        projectStartDate: workspace.settings.projectStartDate,
        numberOfWeeks: workspace.settings.numberOfWeeks,
        forecastLines: workspace.forecastLines,
        actualResources: workspace.actualResources,
        existingEntries: workspace.actualEntries,
      });
      await uploadProjectFile(projectId, "actuals", file);
      const upload: FiUpload = {
        id: crypto.randomUUID(),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.uid ?? "",
        summary: result.reconciliation,
      };
      upsertActuals(
        projectId,
        result.newResources,
        result.entries,
        upload,
      );
      toast.success(
        `Imported ${result.reconciliation.totalImportedDays.toFixed(2)} days from ${result.reconciliation.importedRows} rows`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to import FI file",
      );
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addActualOnlyResource(event: React.FormEvent) {
    event.preventDefault();
    if (!newResource?.name.trim() || !newResource.code.trim()) return;
    const resource: ActualResource = {
      id: crypto.randomUUID(),
      stream: "Actual only",
      role: "Unmatched",
      code: newResource.code.trim(),
      name: newResource.name.trim(),
      location: newResource.location,
      dayRate: Number(newResource.dayRate) || 0,
      contractEffortDays: 0,
      contractTotal: 0,
      plannedStartDate: "",
      plannedEndDate: "",
      actualOnly: true,
    };
    upsertActuals(projectId, [resource], []);
    setNewResource(null);
  }

  const monthlyReconciliation = monthGroups.map(([month, weeks]) => {
    const forecast = workspace.forecastLines.reduce(
      (total, line) =>
        total +
        weeks.reduce(
          (weekTotal, week) =>
            weekTotal + (line.weeks[`W${week}`] ?? 0),
          0,
        ),
      0,
    );
    const actual = workspace.actualEntries
      .filter((entry) => weeks.includes(entry.week))
      .reduce((total, entry) => total + entry.days, 0);
    return { month, forecast, actual, variance: actual - forecast };
  });

  if (!canViewRates) {
    return (
      <>
        <PageHeader
          eyebrow={project?.code}
          title="Actuals"
          description="Internal resource effort and cost records."
        />
        <Card>
          <CardContent>
            <EmptyState
              icon={LockKeyhole}
              title="Actuals access is restricted"
              description="Customer viewers cannot read internal resource, rate or cost data. Customer-safe summaries remain available in Dashboard and Reports."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 z-[100] overflow-auto bg-[#f3f6fa] p-5"
          : ""
      }
    >
      <PageHeader
        eyebrow={project?.code}
        title="Actual effort"
        description="Enter weekly actuals, import FI transactions and reconcile calendar months without changing the stored weekly source values."
        actions={
          <>
            <Select
              aria-label="Actuals view"
              className="w-32"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "WEEKS" | "MONTHS")
              }
            >
              <option value="WEEKS">Weeks</option>
              <option value="MONTHS">Months</option>
            </Select>
            <Button
              variant="outline"
              onClick={() => setFullScreen((value) => !value)}
            >
              {fullScreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Expand className="h-4 w-4" />
              )}
              {fullScreen ? "Exit full screen" : "Full-screen entry"}
            </Button>
            {editable ? (
              <Button
                variant="outline"
                onClick={() =>
                  setNewResource({
                    code: "",
                    name: "",
                    location: "ANZ",
                    dayRate: 0,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Actual-only row
              </Button>
            ) : null}
            {canUpload ? (
              <>
                <input
                  ref={fileRef}
                  className="hidden"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFi(file);
                  }}
                />
                <Button
                  variant="accent"
                  disabled={loading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {loading ? "Importing…" : "FI Upload"}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {newResource ? (
        <Card className="mb-5 border-[#b9dfe3]">
          <CardContent>
            <form
              onSubmit={addActualOnlyResource}
              className="grid gap-3 md:grid-cols-[130px_1fr_130px_150px_auto]"
            >
              <div>
                <Label htmlFor="actual-code">Code</Label>
                <Input
                  id="actual-code"
                  value={newResource.code}
                  onChange={(event) =>
                    setNewResource({ ...newResource, code: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="actual-name">Name</Label>
                <Input
                  id="actual-name"
                  value={newResource.name}
                  onChange={(event) =>
                    setNewResource({ ...newResource, name: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="actual-location">Location</Label>
                <Select
                  id="actual-location"
                  value={newResource.location}
                  onChange={(event) =>
                    setNewResource({
                      ...newResource,
                      location: event.target.value as Location,
                    })
                  }
                >
                  <option value="ANZ">ANZ</option>
                  <option value="IND">IND</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="actual-rate">Day Rate</Label>
                <Input
                  id="actual-rate"
                  type="number"
                  min={0}
                  value={newResource.dayRate}
                  onChange={(event) =>
                    setNewResource({
                      ...newResource,
                      dayRate: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Add row</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNewResource(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-end gap-5">
          <div className="w-56">
            <Label htmlFor="font-size">Grid font size: {fontSize}px</Label>
            <input
              id="font-size"
              type="range"
              min={6}
              max={15}
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
              className="w-full accent-[#0e91a1]"
            />
          </div>
          <Badge tone="success">Green = matches forecast</Badge>
          <Badge tone="warning">Amber = variance</Badge>
          <Badge tone="neutral">
            <LockKeyhole className="mr-1 h-3 w-3" />
            Saved invoice = locked
          </Badge>
          {!editable ? <Badge tone="blue">Read-only role</Badge> : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {workspace.actualResources.length ? (
          <div className="scrollbar-thin max-h-[66vh] overflow-auto">
            <table
              className="min-w-max border-collapse"
              style={{ fontSize }}
            >
              <thead className="sticky top-0 z-30 bg-[#0b1f3a] text-white">
                <tr>
                  {(fullScreen
                    ? ["Name"]
                    : [
                        "Stream",
                        "Role",
                        "Code",
                        "Name",
                        "Location",
                        "Day Rate",
                        "Contract Days",
                        "Actual To Date",
                        "Actual Cost",
                        "Remaining",
                      ]
                  ).map((header, index) => (
                    <th
                      key={header}
                      className="sticky z-40 border-r border-white/10 bg-[#0b1f3a] px-3 py-3 text-left font-semibold"
                      style={{ left: fullScreen ? 0 : index * 105, minWidth: fullScreen ? 190 : 105 }}
                    >
                      {header}
                    </th>
                  ))}
                  {mode === "WEEKS"
                    ? Array.from(
                        { length: workspace.settings.numberOfWeeks },
                        (_, index) => (
                          <th
                            key={index}
                            className="min-w-20 border-r border-white/10 px-2 py-3 text-center font-semibold"
                          >
                            {weekLabel(
                              workspace.settings.projectStartDate,
                              index + 1,
                            )}
                          </th>
                        ),
                      )
                    : monthGroups.map(([month]) => (
                        <th
                          key={month}
                          className="min-w-24 border-r border-white/10 px-2 py-3 text-center font-semibold"
                        >
                          {month}
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {workspace.actualResources.map((resource, rowIndex) => {
                  const resourceEntries = workspace.actualEntries.filter(
                    (entry) => entry.resourceId === resource.id,
                  );
                  const actualToDate = resourceEntries.reduce(
                    (total, entry) => total + entry.days,
                    0,
                  );
                  const remaining =
                    resource.contractEffortDays - actualToDate;
                  const fixedValues = fullScreen
                    ? [resource.name]
                    : [
                        resource.stream,
                        resource.role,
                        resource.code,
                        resource.name,
                        resource.location,
                        formatCurrency(resource.dayRate),
                        formatNumber(resource.contractEffortDays, precision),
                        formatNumber(actualToDate, precision),
                        formatCurrency(actualToDate * resource.dayRate),
                        formatNumber(remaining, precision),
                      ];
                  return (
                    <tr
                      key={resource.id}
                      className={rowIndex % 2 ? "bg-[#f8fafc]" : "bg-white"}
                    >
                      {fixedValues.map((value, index) => (
                        <td
                          key={index}
                          className={`sticky z-20 border-b border-r border-[#e1e7ee] px-3 py-2 ${
                            rowIndex % 2 ? "bg-[#f8fafc]" : "bg-white"
                          } ${index === (fullScreen ? 0 : 3) ? "font-semibold" : ""}`}
                          style={{
                            left: fullScreen ? 0 : index * 105,
                            minWidth: fullScreen ? 190 : 105,
                          }}
                        >
                          {value}
                          {resource.actualOnly && index === (fullScreen ? 0 : 3) ? (
                            <Badge tone="warning" className="ml-2">
                              Actual only
                            </Badge>
                          ) : null}
                        </td>
                      ))}
                      {mode === "WEEKS"
                        ? Array.from(
                            { length: workspace.settings.numberOfWeeks },
                            (_, weekIndex) => {
                              const week = weekIndex + 1;
                              const entry = entriesByCell.get(
                                `${resource.id}-${week}`,
                              );
                              const actual = entry?.days ?? 0;
                              const forecast =
                                workspace.forecastLines.find(
                                  (line) =>
                                    line.id === resource.forecastLineId,
                                )?.weeks[`W${week}`] ?? 0;
                              const allocations =
                                entry?.monthAllocations ??
                                splitWeekAcrossMonths(
                                  workspace.settings.projectStartDate,
                                  week,
                                  actual,
                                );
                              const locked = Boolean(
                                entry?.lockedByInvoiceId,
                              );
                              return (
                                <td
                                  key={week}
                                  className={`border-b border-r border-[#e1e7ee] p-1 text-center ${
                                    locked
                                      ? "bg-[#e8edf2]"
                                      : Math.abs(actual - forecast) < 0.001
                                        ? "bg-[#e4f5ee]"
                                        : actual
                                          ? "bg-[#fff1d2]"
                                          : ""
                                  }`}
                                >
                                  {Object.keys(allocations).length > 1 ? (
                                    <BoundaryValue
                                      allocations={allocations}
                                      precision={precision}
                                    />
                                  ) : (
                                    <div className="relative">
                                      <input
                                        aria-label={`${resource.name} week ${week}`}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={actual || ""}
                                        disabled={!editable || locked}
                                        onChange={(event) =>
                                          saveCell(
                                            resource,
                                            week,
                                            Number(event.target.value),
                                          )
                                        }
                                        className="w-16 rounded border border-transparent bg-transparent px-1 py-1 text-right tabular-nums outline-none focus:border-[#0e91a1] focus:bg-white disabled:text-[#526177]"
                                      />
                                      {locked ? (
                                        <LockKeyhole className="absolute left-0 top-1.5 h-3 w-3 text-[#758397]" />
                                      ) : null}
                                    </div>
                                  )}
                                </td>
                              );
                            },
                          )
                        : monthGroups.map(([month, weeks]) => {
                            const actual = resourceEntries
                              .filter((entry) => weeks.includes(entry.week))
                              .reduce(
                                (total, entry) => total + entry.days,
                                0,
                              );
                            const forecastLine =
                              workspace.forecastLines.find(
                                (line) => line.id === resource.forecastLineId,
                              );
                            const forecast = weeks.reduce(
                              (total, week) =>
                                total +
                                (forecastLine?.weeks[`W${week}`] ?? 0),
                              0,
                            );
                            return (
                              <td
                                key={month}
                                className={`border-b border-r border-[#e1e7ee] px-3 py-2 text-right tabular-nums ${
                                  Math.abs(actual - forecast) < 0.001
                                    ? "bg-[#e4f5ee]"
                                    : actual
                                      ? "bg-[#fff1d2]"
                                      : ""
                                }`}
                              >
                                {formatNumber(actual, precision)}
                              </td>
                            );
                          })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent>
            <EmptyState
              icon={FileSpreadsheet}
              title="Actuals require a forecast"
              description="Load the approved Forecast baseline first. PTracker will derive the starting resource rows and then permit manual entry or FI upload."
            />
          </CardContent>
        )}
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Monthly reconciliation</h2>
              <p className="mt-1 text-xs text-[#758397]">
                Boundary weeks use Monday–Friday working-day allocation unless FI
                Item Dates provide a direct split.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#758397]">
                    <th className="pb-3">Month</th>
                    <th className="pb-3 text-right">Forecast</th>
                    <th className="pb-3 text-right">Actual</th>
                    <th className="pb-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReconciliation.map((row) => (
                    <tr key={row.month} className="border-t border-[#e4eaf0]">
                      <td className="py-3 font-semibold">{row.month}</td>
                      <td className="py-3 text-right">
                        {formatNumber(row.forecast, precision)}
                      </td>
                      <td className="py-3 text-right">
                        {formatNumber(row.actual, precision)}
                      </td>
                      <td
                        className={`py-3 text-right font-semibold ${
                          row.variance > 0.001
                            ? "text-[#b06c00]"
                            : row.variance < -0.001
                              ? "text-[#2874d0]"
                              : "text-[#16875f]"
                        }`}
                      >
                        {formatNumber(row.variance, precision)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Latest FI reconciliation</h2>
              <p className="mt-1 text-xs text-[#758397]">
                {latestUpload
                  ? `${latestUpload.fileName} · ${new Date(latestUpload.uploadedAt).toLocaleString("en-AU")}`
                  : "No FI file has been loaded"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {latestUpload ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Source rows", latestUpload.summary.sourceRows],
                  ["Imported rows", latestUpload.summary.importedRows],
                  ["Skipped rows", latestUpload.summary.skippedRows],
                  ["Days groups", latestUpload.summary.groupsUsingDays],
                  ["Hours groups", latestUpload.summary.groupsUsingHours],
                  ["New resources", latestUpload.summary.newResources],
                  ["Locked skipped", latestUpload.summary.lockedCellsSkipped],
                  [
                    "Imported days",
                    formatNumber(
                      latestUpload.summary.totalImportedDays,
                      precision,
                    ),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-[#e1e7ee] p-3"
                  >
                    <p className="text-xs text-[#758397]">{label}</p>
                    <p className="mt-1 font-bold">{value}</p>
                  </div>
                ))}
                {latestUpload.summary.errors.length ? (
                  <div className="col-span-2 flex gap-2 rounded-lg bg-[#fff3df] p-3 text-xs text-[#8f5e0b]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {latestUpload.summary.errors.length} exception
                    {latestUpload.summary.errors.length === 1 ? "" : "s"} require
                    review.
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyState
                icon={Upload}
                title="No FI reconciliation"
                description="Upload an FI extract with Project, Employee/Supplier and Item Date columns."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

