import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseApp } from "@/firebase/client";
import type {
  ActualEntry,
  ActualResource,
  ForecastBaseline,
  ForecastLine,
  Invoice,
  Project,
  ProjectWorkspace,
  SessionUser,
} from "@/types/domain";

export function getDb() {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : undefined;
}

export async function loadUserSystemRole(userId: string) {
  const db = getDb();
  if (!db) return undefined;
  const profile = await getDoc(doc(db, "users", userId));
  return profile.exists() && profile.data().systemRole === "ADMIN"
    ? ("ADMIN" as const)
    : undefined;
}

const workspaceCollections = [
  "members",
  "forecastBaselines",
  "forecastLines",
  "actualResources",
  "actualEntries",
  "fiUploads",
  "poapWorkstreams",
  "poapActivities",
  "poapDependencies",
  "poapBaselines",
  "purchaseOrders",
  "invoices",
  "creditNotes",
  "auditLog",
] as const;

type WorkspaceCollection = (typeof workspaceCollections)[number];

const workspaceKey: Record<WorkspaceCollection, keyof ProjectWorkspace> = {
  members: "members",
  forecastBaselines: "forecastBaselines",
  forecastLines: "forecastLines",
  actualResources: "actualResources",
  actualEntries: "actualEntries",
  fiUploads: "fiUploads",
  poapWorkstreams: "workstreams",
  poapActivities: "activities",
  poapDependencies: "dependencies",
  poapBaselines: "poapBaselines",
  purchaseOrders: "purchaseOrders",
  invoices: "invoices",
  creditNotes: "creditNotes",
  auditLog: "auditLog",
};

export async function loadProjects(userId: string): Promise<Project[]> {
  const db = getDb();
  if (!db) return [];
  const memberships = await getDocs(
    query(
      collectionGroup(db, "members"),
      where("userId", "==", userId),
      limit(200),
    ),
  );
  const projectIds = memberships.docs
    .map((membership) => membership.ref.parent.parent?.id)
    .filter((id): id is string => Boolean(id));
  const projects = await Promise.all(
    projectIds.map((projectId) => getDoc(doc(db, "projects", projectId))),
  );
  return projects
    .filter((project) => project.exists())
    .map((project) => project.data() as Project);
}

export async function loadWorkspace(
  projectId: string,
  emptyWorkspace: ProjectWorkspace,
  userId: string,
): Promise<ProjectWorkspace | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const settingsDoc = await getDoc(
    doc(db, "projects", projectId, "settings", "main"),
  );
  const next: ProjectWorkspace = {
    ...emptyWorkspace,
    settings: settingsDoc.exists()
      ? (settingsDoc.data() as ProjectWorkspace["settings"])
      : emptyWorkspace.settings,
  };
  const member = await getDoc(
    doc(db, "projects", projectId, "members", userId),
  );
  next.members = member.exists()
    ? [member.data() as ProjectWorkspace["members"][number]]
    : [];
  const role = next.members[0]?.role;
  const customerRestricted: WorkspaceCollection[] = [
    "forecastBaselines",
    "forecastLines",
    "actualResources",
    "actualEntries",
    "fiUploads",
    "purchaseOrders",
    "invoices",
    "creditNotes",
  ];
  const collectionsToLoad = workspaceCollections.filter((collectionName) => {
    if (collectionName === "members") return role === "ADMIN";
    if (collectionName === "auditLog")
      return role === "ADMIN" || role === "FINANCE_REVIEWER";
    if (role === "CUSTOMER_VIEWER")
      return !customerRestricted.includes(collectionName);
    return true;
  });
  await Promise.all(
    collectionsToLoad.map(async (collectionName) => {
      const snapshot = await getDocs(
        query(collection(db, "projects", projectId, collectionName), limit(2500)),
      );
      const key = workspaceKey[collectionName];
      Object.assign(next, {
        [key]: snapshot.docs.map((item) => item.data()),
      });
    }),
  );
  if (next.settings.activeForecastBaselineId) {
    next.forecastLines = next.forecastLines.filter(
      (line) => line.baselineId === next.settings.activeForecastBaselineId,
    );
  }
  return next;
}

export async function persistProject(project: Project, member: SessionUser) {
  const db = getDb();
  if (!db) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "projects", project.id), project);
  batch.set(doc(db, "projectRegistry", project.id), project);
  batch.set(doc(db, "projects", project.id, "members", member.uid), {
    userId: member.uid,
    email: member.email,
    displayName: member.displayName,
    role: "ADMIN",
  });
  await batch.commit();
}

export async function persistProjectMetadata(project: Project) {
  const db = getDb();
  if (!db) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "projects", project.id), project);
  batch.set(doc(db, "projectRegistry", project.id), project);
  await batch.commit();
}

export async function persistSettings(
  projectId: string,
  settings: ProjectWorkspace["settings"],
) {
  const db = getDb();
  if (!db) return;
  await setDoc(doc(db, "projects", projectId, "settings", "main"), settings);
}

export async function persistForecastVersion(input: {
  projectId: string;
  baseline: ForecastBaseline;
  lines: ForecastLine[];
  resources: ActualResource[];
  settings: ProjectWorkspace["settings"];
}) {
  const db = getDb();
  if (!db) return;
  const activation = writeBatch(db);
  activation.set(
    doc(
      db,
      "projects",
      input.projectId,
      "forecastBaselines",
      input.baseline.id,
    ),
    input.baseline,
  );
  activation.set(
    doc(db, "projects", input.projectId, "settings", "main"),
    input.settings,
  );
  await activation.commit();
  const values: Array<{
    collectionName: "forecastLines" | "actualResources";
    id: string;
    value: ForecastLine | ActualResource;
  }> = [
    ...input.lines.map((value) => ({
      collectionName: "forecastLines" as const,
      id: value.id,
      value,
    })),
    ...input.resources.map((value) => ({
      collectionName: "actualResources" as const,
      id: value.id,
      value,
    })),
  ];
  for (let index = 0; index < values.length; index += 400) {
    const batch = writeBatch(db);
    values.slice(index, index + 400).forEach((item) =>
      batch.set(
        doc(
          db,
          "projects",
          input.projectId,
          item.collectionName,
          item.id,
        ),
        item.value,
      ),
    );
    await batch.commit();
  }
}

export async function persistInvoiceWithLocks(
  projectId: string,
  invoice: Invoice,
  entries: ActualEntry[],
) {
  const db = getDb();
  if (!db) return;
  const values = entries.filter(
    (entry) => entry.lockedByInvoiceId === invoice.id,
  );
  for (let index = 0; index < Math.max(1, values.length); index += 400) {
    const batch = writeBatch(db);
    if (index === 0)
      batch.set(
        doc(db, "projects", projectId, "invoices", invoice.id),
        invoice,
      );
    values.slice(index, index + 400).forEach((entry) =>
      batch.set(
        doc(db, "projects", projectId, "actualEntries", entry.id),
        entry,
      ),
    );
    await batch.commit();
  }
}

export async function deleteInvoiceAndUnlock(
  projectId: string,
  invoiceId: string,
  entries: ActualEntry[],
) {
  const db = getDb();
  if (!db) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, "projects", projectId, "invoices", invoiceId));
  entries.forEach((entry) =>
    batch.set(
      doc(db, "projects", projectId, "actualEntries", entry.id),
      entry,
    ),
  );
  await batch.commit();
}

export async function persistEntity(
  projectId: string,
  collectionName: WorkspaceCollection,
  entityId: string,
  value: object,
) {
  const db = getDb();
  if (!db) return;
  await setDoc(
    doc(db, "projects", projectId, collectionName, entityId),
    value,
    { merge: false },
  );
}

export async function deleteEntity(
  projectId: string,
  collectionName: WorkspaceCollection,
  entityId: string,
) {
  const db = getDb();
  if (!db) return;
  await deleteDoc(doc(db, "projects", projectId, collectionName, entityId));
}

export async function replaceCollection(
  projectId: string,
  collectionName: WorkspaceCollection,
  values: Array<{ id?: string; code?: string; userId?: string }>,
) {
  const db = getDb();
  if (!db) return;
  const existing = await getDocs(
    query(collection(db, "projects", projectId, collectionName), limit(2500)),
  );
  const operations: Array<() => Promise<void>> = [];
  existing.docs.forEach((item) => {
    operations.push(() => deleteDoc(item.ref));
  });
  values.forEach((value) => {
    const id = value.id ?? value.code ?? value.userId ?? crypto.randomUUID();
    operations.push(() =>
      setDoc(doc(db, "projects", projectId, collectionName, id), value),
    );
  });
  for (let index = 0; index < operations.length; index += 400) {
    await Promise.all(operations.slice(index, index + 400).map((run) => run()));
  }
}

export async function persistFullWorkspace(
  projectId: string,
  workspace: ProjectWorkspace,
) {
  await persistSettings(projectId, workspace.settings);
  await Promise.all(
    workspaceCollections.map((collectionName) => {
      const key = workspaceKey[collectionName];
      return replaceCollection(
        projectId,
        collectionName,
        workspace[key] as Array<{
          id?: string;
          code?: string;
          userId?: string;
        }>,
      );
    }),
  );
}
