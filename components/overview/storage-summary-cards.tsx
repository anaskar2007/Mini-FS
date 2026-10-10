"use client";

import { Database, FileStack, FolderOpen, PieChart } from "lucide-react";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  allocationMethodLabel,
  formatBytes,
  formatPercent,
} from "@/lib/format";

export function StorageSummaryCards() {
  const { state, stats } = useFileSystem();
  const fileCount = Object.keys(state.files).length;
  const folderCount = Object.keys(state.directories).length - 1;

  const cards = [
    {
      title: "Total capacity",
      value: formatBytes(stats.totalCapacityBytes),
      sub: `${stats.totalBlocks} blocks × 1 KiB`,
      icon: Database,
    },
    {
      title: "Used space",
      value: formatBytes(stats.usedCapacityBytes),
      sub: formatPercent(stats.usedBlocks, stats.totalBlocks) + " utilized",
      icon: PieChart,
    },
    {
      title: "Free space",
      value: formatBytes(stats.freeCapacityBytes),
      sub: `${stats.freeBlocks} blocks available`,
      icon: FolderOpen,
    },
    {
      title: "Allocation method",
      value: allocationMethodLabel(state.defaultAllocationMethod),
      sub: `${fileCount} files · ${folderCount} folders`,
      icon: FileStack,
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, value, sub, icon: Icon }) => (
        <Card key={title} size="sm" className="border border-border bg-card shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <Icon className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
