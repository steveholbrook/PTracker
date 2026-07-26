import { ForecastPage } from "@/modules/forecast/forecast-page";

export default async function ForecastRoute({
  params,
}: PageProps<"/projects/[projectId]/forecast">) {
  const { projectId } = await params;
  return <ForecastPage projectId={projectId} />;
}

