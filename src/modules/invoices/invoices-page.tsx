"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  LockKeyhole,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Input, Label, Select, Textarea } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import type { Invoice, InvoiceStatus } from "@/types/domain";
import { formatCurrency, monthLabel } from "@/utils/dates";
import {
  calculateInvoice,
  nextInvoiceNumber,
  poSummary,
  unavailableInvoiceWeeks,
} from "@/utils/invoices";
import { can } from "@/utils/permissions";

const statusLabels: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  PM_REVIEWED: "PM Reviewed",
  FINANCE_REVIEWED: "Finance Reviewed",
  SENT_TO_CUSTOMER: "Sent To Customer",
  PAID: "Paid",
};

const statusOrder: InvoiceStatus[] = [
  "DRAFT",
  "PM_REVIEWED",
  "FINANCE_REVIEWED",
  "SENT_TO_CUSTOMER",
  "PAID",
];

function invoiceTone(status: InvoiceStatus) {
  if (status === "PAID") return "success" as const;
  if (status === "SENT_TO_CUSTOMER") return "blue" as const;
  if (status === "FINANCE_REVIEWED") return "warning" as const;
  return "neutral" as const;
}

export function InvoicesPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { project, workspace, role } = useProject(projectId);
  const upsertInvoice = useAppStore((state) => state.upsertInvoice);
  const deleteInvoice = useAppStore((state) => state.deleteInvoice);
  const addCreditNote = useAppStore((state) => state.addCreditNote);
  const canCreate = can(role, "CREATE_INVOICE");
  const canApprove = can(role, "APPROVE_INVOICE");
  const canViewRates = can(role, "VIEW_INTERNAL_RATES");
  const codes = [...new Set(workspace.actualResources.map((item) => item.code))];
  const [code, setCode] = useState(codes[0] ?? "");
  const [periodType, setPeriodType] = useState<"WEEKS" | "MONTHS">("WEEKS");
  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(1);
  const [creditInvoiceId, setCreditInvoiceId] = useState<string>();
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState("");
  const unavailable = unavailableInvoiceWeeks(workspace.invoices, code);
  const calculation = useMemo(
    () =>
      calculateInvoice({
        code,
        startWeek,
        endWeek,
        actualEntries: workspace.actualEntries,
        actualResources: workspace.actualResources,
        forecastLines: workspace.forecastLines,
      }),
    [
      code,
      endWeek,
      startWeek,
      workspace.actualEntries,
      workspace.actualResources,
      workspace.forecastLines,
    ],
  );
  const selectedCrossesUnavailable = Array.from(
    { length: Math.max(0, endWeek - startWeek + 1) },
    (_, index) => startWeek + index,
  ).some((week) => unavailable.has(week));
  const po = workspace.purchaseOrders.find((item) => item.code === code);
  const poPosition = poSummary(
    po,
    workspace.invoices.filter((invoice) => invoice.code === code),
    workspace.creditNotes
      .filter((credit) =>
        workspace.invoices.some(
          (invoice) =>
            invoice.id === credit.invoiceId && invoice.code === code,
        ),
      )
      .reduce((total, credit) => total + credit.amount, 0),
  );
  const proposedRemaining = poPosition.remainingPo - calculation.amount;
  const firstMonth = monthLabel(
    workspace.settings.projectStartDate,
    startWeek,
  );
  const lastMonth = monthLabel(workspace.settings.projectStartDate, endWeek);
  const periodName =
    periodType === "WEEKS"
      ? startWeek === endWeek
        ? `W${startWeek}`
        : `W${startWeek}–W${endWeek}`
      : firstMonth === lastMonth
        ? firstMonth
        : `${firstMonth.split(" ")[0]}–${lastMonth}`;

  function saveInvoice() {
    if (!code || selectedCrossesUnavailable || endWeek < startWeek) return;
    const id = crypto.randomUUID();
    const invoice: Invoice = {
      id,
      invoiceNumber: nextInvoiceNumber(
        workspace.settings.invoicePattern,
        code,
        workspace.invoices,
        new Date().getFullYear(),
      ),
      code,
      periodType,
      startWeek,
      endWeek,
      periodName,
      actualDays: calculation.actualDays,
      forecastDays: calculation.forecastDays,
      amount: calculation.amount,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      createdBy: user?.uid ?? "",
      evidencePack: {
        baselineId:
          workspace.settings.activeForecastBaselineId ??
          workspace.forecastBaselines.find((baseline) => baseline.active)?.id,
        resources: calculation.resources,
        forecastDays: calculation.forecastDays,
        actualDays: calculation.actualDays,
        amount: calculation.amount,
        capturedAt: new Date().toISOString(),
      },
    };
    upsertInvoice(projectId, invoice);
    toast.success(
      `${invoice.invoiceNumber} saved; covered actual periods are now locked`,
    );
  }

  function updateStatus(invoice: Invoice, status: InvoiceStatus) {
    if (
      (status === "FINANCE_REVIEWED" || status === "SENT_TO_CUSTOMER") &&
      !canApprove
    ) {
      toast.error("Finance approval permission is required");
      return;
    }
    upsertInvoice(projectId, { ...invoice, status });
    toast.success(`${invoice.invoiceNumber} moved to ${statusLabels[status]}`);
  }

  function saveCreditNote(event: React.FormEvent) {
    event.preventDefault();
    if (!creditInvoiceId || creditAmount <= 0 || !creditReason.trim()) return;
    const invoice = workspace.invoices.find(
      (item) => item.id === creditInvoiceId,
    );
    if (!invoice || creditAmount > invoice.amount) {
      toast.error("Credit amount cannot exceed the original invoice");
      return;
    }
    addCreditNote(projectId, {
      id: crypto.randomUUID(),
      invoiceId: invoice.id,
      number: `CN-${invoice.invoiceNumber}-${workspace.creditNotes.length + 1}`,
      amount: creditAmount,
      reason: creditReason.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.uid ?? "",
    });
    setCreditInvoiceId(undefined);
    setCreditAmount(0);
    setCreditReason("");
    toast.success("Credit note created without altering invoice history");
  }

  if (!canViewRates) {
    return (
      <>
        <PageHeader
          eyebrow={project?.code}
          title="Invoices"
          description="Internal invoicing, rate and purchase order controls."
        />
        <Card>
          <CardContent>
            <EmptyState
              icon={LockKeyhole}
              title="Invoice access is restricted"
              description="Customer viewers cannot read invoice values, resource rates or purchase order balances. Approved customer documents are shared through customer-safe reports."
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
        title="Invoices and purchase orders"
        description="Create evidence-backed invoices from actual effort, prevent duplicate periods and keep the PO position visible before approval."
      />

      {canCreate ? (
        <Card className="mb-5">
          <CardHeader>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Plus className="h-4 w-4 text-[#0e91a1]" />
                New invoice
              </h2>
              <p className="mt-1 text-xs text-[#758397]">
                Saving an invoice locks all actual cells covered by its code and
                period.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <Label htmlFor="invoice-code">Project Code</Label>
                <Select
                  id="invoice-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setStartWeek(1);
                    setEndWeek(1);
                  }}
                >
                  {codes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="period-type">Period Type</Label>
                <Select
                  id="period-type"
                  value={periodType}
                  onChange={(event) =>
                    setPeriodType(event.target.value as "WEEKS" | "MONTHS")
                  }
                >
                  <option value="WEEKS">Weeks</option>
                  <option value="MONTHS">Months</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice-start">Invoice Start</Label>
                <Select
                  id="invoice-start"
                  value={startWeek}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setStartWeek(value);
                    setEndWeek(Math.max(endWeek, value));
                  }}
                >
                  {Array.from(
                    { length: workspace.settings.numberOfWeeks },
                    (_, index) => index + 1,
                  ).map((week) => (
                    <option
                      key={week}
                      value={week}
                      disabled={unavailable.has(week)}
                    >
                      {periodType === "WEEKS"
                        ? `W${week}`
                        : `${monthLabel(workspace.settings.projectStartDate, week)} · W${week}`}
                      {unavailable.has(week) ? " · invoiced" : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="invoice-end">Invoice End</Label>
                <Select
                  id="invoice-end"
                  value={endWeek}
                  onChange={(event) => setEndWeek(Number(event.target.value))}
                >
                  {Array.from(
                    { length: workspace.settings.numberOfWeeks - startWeek + 1 },
                    (_, index) => startWeek + index,
                  ).map((week) => (
                    <option key={week} value={week}>
                      {periodType === "WEEKS"
                        ? `W${week}`
                        : `${monthLabel(workspace.settings.projectStartDate, week)} · W${week}`}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  disabled={
                    !code ||
                    selectedCrossesUnavailable ||
                    !calculation.actualDays
                  }
                  onClick={saveInvoice}
                >
                  <ReceiptText className="h-4 w-4" />
                  Save invoice
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {Array.from(
                { length: workspace.settings.numberOfWeeks },
                (_, index) => index + 1,
              ).map((week) => {
                const selected = week >= startWeek && week <= endWeek;
                const invoiced = unavailable.has(week);
                return (
                  <span
                    key={week}
                    title={`Week ${week}`}
                    className={`flex h-8 w-8 items-center justify-center rounded text-[10px] font-bold ${
                      invoiced
                        ? "bg-[#dfe5eb] text-[#718095]"
                        : selected
                          ? "bg-[#0e91a1] text-white"
                          : "border border-[#dbe3eb] bg-white text-[#758397]"
                    }`}
                  >
                    {week}
                  </span>
                );
              })}
            </div>

            {selectedCrossesUnavailable ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#fff0f2] p-3 text-sm text-[#a62b3b]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                This range crosses an already invoiced period. Choose a continuous
                available range.
              </div>
            ) : periodType === "MONTHS" &&
              (firstMonth !==
                monthLabel(workspace.settings.projectStartDate, startWeek - 1) ||
                lastMonth !==
                  monthLabel(workspace.settings.projectStartDate, endWeek + 1)) ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#fff6e6] p-3 text-sm text-[#8f5e0b]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Monthly selection is represented by weekly source periods. Review
                boundary-week allocation in Actuals before approval.
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Period", periodName],
                ["Actual Days", calculation.actualDays.toFixed(2)],
                ["Forecast Days", calculation.forecastDays.toFixed(2)],
                ["Invoice Amount", formatCurrency(calculation.amount)],
                [
                  "Proposed PO Remaining",
                  formatCurrency(proposedRemaining),
                ],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`rounded-xl border p-4 ${
                    index === 4 && proposedRemaining < 0
                      ? "border-[#edbbc2] bg-[#fff6f7]"
                      : "border-[#e1e7ee] bg-[#f8fafc]"
                  }`}
                >
                  <p className="text-xs text-[#758397]">{label}</p>
                  <p className="mt-1 text-lg font-bold text-[#172033]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {creditInvoiceId ? (
        <Card className="mb-5 border-[#f0d6a4]">
          <CardHeader>
            <h2 className="text-sm font-bold">Create credit note</h2>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={saveCreditNote}
              className="grid gap-4 md:grid-cols-[180px_1fr_auto]"
            >
              <div>
                <Label htmlFor="credit-amount">Credit Amount</Label>
                <Input
                  id="credit-amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={creditAmount}
                  onChange={(event) => setCreditAmount(Number(event.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="credit-reason">Reason</Label>
                <Textarea
                  id="credit-reason"
                  className="min-h-10"
                  value={creditReason}
                  onChange={(event) => setCreditReason(event.target.value)}
                  required
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">Create credit</Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreditInvoiceId(undefined)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-sm font-bold">Invoice register</h2>
            <p className="mt-1 text-xs text-[#758397]">
              Evidence packs are snapshotted at save and do not change when source
              data changes later.
            </p>
          </div>
        </CardHeader>
        {workspace.invoices.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-[#f4f7fa] text-left text-xs uppercase tracking-[0.08em] text-[#65758b]">
                <tr>
                  {[
                    "Invoice",
                    "Code",
                    "Period",
                    "Actual Days",
                    "Amount",
                    "PO Remaining",
                    "Status",
                    "Actions",
                  ].map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...workspace.invoices]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((invoice) => {
                    const codeInvoices = workspace.invoices.filter(
                      (item) =>
                        item.code === invoice.code &&
                        item.createdAt <= invoice.createdAt,
                    );
                    const position = poSummary(
                      workspace.purchaseOrders.find(
                        (item) => item.code === invoice.code,
                      ),
                      codeInvoices,
                      0,
                    );
                    const locked =
                      invoice.status === "SENT_TO_CUSTOMER" ||
                      invoice.status === "PAID";
                    return (
                      <tr
                        key={invoice.id}
                        className="border-t border-[#e1e7ee]"
                      >
                        <td className="px-4 py-3 font-bold">
                          {invoice.invoiceNumber}
                          <p className="mt-1 text-xs font-normal text-[#8490a0]">
                            {new Date(invoice.createdAt).toLocaleString("en-AU")}
                          </p>
                        </td>
                        <td className="px-4 py-3">{invoice.code}</td>
                        <td className="px-4 py-3">{invoice.periodName}</td>
                        <td className="px-4 py-3">{invoice.actualDays.toFixed(2)}</td>
                        <td className="px-4 py-3 font-semibold">
                          {formatCurrency(invoice.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {formatCurrency(position.remainingPo)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={invoiceTone(invoice.status)}>
                            {locked ? (
                              <LockKeyhole className="mr-1 h-3 w-3" />
                            ) : null}
                            {statusLabels[invoice.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Select
                              aria-label={`Status for ${invoice.invoiceNumber}`}
                              className="w-44"
                              value={invoice.status}
                              disabled={locked || !canCreate}
                              onChange={(event) =>
                                updateStatus(
                                  invoice,
                                  event.target.value as InvoiceStatus,
                                )
                              }
                            >
                              {statusOrder.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              ))}
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Create credit note"
                              disabled={!canCreate}
                              onClick={() => setCreditInvoiceId(invoice.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete draft invoice"
                              disabled={locked || invoice.status !== "DRAFT"}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${invoice.invoiceNumber} and release its actual-period locks?`,
                                  )
                                ) {
                                  deleteInvoice(projectId, invoice.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-[#c43d4f]" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent>
            <EmptyState
              icon={FileText}
              title="No invoices saved"
              description="Select an available code and period above. PTracker calculates the invoice from actual days and resource rates, then snapshots the evidence pack."
            />
          </CardContent>
        )}
      </Card>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {[
          ["PO value", formatCurrency(poPosition.poValue), CircleDollarSign],
          ["Invoiced", formatCurrency(poPosition.invoicedToDate), ReceiptText],
          ["Credits", formatCurrency(poPosition.creditsToDate), RotateCcw],
          [
            "Remaining PO",
            formatCurrency(poPosition.remainingPo),
            poPosition.remainingPo >= 0 ? CheckCircle2 : AlertTriangle,
          ],
        ].map(([label, value, Icon]) => {
          const IconComponent = Icon as typeof CircleDollarSign;
          return (
            <Card key={String(label)}>
              <CardContent className="flex items-center gap-3">
                <span className="rounded-lg bg-[#eaf0f6] p-2 text-[#2c5f8f]">
                  <IconComponent className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-[#758397]">{String(label)}</p>
                  <p className="mt-1 font-bold">{String(value)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
