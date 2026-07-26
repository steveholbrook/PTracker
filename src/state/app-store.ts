"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  deleteEntity,
  deleteInvoiceAndUnlock,
  loadProjects,
  loadWorkspace,
  persistEntity,
  persistFullWorkspace,
  persistForecastVersion,
  persistInvoiceWithLocks,
  persistProject,
  persistProjectMetadata,
  persistSettings,
} from "@/firebase/firestore";
import {
  demoProjects,
  demoWorkspaces,
  emptyWorkspace,
  forecastToActualResource,
} from "@/state/demo-data";
import type {
  ActualEntry,
  ActualResource,
  AuditEntry,
  FiUpload,
  ForecastBaseline,
  ForecastLine,
  Invoice,
  CreditNote,
  PoapActivity,
  PoapBaseline,
  PoapDependency,
  Project,
  ProjectMember,
  ProjectSettings,
  ProjectWorkspace,
  PurchaseOrder,
  SessionUser,
  Workstream,
} from "@/types/domain";

type AppState = {
  projects: Project[];
  workspaces: Record<string, ProjectWorkspace>;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  refreshFromFirebase: (userId: string) => Promise<void>;
  createProject: (project: Project, user: SessionUser) => void;
  updateSettings: (
    projectId: string,
    settings: Partial<ProjectSettings>,
  ) => void;
  replaceForecast: (
    projectId: string,
    baseline: ForecastBaseline,
    lines: ForecastLine[],
  ) => void;
  upsertActuals: (
    projectId: string,
    resources: ActualResource[],
    entries: ActualEntry[],
    upload?: FiUpload,
  ) => void;
  addWorkstream: (projectId: string, workstream: Workstream) => void;
  updateWorkstream: (
    projectId: string,
    workstreamId: string,
    update: Partial<Workstream>,
  ) => void;
  deleteWorkstream: (projectId: string, workstreamId: string) => void;
  upsertActivity: (projectId: string, activity: PoapActivity) => void;
  setActivities: (projectId: string, activities: PoapActivity[]) => void;
  deleteActivity: (projectId: string, activityId: string) => void;
  addDependency: (projectId: string, dependency: PoapDependency) => void;
  deleteDependency: (projectId: string, dependencyId: string) => void;
  addPoapBaseline: (projectId: string, baseline: PoapBaseline) => void;
  upsertInvoice: (projectId: string, invoice: Invoice) => void;
  deleteInvoice: (projectId: string, invoiceId: string) => void;
  addCreditNote: (projectId: string, creditNote: CreditNote) => void;
  setPurchaseOrder: (projectId: string, purchaseOrder: PurchaseOrder) => void;
  setMember: (projectId: string, member: ProjectMember) => void;
  addAudit: (projectId: string, audit: AuditEntry) => void;
  archiveProject: (projectId: string, archived: boolean) => void;
  restoreWorkspace: (projectId: string, workspace: ProjectWorkspace) => void;
  resetWorkspace: (projectId: string) => void;
};

function updateWorkspace(
  state: AppState,
  projectId: string,
  updater: (workspace: ProjectWorkspace) => ProjectWorkspace,
) {
  const current = state.workspaces[projectId] ?? structuredClone(emptyWorkspace);
  return {
    workspaces: {
      ...state.workspaces,
      [projectId]: updater(current),
    },
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: demoProjects,
      workspaces: demoWorkspaces,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      refreshFromFirebase: async (userId) => {
        const projects = await loadProjects(userId);
        if (!projects.length) return;
        const workspaces: Record<string, ProjectWorkspace> = {};
        await Promise.all(
          projects.map(async (project) => {
            workspaces[project.id] =
              (await loadWorkspace(
                project.id,
                structuredClone(emptyWorkspace),
                userId,
              )) ??
              structuredClone(emptyWorkspace);
          }),
        );
        set({ projects, workspaces });
      },
      createProject: (project, user) => {
        set((state) => ({
          projects: [...state.projects, project],
          workspaces: {
            ...state.workspaces,
            [project.id]: {
              ...structuredClone(emptyWorkspace),
              members: [
                {
                  userId: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  role: "ADMIN",
                },
              ],
            },
          },
        }));
        void persistProject(project, user);
        void persistSettings(project.id, emptyWorkspace.settings);
      },
      updateSettings: (projectId, settings) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            settings: { ...workspace.settings, ...settings },
          })),
        );
        void persistSettings(projectId, {
          ...get().workspaces[projectId].settings,
        });
      },
      replaceForecast: (projectId, baseline, lines) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => {
            const baselines = workspace.forecastBaselines.map((item) => ({
              ...item,
              active: item.id === baseline.id,
            }));
            return {
              ...workspace,
              settings: {
                ...workspace.settings,
                activeForecastBaselineId: baseline.id,
                numberOfWeeks: Math.max(
                  workspace.settings.numberOfWeeks,
                  ...lines.map((line) => Object.keys(line.weeks).length),
                ),
              },
              forecastBaselines: [
                ...baselines.filter((item) => item.id !== baseline.id),
                baseline,
              ],
              forecastLines: lines,
              actualResources: lines.map(forecastToActualResource),
            };
          }),
        );
        const workspace = get().workspaces[projectId];
        void persistForecastVersion({
          projectId,
          baseline,
          lines,
          resources: workspace.actualResources,
          settings: workspace.settings,
        });
      },
      upsertActuals: (projectId, resources, entries, upload) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            actualResources: [
              ...workspace.actualResources.filter(
                (existing) =>
                  !resources.some((resource) => resource.id === existing.id),
              ),
              ...resources,
            ],
            actualEntries: [
              ...workspace.actualEntries.filter(
                (existing) =>
                  !entries.some((entry) => entry.id === existing.id),
              ),
              ...entries,
            ],
            fiUploads: upload ? [...workspace.fiUploads, upload] : workspace.fiUploads,
          })),
        );
        resources.forEach((resource) =>
          void persistEntity(
            projectId,
            "actualResources",
            resource.id,
            resource,
          ),
        );
        entries.forEach((entry) =>
          void persistEntity(projectId, "actualEntries", entry.id, entry),
        );
        if (upload)
          void persistEntity(projectId, "fiUploads", upload.id, upload);
      },
      addWorkstream: (projectId, workstream) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            workstreams: [...workspace.workstreams, workstream],
          })),
        );
        void persistEntity(
          projectId,
          "poapWorkstreams",
          workstream.id,
          workstream,
        );
      },
      updateWorkstream: (projectId, workstreamId, update) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            workstreams: workspace.workstreams.map((workstream) =>
              workstream.id === workstreamId
                ? { ...workstream, ...update }
                : workstream,
            ),
          })),
        );
        const workstream = get().workspaces[projectId].workstreams.find(
          (item) => item.id === workstreamId,
        );
        if (workstream)
          void persistEntity(
            projectId,
            "poapWorkstreams",
            workstreamId,
            workstream,
          );
      },
      deleteWorkstream: (projectId, workstreamId) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            workstreams: workspace.workstreams.filter(
              (workstream) => workstream.id !== workstreamId,
            ),
            activities: workspace.activities.filter(
              (activity) => activity.workstreamId !== workstreamId,
            ),
          })),
        );
        void deleteEntity(projectId, "poapWorkstreams", workstreamId);
      },
      upsertActivity: (projectId, activity) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            activities: [
              ...workspace.activities.filter((item) => item.id !== activity.id),
              activity,
            ],
          })),
        );
        void persistEntity(
          projectId,
          "poapActivities",
          activity.id,
          activity,
        );
      },
      setActivities: (projectId, activities) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            activities,
          })),
        );
        activities.forEach((activity) =>
          void persistEntity(
            projectId,
            "poapActivities",
            activity.id,
            activity,
          ),
        );
      },
      deleteActivity: (projectId, activityId) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            activities: workspace.activities.filter(
              (activity) => activity.id !== activityId,
            ),
            dependencies: workspace.dependencies.filter(
              (dependency) =>
                dependency.predecessorId !== activityId &&
                dependency.successorId !== activityId,
            ),
          })),
        );
        void deleteEntity(projectId, "poapActivities", activityId);
      },
      addDependency: (projectId, dependency) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            dependencies: [...workspace.dependencies, dependency],
          })),
        );
        void persistEntity(
          projectId,
          "poapDependencies",
          dependency.id,
          dependency,
        );
      },
      deleteDependency: (projectId, dependencyId) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            dependencies: workspace.dependencies.filter(
              (dependency) => dependency.id !== dependencyId,
            ),
          })),
        );
        void deleteEntity(projectId, "poapDependencies", dependencyId);
      },
      addPoapBaseline: (projectId, baseline) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            poapBaselines: [
              ...workspace.poapBaselines.map((item) => ({
                ...item,
                active: false,
              })),
              baseline,
            ],
          })),
        );
        void persistEntity(
          projectId,
          "poapBaselines",
          baseline.id,
          baseline,
        );
      },
      upsertInvoice: (projectId, invoice) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => {
            const entries = workspace.actualEntries.map((entry) =>
              entry.code === invoice.code &&
              entry.week >= invoice.startWeek &&
              entry.week <= invoice.endWeek
                ? { ...entry, lockedByInvoiceId: invoice.id }
                : entry,
            );
            return {
              ...workspace,
              invoices: [
                ...workspace.invoices.filter((item) => item.id !== invoice.id),
                invoice,
              ],
              actualEntries: entries,
            };
          }),
        );
        void persistInvoiceWithLocks(
          projectId,
          invoice,
          get().workspaces[projectId].actualEntries,
        );
      },
      deleteInvoice: (projectId, invoiceId) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            invoices: workspace.invoices.filter(
              (invoice) => invoice.id !== invoiceId,
            ),
            actualEntries: workspace.actualEntries.map((entry) =>
              entry.lockedByInvoiceId === invoiceId
                ? { ...entry, lockedByInvoiceId: undefined }
                : entry,
            ),
          })),
        );
        void deleteInvoiceAndUnlock(
          projectId,
          invoiceId,
          get().workspaces[projectId].actualEntries,
        );
      },
      addCreditNote: (projectId, creditNote) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            creditNotes: [...workspace.creditNotes, creditNote],
          })),
        );
        void persistEntity(
          projectId,
          "creditNotes",
          creditNote.id,
          creditNote,
        );
      },
      setPurchaseOrder: (projectId, purchaseOrder) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            purchaseOrders: [
              ...workspace.purchaseOrders.filter(
                (item) => item.code !== purchaseOrder.code,
              ),
              purchaseOrder,
            ],
          })),
        );
        void persistEntity(
          projectId,
          "purchaseOrders",
          purchaseOrder.code,
          purchaseOrder,
        );
      },
      setMember: (projectId, member) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            members: [
              ...workspace.members.filter(
                (item) => item.userId !== member.userId,
              ),
              member,
            ],
          })),
        );
        void persistEntity(projectId, "members", member.userId, member);
      },
      addAudit: (projectId, audit) => {
        set((state) =>
          updateWorkspace(state, projectId, (workspace) => ({
            ...workspace,
            auditLog: [...workspace.auditLog, audit],
          })),
        );
        void persistEntity(projectId, "auditLog", audit.id, audit);
      },
      archiveProject: (projectId, archived) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, archived } : project,
          ),
        }));
        const project = get().projects.find((item) => item.id === projectId);
        if (project) void persistProjectMetadata(project);
      },
      restoreWorkspace: (projectId, workspace) => {
        set((state) => ({
          workspaces: { ...state.workspaces, [projectId]: workspace },
        }));
        void persistFullWorkspace(projectId, workspace);
      },
      resetWorkspace: (projectId) => {
        const current = get().workspaces[projectId];
        const reset: ProjectWorkspace = {
          ...structuredClone(emptyWorkspace),
          settings: current.settings,
          members: current.members,
        };
        set((state) => ({
          workspaces: { ...state.workspaces, [projectId]: reset },
        }));
        void persistFullWorkspace(projectId, reset);
      },
    }),
    {
      name: "ptracker-v5",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        workspaces: state.workspaces,
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);
