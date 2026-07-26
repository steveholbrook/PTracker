import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp } from "@/firebase/client";

export async function uploadProjectFile(
  projectId: string,
  folder: "forecast" | "actuals" | "reports" | "backups",
  file: File,
) {
  const app = getFirebaseApp();
  if (!app) return undefined;
  const storage = getStorage(app);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `projects/${projectId}/${folder}/${Date.now()}-${safeName}`;
  await uploadBytes(ref(storage, storagePath), file, {
    contentType: file.type || "application/octet-stream",
  });
  return storagePath;
}

