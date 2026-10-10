"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEditor } from "@/components/fs/code-editor";
import { isImageFile, isPdfFile, isTextFile } from "@/lib/file-type";
import { formatBytes } from "@/lib/format";
import { getSignedUrl, downloadFile } from "@/lib/storage/upload";
import type { FileEntry } from "@/lib/fs/types";
import { previewAllocation } from "@/lib/fs";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { FilenameDisplay } from "@/components/fs/filename-display";

interface FilePreviewProps {
  file: FileEntry;
  isSaving?: boolean;
  onSave?: (content: string) => void | Promise<void>;
  onClose?: () => void;
}

// ─── Image preview ────────────────────────────────────────────────────────────

function ImagePreview({ file }: { file: FileEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file.storagePath) return;
    getSignedUrl(file.storagePath)
      .then(setUrl)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Preview unavailable."));
  }, [file.storagePath]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      {error ? (
        <ErrorBanner message={error} />
      ) : !url ? (
        <Skeleton className="aspect-video w-full rounded-xl" />
      ) : (
        // Renders as an <img> — never as raw HTML or SVG markup
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={file.name}
          className="max-h-[60vh] w-full rounded-xl border border-border object-contain bg-black/20"
        />
      )}
      <FileMeta file={file} />
      {file.storagePath && url && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void downloadFile(file.storagePath!, file.name)}>
            <Download className="size-3.5" /> Download
          </Button>
          <Button size="sm" variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-3.5" /> Open in tab
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── PDF preview ──────────────────────────────────────────────────────────────

function PdfPreview({ file }: { file: FileEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file.storagePath) return;
    getSignedUrl(file.storagePath)
      .then(setUrl)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Preview unavailable."));
  }, [file.storagePath]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      {error ? (
        <ErrorBanner message={error} />
      ) : !url ? (
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      ) : (
        <iframe
          src={url}
          title={file.name}
          className="h-[60vh] w-full rounded-xl border border-border"
        />
      )}
      <FileMeta file={file} />
      {file.storagePath && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => void downloadFile(file.storagePath!, file.name)}>
          <Download className="size-3.5" /> Download
        </Button>
      )}
    </div>
  );
}

// ─── Unknown binary panel ─────────────────────────────────────────────────────

function BinaryPanel({ file }: { file: FileEntry }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        <FilenameDisplay name={file.name} copyable className="justify-center font-medium text-foreground" />
        <p className="mt-1 text-xs">{file.mimeType ?? "Unknown type"}</p>
        <p className="mt-0.5 text-xs">No preview available for this file type.</p>
      </div>
      <FileMeta file={file} />
      {file.storagePath && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => void downloadFile(file.storagePath!, file.name)}>
          <Download className="size-3.5" /> Download
        </Button>
      )}
    </div>
  );
}

// ─── Shared metadata panel ────────────────────────────────────────────────────

function FileMeta({ file }: { file: FileEntry }) {
  const { state } = useFileSystem();
  
  let unallocatedReason = "Not allocated";
  if (!file.diskAllocated) {
    const preview = previewAllocation(state, file.allocationMethod, file.sizeBytes);
    if (!preview.wouldSucceed && preview.error) {
      unallocatedReason = `Not allocated: ${preview.error.message}`;
    }
  }

  return (
    <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      <dt>Name</dt><dd className="min-w-0 text-foreground"><FilenameDisplay name={file.name} copyable /></dd>
      <dt>Size</dt><dd className="text-foreground">{formatBytes(file.sizeBytes)}</dd>
      <dt>Type</dt><dd className="text-foreground">{file.mimeType ?? "Text"}</dd>
      <dt>Allocation</dt><dd className="text-foreground capitalize">{file.allocationMethod}</dd>
      {!file.diskAllocated && (
        <>
          <dt className="text-amber-400">Virtual disk</dt>
          <dd className="text-amber-400">{unallocatedReason}</dd>
        </>
      )}
    </dl>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

// ─── Main preview router ──────────────────────────────────────────────────────

export function FilePreview({ file, isSaving, onSave, onClose }: FilePreviewProps) {
  const mime = file.mimeType ?? undefined;

  if (isImageFile(file.name, mime)) {
    return <ImagePreview file={file} />;
  }
  if (isPdfFile(file.name, mime)) {
    return <PdfPreview file={file} />;
  }
  if (isTextFile(file.name, mime) || !file.storagePath) {
    // Text files always use the code editor
    return (
      <CodeEditor
        filename={file.name}
        initialContent={file.content}
        isSaving={isSaving}
        onSave={onSave ?? (() => {})}
        onCancel={onClose}
      />
    );
  }
  return <BinaryPanel file={file} />;
}
