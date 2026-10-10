"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/format";
import { getRecentFiles } from "@/lib/fs";
import { FilenameDisplay } from "@/components/fs/filename-display";

export function RecentFilesList() {
  const { state } = useFileSystem();
  const files = getRecentFiles(state, 6);

  return (
    <Card className="border border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div><CardTitle className="text-base font-semibold">Recent files</CardTitle><p className="mt-1 text-xs text-muted-foreground">Recently modified items in the simulator</p></div>
        <Link
          href="/explorer"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Open explorer
        </Link>
      </CardHeader>
      <CardContent className="space-y-1 p-0 pb-2">
        {files.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No files yet. Create one in File Explorer.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((file) => {
              const blocks =
                file.dataBlockIds.length + (file.indexBlockId !== null ? 1 : 0);
              return (
                <li key={file.id}>
                  <Link
                    href={`/explorer?fileId=${file.id}`}
                    className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                      <FileText className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <FilenameDisplay name={file.name} className="text-sm font-medium" />
                      <p className="text-xs text-muted-foreground">
                        Modified {formatDate(file.modifiedAt)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </p>
                      <Badge variant="secondary" className="mt-1 font-normal">
                        {blocks} blocks
                      </Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
