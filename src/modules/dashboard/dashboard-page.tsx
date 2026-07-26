"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Gauge,
  LineChart as LineChartIcon,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/common/badge";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { Input, Label, Select } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import { can } from "@/utils/permissions";
import {
  calculateDashboardMetrics,
  isLate,
  todayDateString,
} from "@/utils/dashboard";
import {
  formatCurrency,
  formatNumber,
  isMonday,
  monthLabel,
} from "@/utils/dates";
import { calculateCriticalPath } from "@/utils/poap";

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Gauge;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  const tones = {
    blue: "bg-[#e6f0fb] text-[#2769b6]",
    green: "bg-[#def4eb] text-[#127453]",
    amber: "bg-[#fff1d2] text-[#976000]",
    red: "bg-[#fee5e8] text-[#a62b3b]",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[#718095]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#0b1f3a]">
            {value}
          </p>
          <p className="mt-2 text-xs text-[#7c899a]">{helper}</p>
        </div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function DashboardPage({ projectId }: { projectId: string }) {
  const { project, workspace, role } = useProject(projectId);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [dateError, setDateError] = useState("");
  const today = todayDateString();
  const showRates = can(role, "VIEW_INTERNAL_RATES");
  const editable = can(role, "EDIT_SETTINGS");
  const metrics = useMemo(
    () =>
      calculateDashboardMetrics({
        settings: workspace.settings,
        forecastLines: workspace.forecastLines,
        actualEntries: workspace.actualEntries,
        activities: workspace.activities,
        today,
      }),
    [today, workspace],
  );
  const criticalIds = useMemo(
    () =>
      new Set(
        calculateCriticalPath(
          workspace.activities,
          workspace.dependencies,
        )
          .filter((node) => node.critical)
          .map((node) => node.id),
      ),
    [workspace.activities, workspace.dependencies],
  );
  const lateActivities = workspace.activities.filter((activity) =>
    isLate(activity, today),
  );
  const weekly = Array.from(
    { length: workspace.settings.numberOfWeeks },
    (_, index) => {
      const week = index + 1;
      const forecast = workspace.forecastLines.reduce(
        (total, line) => total + (line.weeks[`W${week}`] ?? 0),
        0,
      );
      const actual = workspace.actualEntries
        .filter((entry) => entry.week === week)
        .reduce((total, entry) => total + entry.days, 0);
      return { week: `W${week}`, forecast, actual };
    },
  );
  let cumulativeForecast = 0;
  let cumulativeActual = 0;
  const cumulative = weekly.map((item) => {
    cumulativeForecast += item.forecast;
    cumulativeActual += item.actual;
    return {
      week: item.week,
      forecast: cumulativeForecast,
      actual: cumulativeActual,
    };
  });
  const monthlyMap = new Map<string, { forecast: number; actual: number }>();
  weekly.forEach((item, index) => {
    const month = monthLabel(workspace.settings.projectStartDate, index + 1);
    const current = monthlyMap.get(month) ?? { forecast: 0, actual: 0 };
    current.forecast += item.forecast;
    current.actual += item.actual;
    monthlyMap.set(month, current);
  });
  const monthly = [...monthlyMap.entries()].map(([month, values]) => ({
    month,
    ...values,
  }));
  const forecastHorizon = Math.max(
    1,
    ...workspace.forecastLines.flatMap((line) =>
      Object.keys(line.weeks).map((week) => Number(week.replace("W", ""))),
    ),
    ...workspace.actualEntries.map((entry) => entry.week),
    ...workspace.invoices.map((invoice) => invoice.endWeek),
  );

  return (
    <>
      <PageHeader
        eyebrow={project?.code}
        title="Executive dashboard"
        description="A single control view of delivery progress, forecast, actual effort, earned value and commercial position."
        actions={
          <>
            <Badge tone={metrics.vac >= 0 ? "success" : "danger"}>
              {metrics.vac >= 0 ? "Favourable variance" : "Unfavourable variance"}
            </Badge>
            <Badge tone="blue">
              {workspace.settings.progressSource === "POAP_AUTOMATIC"
                ? "POAP automatic progress"
                : "Manual progress"}
            </Badge>
          </>
        }
      />

      <Card className="mb-5">
        <CardHeader>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#172033]">
              <Settings2 className="h-4 w-4 text-[#0e91a1]" />
              Project controls
            </h2>
            <p className="mt-1 text-xs text-[#758397]">
              Dates are interpreted as local calendar dates; time-zone conversion
              is never applied.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <Label htmlFor="project-start">Project Start Date</Label>
            <Input
              id="project-start"
              type="date"
              value={workspace.settings.projectStartDate}
              disabled={!editable}
              onChange={(event) => {
                if (!isMonday(event.target.value)) {
                  setDateError("Start date must be a Monday");
                  return;
                }
                setDateError("");
                updateSettings(projectId, {
                  projectStartDate: event.target.value,
                });
              }}
            />
            {dateError ? (
              <p className="mt-1 text-xs text-[#c43d4f]">{dateError}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="horizon">Number of Weeks</Label>
            <Input
              id="horizon"
              type="number"
              min={forecastHorizon}
              max={520}
              value={workspace.settings.numberOfWeeks}
              disabled={!editable}
              onChange={(event) =>
                updateSettings(projectId, {
                  numberOfWeeks: Math.max(
                    forecastHorizon,
                    Number(event.target.value),
                  ),
                })
              }
            />
            <p className="mt-1 text-xs text-[#8793a5]">
              Minimum {forecastHorizon} from loaded data
            </p>
          </div>
          <div>
            <Label htmlFor="progress-source">Progress Source</Label>
            <Select
              id="progress-source"
              value={workspace.settings.progressSource}
              disabled={!editable}
              onChange={(event) =>
                updateSettings(projectId, {
                  progressSource: event.target.value as
                    | "POAP_AUTOMATIC"
                    | "MANUAL",
                })
              }
            >
              <option value="POAP_AUTOMATIC">POAP Automatic</option>
              <option value="MANUAL">Manual</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="manual-progress">Manual % Complete</Label>
            <Input
              id="manual-progress"
              type="number"
              min={0}
              max={100}
              value={workspace.settings.manualPercentComplete}
              disabled={
                !editable ||
                workspace.settings.progressSource !== "MANUAL"
              }
              onChange={(event) =>
                updateSettings(projectId, {
                  manualPercentComplete: Number(event.target.value),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="precision">Display Precision</Label>
            <Select
              id="precision"
              value={workspace.settings.displayPrecision}
              disabled={!editable}
              onChange={(event) =>
                updateSettings(projectId, {
                  displayPrecision: event.target.value as
                    | "WHOLE"
                    | "STANDARD"
                    | "FINANCE",
                })
              }
            >
              <option value="WHOLE">Whole days</option>
              <option value="STANDARD">Standard</option>
              <option value="FINANCE">Finance (2 decimals)</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {showRates ? (
          <>
            <MetricCard
              label="Budget at Completion"
              value={formatCurrency(metrics.bac)}
              helper={`${formatNumber(metrics.forecastDaysTotal, workspace.settings.displayPrecision)} forecast days`}
              icon={Banknote}
            />
            <MetricCard
              label="Actual Cost"
              value={formatCurrency(metrics.ac)}
              helper={`Through W${metrics.currentWeek}`}
              icon={TrendingUp}
              tone="amber"
            />
            <MetricCard
              label="Estimate at Completion"
              value={formatCurrency(metrics.eac)}
              helper={`ETC ${formatCurrency(metrics.etc)}`}
              icon={LineChartIcon}
              tone={metrics.eac <= metrics.bac ? "green" : "red"}
            />
            <MetricCard
              label="Variance at Completion"
              value={formatCurrency(metrics.vac)}
              helper={`EV ${formatCurrency(metrics.ev)}`}
              icon={metrics.vac >= 0 ? TrendingUp : TrendingDown}
              tone={metrics.vac >= 0 ? "green" : "red"}
            />
          </>
        ) : (
          <>
            <MetricCard
              label="POAP completion"
              value={`${metrics.effectivePercentComplete.toFixed(1)}%`}
              helper="Customer-safe schedule progress"
              icon={Gauge}
              tone="green"
            />
            <MetricCard
              label="Current week"
              value={`W${metrics.currentWeek}`}
              helper={`${workspace.settings.numberOfWeeks} week horizon`}
              icon={CalendarClock}
            />
            <MetricCard
              label="Activities"
              value={String(workspace.activities.length)}
              helper={`${lateActivities.length} late`}
              icon={CheckCircle2}
              tone={lateActivities.length ? "amber" : "green"}
            />
            <MetricCard
              label="Critical activities"
              value={String(criticalIds.size)}
              helper="Current critical path"
              icon={AlertTriangle}
              tone={criticalIds.size ? "red" : "green"}
            />
          </>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Weekly Forecast vs Actual</h2>
              <p className="mt-1 text-xs text-[#7a8799]">Resource days</p>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="forecast" name="Forecast" fill="#2874d0" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#0e91a1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Cumulative Delivery Burn-up</h2>
              <p className="mt-1 text-xs text-[#7a8799]">Forecast and actual days</p>
            </div>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulative}>
                <defs>
                  <linearGradient id="actualArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0e91a1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0e91a1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Cumulative Forecast"
                  stroke="#2874d0"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Cumulative Actual"
                  stroke="#0e91a1"
                  strokeWidth={2}
                  fill="url(#actualArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Monthly Reconciliation</h2>
              <p className="mt-1 text-xs text-[#7a8799]">
                Weekly source values grouped into calendar months
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf1" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="forecast" name="Forecast" stroke="#2874d0" strokeWidth={2} />
                <Line dataKey="actual" name="Actual" stroke="#0e91a1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-sm font-bold">Schedule attention</h2>
              <p className="mt-1 text-xs text-[#7a8799]">
                Late and critical activities
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.activities
              .filter(
                (activity) =>
                  isLate(activity, today) || criticalIds.has(activity.id),
              )
              .slice(0, 6)
              .map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e1e7ee] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {activity.name}
                    </p>
                    <p className="mt-1 text-xs text-[#7a8799]">
                      Due {activity.endDate}
                    </p>
                  </div>
                  <Badge
                    tone={isLate(activity, today) ? "danger" : "warning"}
                  >
                    {isLate(activity, today) ? "Late" : "Critical"}
                  </Badge>
                </div>
              ))}
            {!lateActivities.length && !criticalIds.size ? (
              <div className="flex items-center gap-2 text-sm text-[#16875f]">
                <CheckCircle2 className="h-4 w-4" />
                No schedule exceptions
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

