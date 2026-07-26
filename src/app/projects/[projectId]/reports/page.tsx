import { ReportsPage } from "@/modules/reports/reports-page";

export default async function ReportsRoute({
  params,
}: PageProps<"/projects/[projectId]/reports">) {
  const { projectId } = await params;
  return <ReportsPage projectId={projectId} />;
}

