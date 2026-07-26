import { DashboardPage } from "@/modules/dashboard/dashboard-page";

export default async function DashboardRoute({
  params,
}: PageProps<"/projects/[projectId]/dashboard">) {
  const { projectId } = await params;
  return <DashboardPage projectId={projectId} />;
}

