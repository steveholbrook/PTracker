import { AdminPage } from "@/modules/admin/admin-page";

export default async function AdminRoute({
  params,
}: PageProps<"/projects/[projectId]/admin">) {
  const { projectId } = await params;
  return <AdminPage projectId={projectId} />;
}

