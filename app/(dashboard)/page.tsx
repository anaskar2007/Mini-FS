"use client";

import { useFileSystem } from "@/components/fs/file-system-provider";
import { PageHeader } from "@/components/layout/page-header";
import { RecentFilesList } from "@/components/overview/recent-files-list";
import { StorageSummaryCards } from "@/components/overview/storage-summary-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { allocationMethodLabel, formatBytes, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowUpRight, HardDrive } from "lucide-react";

export default function OverviewPage() {
  const { state, stats } = useFileSystem();

  return (
    <>
      <PageHeader
        title="Overview"
        description="Virtual disk snapshot and file system status."
      >
        <Button render={<Link href="/explorer" />} size="sm">Open explorer <ArrowUpRight /></Button>
      </PageHeader>
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">
        <StorageSummaryCards />

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <RecentFilesList />
          </div>
          <Card className="border border-border bg-card shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><HardDrive className="size-4 text-primary" /> Simulator status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs"><span>Storage utilization</span><span className="text-foreground">{formatPercent(stats.usedBlocks, stats.totalBlocks)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${stats.utilizationPercent}%` }} /></div>
                <p className="mt-2 text-xs">{formatBytes(stats.usedCapacityBytes)} used of {formatBytes(stats.totalCapacityBytes)}</p>
              </div>
              <p>
                File and folder operations run in a TypeScript engine with
                contiguous, linked, and indexed allocation. State is persisted
                to Supabase — changes survive page reloads.
              </p>
              <ul className="list-inside list-disc space-y-1.5">
                <li>
                  {stats.totalBlocks} virtual blocks × {stats.blockSizeBytes} B
                </li>
                <li>
                  Default for new files:{" "}
                  <span className="text-foreground">
                    {allocationMethodLabel(state.defaultAllocationMethod)}
                  </span>
                </li>
                <li>
                  {stats.allocatedDataBlockCount} data blocks,{" "}
                  {stats.allocatedIndexBlockCount} index blocks
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
