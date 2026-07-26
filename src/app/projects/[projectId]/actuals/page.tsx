import { ActualsPage } from "@/modules/actuals/actuals-page";

export default async function ActualsRoute({
  params,
}: PageProps<"/projects/[projectId]/actuals">) {
  const { projectId } = await params;
  return <ActualsPage projectId={projectId} />;
}

