import { Suspense } from "react";
import { ExplorerWorkspace } from "@/components/explorer/explorer-workspace";
import { PageHeader } from "@/components/layout/page-header";

export default function ExplorerPage() {
  return (
    <>
      <PageHeader
        title="File Explorer"
        description="Browse the simulated filesystem, manage files, and inspect live allocation metadata."
      />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">Loading explorer...</div>}>
        <ExplorerWorkspace />
      </Suspense>
    </>
  );
}
