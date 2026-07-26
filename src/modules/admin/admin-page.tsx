"use client";

import { useRef, useState } from "react";
import {
  Archive,
  CalendarDays,
  DatabaseBackup,
  Download,
  History,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/common/badge";
import { Button } from "@/components/common/button";
import { Card, CardContent, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Input, Label, Select } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { useProject } from "@/hooks/use-project";
import { useAppStore } from "@/state/app-store";
import type {
  ProjectMember,
  ProjectRole,
  ProjectWorkspace,
} from "@/types/domain";
import { formatCurrency } from "@/utils/dates";
import { roleLabel } from "@/utils/permissions";

const roles: ProjectRole[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "DELIVERY_LEAD",
  "FINANCE_REVIEWER",
  "INTERNAL_VIEWER",
  "CUSTOMER_VIEWER",
];

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPage({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const { project, workspace, role } = useProject(projectId);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setMember = useAppStore((state) => state.setMember);
  const setPurchaseOrder = useAppStore((state) => state.setPurchaseOrder);
  const archiveProject = useAppStore((state) => state.archiveProject);
  const restoreWorkspace = useAppStore((state) => state.restoreWorkspace);
  const resetWorkspace = useAppStore((state) => state.resetWorkspace);
  const addAudit = useAppStore((state) => state.addAudit);
  const restoreRef = useRef<HTMLInputElement>(null);
  const [member, setNewMember] = useState<ProjectMember>({
    userId: "",
    email: "",
    displayName: "",
    role: "INTERNAL_VIEWER",
  });
  const [holiday, setHoliday] = useState("");
  const [poCode, setPoCode] = useState("");
  const [poValue, setPoValue] = useState(0);
  const [resetText, setResetText] = useState("");

  function record(action: string, entity: string, summary: string) {
    if (!user) return;
    addAudit(projectId, {
      id: crypto.randomUUID(),
      userId: user.uid,
      email: user.email,
      projectId,
      timestamp: new Date().toISOString(),
      action,
      entity,
      summary,
      correlationId: crypto.randomUUID(),
    });
  }

  function addMember(event: React.FormEvent) {
    event.preventDefault();
    if (!member.userId.trim() || !member.email.trim()) return;
    setMember(projectId, {
      ...member,
      userId: member.userId.trim(),
      email: member.email.trim().toLowerCase(),
      displayName: member.displayName.trim() || member.email.split("@")[0],
    });
    record("MEMBER_ASSIGNED", "member", `${member.email} assigned ${member.role}`);
    setNewMember({
      userId: "",
      email: "",
      displayName: "",
      role: "INTERNAL_VIEWER",
    });
    toast.success("Project member assigned");
  }

  function addHoliday() {
    if (!holiday || workspace.settings.holidays.includes(holiday)) return;
    updateSettings(projectId, {
      holidays: [...workspace.settings.holidays, holiday].sort(),
    });
    record("SETTINGS_CHANGED", "holidays", `${holiday} added`);
    setHoliday("");
  }

  function addPo(event: React.FormEvent) {
    event.preventDefault();
    if (!poCode.trim() || poValue < 0) return;
    setPurchaseOrder(projectId, {
      code: poCode.trim().toUpperCase(),
      value: poValue,
      description: "Project purchase order",
    });
    record("PO_UPDATED", "purchaseOrder", `${poCode} set to ${poValue}`);
    setPoCode("");
    setPoValue(0);
    toast.success("Purchase order saved");
  }

  async function restoreBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        projectId?: string;
        workspace?: ProjectWorkspace;
      };
      if (
        parsed.projectId !== projectId ||
        !parsed.workspace?.settings ||
        !Array.isArray(parsed.workspace.activities) ||
        !Array.isArray(parsed.workspace.members)
      ) {
        throw new Error("This is not a valid backup for the selected project");
      }
      restoreWorkspace(projectId, parsed.workspace);
      record("PROJECT_RESTORED", "project", `Backup ${file.name} restored`);
      toast.success("Project backup restored");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to restore backup",
      );
    } finally {
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  if (role !== "ADMIN") {
    return (
      <>
        <PageHeader
          eyebrow={project?.code}
          title="Administration"
          description="Project access, configuration and audit controls."
        />
        <Card>
          <CardContent>
            <EmptyState
              icon={LockKeyhole}
              title="Administrator role required"
              description="Only project administrators can change access, purchase orders, customer-safe configuration, backups or destructive controls."
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
        title="Project administration"
        description="Manage access, holidays, commercial controls, backup and the append-only project audit history."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadJson(`${project?.code ?? "Project"}_Backup.json`, {
                  version: "5.0.0",
                  projectId,
                  project,
                  exportedAt: new Date().toISOString(),
                  exportedBy: user?.email,
                  workspace,
                });
                record("PROJECT_BACKUP", "project", "Project backup exported");
              }}
            >
              <Download className="h-4 w-4" />
              Export backup
            </Button>
            <input
              ref={restoreRef}
              className="hidden"
              type="file"
              accept=".json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void restoreBackup(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => restoreRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Restore backup
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Users className="h-4 w-4 text-[#0e91a1]" />
                Project access
              </h2>
              <p className="mt-1 text-xs text-[#758397]">
                User ID must match the Firebase Authentication UID.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={addMember}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor="member-uid">Firebase User UID</Label>
                <Input
                  id="member-uid"
                  value={member.userId}
                  onChange={(event) =>
                    setNewMember({ ...member, userId: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={member.email}
                  onChange={(event) =>
                    setNewMember({ ...member, email: event.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="member-name">Display Name</Label>
                <Input
                  id="member-name"
                  value={member.displayName}
                  onChange={(event) =>
                    setNewMember({
                      ...member,
                      displayName: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="member-role">Project Role</Label>
                <Select
                  id="member-role"
                  value={member.role}
                  onChange={(event) =>
                    setNewMember({
                      ...member,
                      role: event.target.value as ProjectRole,
                    })
                  }
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabel(item)}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" className="sm:col-span-2">
                <Plus className="h-4 w-4" />
                Assign member
              </Button>
            </form>
            <div className="mt-5 space-y-2">
              {workspace.members.map((item) => (
                <div
                  key={item.userId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e1e7ee] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.displayName}
                    </p>
                    <p className="truncate text-xs text-[#758397]">
                      {item.email} · {item.userId}
                    </p>
                  </div>
                  <Select
                    className="w-48"
                    value={item.role}
                    onChange={(event) => {
                      setMember(projectId, {
                        ...item,
                        role: event.target.value as ProjectRole,
                      });
                      record(
                        "ROLE_CHANGED",
                        "member",
                        `${item.email} changed to ${event.target.value}`,
                      );
                    }}
                  >
                    {roles.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {roleLabel(candidate)}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-[#0e91a1]" />
                Project policy
              </h2>
              <p className="mt-1 text-xs text-[#758397]">
                Defaults apply across modules; precision affects display only.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="admin-precision">Default display precision</Label>
              <Select
                id="admin-precision"
                value={workspace.settings.displayPrecision}
                onChange={(event) => {
                  updateSettings(projectId, {
                    displayPrecision: event.target.value as
                      | "WHOLE"
                      | "STANDARD"
                      | "FINANCE",
                  });
                  record(
                    "SETTINGS_CHANGED",
                    "displayPrecision",
                    `Precision changed to ${event.target.value}`,
                  );
                }}
              >
                <option value="WHOLE">Whole days</option>
                <option value="STANDARD">Standard</option>
                <option value="FINANCE">Finance (2 decimals)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="invoice-pattern">Invoice number format</Label>
              <Select
                id="invoice-pattern"
                value={workspace.settings.invoicePattern}
                onChange={(event) => {
                  updateSettings(projectId, {
                    invoicePattern: event.target.value as
                      | "AR_CODE_SEQ"
                      | "AR_CODE_YEAR_SEQ"
                      | "INV_CODE_N",
                  });
                  record(
                    "SETTINGS_CHANGED",
                    "invoicePattern",
                    `Pattern changed to ${event.target.value}`,
                  );
                }}
              >
                <option value="AR_CODE_SEQ">AR-CODE-SEQ</option>
                <option value="AR_CODE_YEAR_SEQ">AR-CODE-YEAR-SEQ</option>
                <option value="INV_CODE_N">INV-CODE-N</option>
              </Select>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-[#e1e7ee] p-4">
              <div>
                <p className="text-sm font-bold">Customer-safe mode</p>
                <p className="mt-1 text-xs text-[#758397]">
                  Hide internal commercial values from customer outputs.
                </p>
              </div>
              <input
                type="checkbox"
                checked={workspace.settings.customerSafeMode}
                onChange={(event) => {
                  updateSettings(projectId, {
                    customerSafeMode: event.target.checked,
                  });
                  record(
                    "SETTINGS_CHANGED",
                    "customerSafeMode",
                    `Customer-safe mode ${event.target.checked ? "enabled" : "disabled"}`,
                  );
                }}
                className="h-5 w-5 accent-[#0e91a1]"
              />
            </label>
            <div>
              <Label>Project holidays</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={holiday}
                  onChange={(event) => setHoliday(event.target.value)}
                />
                <Button variant="outline" onClick={addHoliday}>
                  <CalendarDays className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {workspace.settings.holidays.map((item) => (
                  <Badge key={item} tone="neutral">
                    {item}
                    <button
                      className="ml-2 text-[#c43d4f]"
                      onClick={() =>
                        updateSettings(projectId, {
                          holidays: workspace.settings.holidays.filter(
                            (candidate) => candidate !== item,
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Save className="h-4 w-4 text-[#0e91a1]" />
                Purchase order register
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={addPo}
              className="grid gap-3 sm:grid-cols-[140px_1fr_auto]"
            >
              <div>
                <Label htmlFor="po-code">Code</Label>
                <Input
                  id="po-code"
                  value={poCode}
                  onChange={(event) => setPoCode(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="po-value">PO value</Label>
                <Input
                  id="po-value"
                  type="number"
                  min={0}
                  value={poValue}
                  onChange={(event) => setPoValue(Number(event.target.value))}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit">Save PO</Button>
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {workspace.purchaseOrders.map((po) => (
                <div
                  key={po.code}
                  className="flex items-center justify-between rounded-lg border border-[#e1e7ee] p-3"
                >
                  <div>
                    <p className="font-bold">{po.code}</p>
                    <p className="text-xs text-[#758397]">{po.description}</p>
                  </div>
                  <p className="font-bold">{formatCurrency(po.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <DatabaseBackup className="h-4 w-4 text-[#c43d4f]" />
                Protected operations
              </h2>
              <p className="mt-1 text-xs text-[#758397]">
                These actions require an exact typed confirmation.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-[#edc4ca] bg-[#fff8f9] p-4">
              <p className="text-sm font-bold text-[#a62b3b]">
                Reset project data
              </p>
              <p className="mt-1 text-xs leading-5 text-[#82545b]">
                Forecast, actuals, POAP, invoices and audit entries are removed.
                Settings and access membership are preserved.
              </p>
              <div className="mt-3 flex gap-2">
                <Input
                  value={resetText}
                  onChange={(event) => setResetText(event.target.value)}
                  placeholder={`Type ${project?.code}`}
                />
                <Button
                  variant="danger"
                  disabled={resetText !== project?.code}
                  onClick={() => {
                    resetWorkspace(projectId);
                    setResetText("");
                    toast.success("Project data reset");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!project) return;
                archiveProject(projectId, !project.archived);
                record(
                  "PROJECT_ARCHIVED",
                  "project",
                  `Project ${project.archived ? "restored" : "archived"}`,
                );
              }}
            >
              <Archive className="h-4 w-4" />
              {project?.archived ? "Restore project" : "Archive project"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4 text-[#0e91a1]" />
              Audit history
            </h2>
            <p className="mt-1 text-xs text-[#758397]">
              Append-only actions, newest first.
            </p>
          </div>
          <Badge tone="blue">{workspace.auditLog.length} entries</Badge>
        </CardHeader>
        {workspace.auditLog.length ? (
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[850px] text-xs">
              <thead className="sticky top-0 bg-[#f4f7fa] text-left uppercase tracking-[0.08em] text-[#65758b]">
                <tr>
                  {["Timestamp", "User", "Action", "Entity", "Summary", "Correlation"].map(
                    (header) => (
                      <th key={header} className="px-4 py-3">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[...workspace.auditLog]
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .map((entry) => (
                    <tr key={entry.id} className="border-t border-[#e1e7ee]">
                      <td className="px-4 py-3">
                        {new Date(entry.timestamp).toLocaleString("en-AU")}
                      </td>
                      <td className="px-4 py-3">{entry.email}</td>
                      <td className="px-4 py-3 font-semibold">{entry.action}</td>
                      <td className="px-4 py-3">{entry.entity}</td>
                      <td className="px-4 py-3">{entry.summary}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[#758397]">
                        {entry.correlationId}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent>
            <EmptyState
              icon={RotateCcw}
              title="Audit history is empty"
              description="Production writes and generated reports append user, action, timestamp and correlation evidence here."
            />
          </CardContent>
        )}
      </Card>
    </>
  );
}

