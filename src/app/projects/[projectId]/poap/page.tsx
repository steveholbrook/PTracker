import { PoapPage } from "@/modules/poap/poap-page";

export default async function PoapRoute({
  params,
}: PageProps<"/projects/[projectId]/poap">) {
  const { projectId } = await params;
  return <PoapPage projectId={projectId} />;
}

