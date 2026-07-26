import { AppShell } from "@/components/app-shell/app-shell";

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  return <AppShell projectId={projectId}>{children}</AppShell>;
}

