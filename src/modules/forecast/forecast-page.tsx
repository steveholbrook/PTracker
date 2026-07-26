"use client";

import { useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { uploadProjectFile } from "@/firebase/storage";
import { useAuth } from "@/components/auth/auth-provider";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import type { ForecastLine } from "@/types/domain";
import { formatCurrency, formatNumber, weekLabel } from "@/utils/dates";
import { parseForecastRows } from "@/utils/imports";
import { can } from "@/utils/permissions";

export function ForecastPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { project, workspace, role } = useProject(projectId);
  const replaceForecast = useAppStore((state) => state.replaceForecast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const canLoad = can(role, "LOAD_FORECAST");
  const canViewRates = can(role, "VIEW_INTERNAL_RATES");
  const precision = workspace.settings.displayPrecision;
  const weekCount = Math.max(
    0,
    ...workspace.forecastLines.map((line) => Object.keys(line.weeks).length),
  );
  const activeBaseline = workspace.forecastBaselines.find(
    (baseline) =>
      baseline.id === workspace.settings.activeForecastBaselineId ||
      (!workspace.settings.activeForecastBaselineId && baseline.active),
  );

  const columns = useMemo<ColumnDef<ForecastLine>[]>(() => {
    const fixed: ColumnDef<ForecastLine>[] = [
      {
        accessorKey: "stream",
        header: "Stream",
        cell: ({ getValue }) => (
          <span className="font-semibold">{String(getValue())}</span>
        ),
      },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "code", header: "Code" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "location", header: "Location" },
      ...(canViewRates
        ? [
            {
              accessorKey: "dayRate",
              header: "Day Rate",
              cell: ({ getValue }: { getValue: () => unknown }) =>
                formatCurrency(Number(getValue())),
            } as ColumnDef<ForecastLine>,
          ]
        : []),
      {
        accessorKey: "contractEffortDays",
        header: "Contract Days",
        cell: ({ getValue }) => formatNumber(Number(getValue()), precision),
      },
    ];
    const weekColumns: ColumnDef<ForecastLine>[] = Array.from(
      { length: weekCount },
      (_, index) => ({
        id: `W${index + 1}`,
        header: () => (
          <span className="whitespace-pre-line text-center">
            {weekLabel(workspace.settings.projectStartDate, index + 1).replace(
              " - ",
              "\n",
            )}
          </span>
        ),
        accessorFn: (row) => row.weeks[`W${index + 1}`] ?? 0,
        cell: ({ getValue }) => (
          <span className="block text-right tabular-nums">
            {formatNumber(Number(getValue()), precision)}
          </span>
        ),
      }),
    );
    return [...fixed, ...weekColumns];
  }, [
    canViewRates,
    precision,
    weekCount,
    workspace.settings.projectStartDate,
  ]);

  // TanStack Table intentionally returns a stateful API that React Compiler
  // excludes from memoisation.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: workspace.forecastLines,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  async function uploadForecast(file: File) {
    setLoading(true);
    setErrors([]);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: true,
      });
      const baselineId = crypto.randomUUID();
      const parsed = parseForecastRows(rows, baselineId);
      setErrors(parsed.errors);
      if (!parsed.lines.length) {
        toast.error("No valid forecast lines were found");
        return;
      }
      const sourceStoragePath = await uploadProjectFile(
        projectId,
        "forecast",
        file,
      );
      replaceForecast(
        projectId,
        {
          id: baselineId,
          name: `${file.name.replace(/\.[^.]+$/, "")} · ${new Date().toLocaleDateString("en-AU")}`,
          status: "APPROVED",
          sourceFileName: file.name,
          sourceStoragePath,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid ?? "",
          active: true,
        },
        parsed.lines,
      );
      toast.success(
        `Loaded ${parsed.lines.length} resources across ${parsed.numberOfWeeks} weeks`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to read forecast file",
      );
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function downloadTemplate() {
    const row: Record<string, string | number> = {
      Stream: "Functional",
      Role: "Consultant",
      Code: "CG01",
      Name: "Example Resource",
      Location: "ANZ",
      "Day Rate": 1500,
      "Contract Effort Days": 10,
      "Contract Total": 15000,
      "Planned Start Date": workspace.settings.projectStartDate,
      "Planned End Date": workspace.settings.projectStartDate,
    };
    for (let week = 1; week <= workspace.settings.numberOfWeeks; week += 1) {
      row[`W${week}`] = week <= 2 ? 5 : 0;
    }
    const sheet = XLSX.utils.json_to_sheet([row]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Forecast");
    XLSX.writeFile(book, "PTracker_Forecast_Template.xlsx");
  }

  function exportStatusCheck() {
    const rows = workspace.forecastLines.map((line) => ({
      Stream: line.stream,
      Role: line.role,
      Code: line.code,
      Name: line.name,
      Location: line.location,
      ...(canViewRates ? { "Day Rate": line.dayRate } : {}),
      ...line.weeks,
      "Forecast Total": Object.values(line.weeks).reduce(
        (total, days) => total + days,
        0,
      ),
    }));
    const book = XLSX.utils.book_new();
    for (let start = 0; start < weekCount; start += 30) {
      const end = Math.min(weekCount, start + 30);
      const chunk = rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([key]) =>
              !/^W\d+$/.test(key) ||
              (Number(key.slice(1)) > start && Number(key.slice(1)) <= end),
          ),
        ),
      );
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(chunk),
        `W${start + 1}-W${end}`,
      );
    }
    XLSX.writeFile(
      book,
      `${project?.code ?? "Project"}_Forecast_Status_Check.xlsx`,
    );
  }

  if (!canViewRates) {
    return (
      <>
        <PageHeader
          eyebrow={project?.code}
          title="Forecast"
          description="Approved commercial baselines and resource rates."
        />
        <Card>
          <CardContent>
            <EmptyState
              icon={LockKeyhole}
              title="Forecast access is restricted"
              description="Customer viewers use customer-safe reports and cannot read internal rate or cost collections. This restriction is also enforced by Firestore Security Rules."
            />
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={project?.code}
        title="Forecast baseline"
        description="Load a versioned resource forecast. Approved baselines are immutable; replacements create a new traceable version."
        actions={
          <>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />
              Template
            </Button>
            <Button
              variant="outline"
              onClick={exportStatusCheck}
              disabled={!workspace.forecastLines.length}
            >
              <FileCheck2 className="h-4 w-4" />
              Status Check
            </Button>
            {canLoad ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadForecast(file);
                  }}
                />
                <Button
                  variant="accent"
                  disabled={loading}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {loading ? "Loading…" : "Load new baseline"}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {activeBaseline ? (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-[#e2f4ee] p-2 text-[#16875f]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-[#758397]">
                  Active baseline
                </p>
                <p className="text-sm font-bold">{activeBaseline.name}</p>
              </div>
            </div>
            <Badge tone="success">{activeBaseline.status}</Badge>
            <span className="text-xs text-[#758397]">
              Source: {activeBaseline.sourceFileName}
            </span>
            <span className="text-xs text-[#758397]">
              {workspace.forecastLines.length} resources · {weekCount} weeks
            </span>
          </CardContent>
        </Card>
      ) : null}

      {errors.length ? (
        <Card className="mb-5 border-[#f2c8ce] bg-[#fff8f9]">
          <CardHeader>
            <h2 className="text-sm font-bold text-[#a62b3b]">
              {errors.length} row warning{errors.length === 1 ? "" : "s"}
            </h2>
          </CardHeader>
          <CardContent>
            <ul className="max-h-36 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-[#8c3b46]">
              {errors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        {workspace.forecastLines.length ? (
          <div className="scrollbar-thin max-h-[68vh] overflow-auto">
            <table className="min-w-max border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-[#0b1f3a] text-white">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => (
                      <th
                        key={header.id}
                        className={`border-r border-white/10 px-3 py-3 text-left font-semibold ${
                          index < 5 ? "sticky z-30 bg-[#0b1f3a]" : ""
                        }`}
                        style={
                          index < 5
                            ? { left: [0, 120, 260, 340, 500][index] }
                            : undefined
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={rowIndex % 2 ? "bg-[#f8fafc]" : "bg-white"}
                  >
                    {row.getVisibleCells().map((cell, index) => (
                      <td
                        key={cell.id}
                        className={`border-b border-r border-[#e3e9f0] px-3 py-2.5 ${
                          index < 5
                            ? `sticky z-10 ${rowIndex % 2 ? "bg-[#f8fafc]" : "bg-white"}`
                            : ""
                        }`}
                        style={
                          index < 5
                            ? {
                                left: [0, 120, 260, 340, 500][index],
                                minWidth: [120, 140, 80, 160, 85][index],
                              }
                            : { minWidth: 74 }
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent>
            <EmptyState
              icon={FileSpreadsheet}
              title="No forecast baseline loaded"
              description="Download the template, populate the required columns and W1…Wn values, then load it to create the first locked baseline."
              action={
                canLoad ? (
                  <Button variant="accent" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Load forecast
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}
