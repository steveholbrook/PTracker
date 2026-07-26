import { InvoicesPage } from "@/modules/invoices/invoices-page";

export default async function InvoicesRoute({
  params,
}: PageProps<"/projects/[projectId]/invoices">) {
  const { projectId } = await params;
  return <InvoicesPage projectId={projectId} />;
}

