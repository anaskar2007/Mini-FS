"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type DirectoryEntry, type FileSystemState, listDirectory } from "@/lib/fs";

interface DeleteFolderDialogProps {
  open: boolean;
  state: FileSystemState;
  target: DirectoryEntry | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteFolderDialog({ open, state, target, onCancel, onConfirm }: DeleteFolderDialogProps) {
  const contents = useMemo(() => {
    if (!target) return { files: 0, folders: 0 };
    let fileCount = 0;
    let folderCount = 0;
    function collect(id: string) {
      const listing = listDirectory(state, id);
      folderCount += listing.directories.length;
      fileCount += listing.files.length;
      for (const child of listing.directories) {
        collect(child.id);
      }
    }
    collect(target.id);
    return { files: fileCount, folders: folderCount };
  }, [state, target]);

  if (!open || !target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg animate-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold text-destructive">Delete Folder</h2>
        <p className="mt-2 text-sm text-foreground">
          Are you sure you want to delete <span className="font-semibold">{target.name}</span>?
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently delete this folder and all of its contents.
        </p>
        {(contents.files > 0 || contents.folders > 0) && (
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {contents.files > 0 && <li>{contents.files} file{contents.files === 1 ? "" : "s"}</li>}
            {contents.folders > 0 && <li>{contents.folders} subfolder{contents.folders === 1 ? "" : "s"}</li>}
          </ul>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
