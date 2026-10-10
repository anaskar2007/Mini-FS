"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, AlertCircle, CheckCircle, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import {
  getAcceptAttribute,
  isAllowedMimeType,
  MAX_UPLOAD_BYTES,
} from "@/lib/file-type";
import { uploadUserFile, type UploadProgress } from "@/lib/storage/upload";
import { generateId } from "@/lib/fs";
import { previewAllocation, type FileSystemState } from "@/lib/fs";

interface UploadDialogProps {
  open: boolean;
  folderId: string;
  state: FileSystemState;
  /** Called after a successful upload so the parent can register the file in the filesystem. */
  onUploaded: (params: {
    fileId: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
    storagePath: string;
  }) => void | Promise<void>;
  onClose: () => void;
}

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; progress: UploadProgress }
  | { kind: "success"; name: string; storagePath: string }
  | { kind: "error"; message: string };

export function UploadDialog({ open, state, onUploaded, onClose }: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setUploadState({ kind: "idle" });
    setDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  function validateFile(f: File): string | null {
    if (f.size > MAX_UPLOAD_BYTES) {
      return `File is too large (${formatBytes(f.size)}). Maximum is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
    }
    const mime = f.type || "application/octet-stream";
    if (!isAllowedMimeType(mime)) {
      return `File type "${mime}" is not permitted.`;
    }
    return null;
  }

  function selectFile(f: File) {
    const error = validateFile(f);
    if (error) {
      setUploadState({ kind: "error", message: error });
      setFile(null);
    } else {
      setFile(f);
      setUploadState({ kind: "idle" });
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }

  async function startUpload() {
    if (!file) return;
    const fileId = generateId("file");
    const mime = file.type || "application/octet-stream";

    setUploadState({ kind: "uploading", progress: { loaded: 0, total: file.size, percent: 0 } });

    try {
      const { storagePath } = await uploadUserFile(fileId, file, (progress) => {
        setUploadState({ kind: "uploading", progress });
      });

      // Storage upload succeeded — now call parent to commit filesystem metadata.
      try {
        await onUploaded({ fileId, name: file.name, sizeBytes: file.size, mimeType: mime, storagePath });
        setUploadState({ kind: "success", name: file.name, storagePath });
      } catch (metaErr) {
        // Metadata persistence failed — attempt storage cleanup.
        setUploadState({
          kind: "error",
          message: `File uploaded but metadata could not be saved. Cleaning up…\n${metaErr instanceof Error ? metaErr.message : "Unknown error"}`,
        });
        try {
          const { deleteStorageObject } = await import("@/lib/storage/upload");
          await deleteStorageObject(storagePath);
        } catch {
          // Cleanup best-effort; log but don't block
          console.warn("Storage cleanup after failed metadata save was unsuccessful.");
        }
      }
    } catch (err) {
      setUploadState({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  if (!open) return null;

  const allocationPreview = file
    ? previewAllocation(state, state.defaultAllocationMethod, file.size)
    : null;
  const isUploading = uploadState.kind === "uploading";
  const isDone = uploadState.kind === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upload file"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Upload file</h2>
          <Button variant="ghost" size="icon-xs" onClick={handleClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          {!isDone ? (
            <>
              {/* Drop zone */}
              <div
                className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:border-primary/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              >
                <Upload className="size-8 text-muted-foreground" />
                {file ? (
                  <div className="text-center">
                    <p className="text-sm font-medium truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(file.size)}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop a file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Max {formatBytes(MAX_UPLOAD_BYTES)}</p>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={getAcceptAttribute()}
                  className="sr-only"
                  onChange={onInputChange}
                />
              </div>

              {/* Virtual disk warning */}
              {allocationPreview && !allocationPreview.wouldSucceed && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-400">
                  <HardDrive className="mt-0.5 size-3.5 shrink-0" />
                  <p>
                    {allocationPreview.error?.message ?? "This file cannot be allocated on the current virtual disk."} It will still be stored in Supabase Storage, and will be marked as <strong>not allocated on virtual disk</strong>.
                  </p>
                </div>
              )}

              {/* Progress */}
              {uploadState.kind === "uploading" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading…</span>
                    <span>{uploadState.progress.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${uploadState.progress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {uploadState.kind === "error" && (
                <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <p className="whitespace-pre-wrap">{uploadState.message}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="size-8 text-green-400" />
              <div>
                <p className="text-sm font-medium">
                  {(uploadState as { name: string }).name} uploaded successfully
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The file has been added to this folder.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {isDone ? (
            <>
              <Button variant="outline" onClick={() => { reset(); }} size="sm">Upload another</Button>
              <Button onClick={handleClose} size="sm">Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} size="sm" disabled={isUploading}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!file || isUploading}
                onClick={() => void startUpload()}
              >
                {isUploading ? "Uploading…" : "Upload"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
