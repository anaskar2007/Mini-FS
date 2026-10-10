"use client";

import { useMemo, useState } from "react";
import { BookOpen, HardDrive } from "lucide-react";
import { FeedbackBanner } from "@/components/fs/feedback-banner";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { PageHeader } from "@/components/layout/page-header";
import { allocationMethodLabel, formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

function ownerName(
  files: Record<string, { name: string }>,
  ownerFileId: string | null
): string {
  if (!ownerFileId) return "—";
  return files[ownerFileId]?.name ?? ownerFileId;
}

function blockPositionLabel(
  dataBlockIds: number[],
  indexBlockId: number | null,
  blockId: number
): string {
  const dataIdx = dataBlockIds.indexOf(blockId);
  if (dataIdx !== -1)
    return `Data block ${dataIdx + 1} of ${dataBlockIds.length}`;
  if (indexBlockId !== null && blockId === indexBlockId) return "Index block";
  return "—";
}

// ─── component ────────────────────────────────────────────────────────────────

export function DiskMap() {
  const { state, stats } = useFileSystem();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightFileId, setHighlightFileId] = useState("");

  // Auto-highlight the owning file when a block is selected
  function handleBlockClick(blockId: number) {
    setSelectedId(blockId);
    const block = state.disk.blocks[blockId];
    if (block?.occupied && block.ownerFileId) {
      setHighlightFileId(block.ownerFileId);
    } else if (!block?.occupied) {
      // clicking free block clears file highlight
      setHighlightFileId("");
    }
  }

  const selected =
    selectedId !== null ? state.disk.blocks[selectedId] : undefined;

  const highlightFile = state.files[highlightFileId] ?? null;

  const highlightBlocks = useMemo(() => {
    if (!highlightFile) return new Set<number>();
    return new Set([
      ...highlightFile.dataBlockIds,
      ...(highlightFile.indexBlockId !== null
        ? [highlightFile.indexBlockId]
        : []),
    ]);
  }, [highlightFile]);

  const sortedFiles = useMemo(
    () =>
      Object.values(state.files).sort((a, b) => a.name.localeCompare(b.name)),
    [state.files]
  );

  const legend = [
    { label: "Free", className: "bg-muted" },
    { label: "Data", className: "bg-sky-500/80" },
    { label: "Index", className: "bg-violet-500/80" },
  ];

  const hasOccupied = stats.usedBlocks > 0;

  // Content preview for selected block
  const contentPreview =
    selectedId !== null && state.disk.blockPayload[selectedId] !== undefined
      ? state.disk.blockPayload[selectedId].slice(0, 40) || "(empty payload)"
      : null;

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="Disk Blocks"
        description="Simulated virtual disk — not a host OS volume. Click a block to inspect its occupancy, owner, and allocation metadata."
      />
      <FeedbackBanner />
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total blocks", value: String(stats.totalBlocks) },
            {
              label: "Block size",
              value: formatBytes(stats.blockSizeBytes),
            },
            { label: "Used blocks", value: String(stats.usedBlocks) },
            { label: "Free blocks", value: String(stats.freeBlocks) },
            { label: "Capacity", value: formatBytes(stats.totalCapacityBytes) },
            {
              label: "Utilization",
              value: `${stats.utilizationPercent}%`,
              highlight: stats.utilizationPercent > 80,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  "highlight" in item && item.highlight
                    ? "text-destructive"
                    : ""
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Utilization bar ─────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Storage utilization</span>
            <span>
              {formatBytes(stats.usedCapacityBytes)} used /{" "}
              {formatBytes(stats.totalCapacityBytes)} total
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${stats.utilizationPercent}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {stats.allocatedDataBlockCount} data block
              {stats.allocatedDataBlockCount !== 1 ? "s" : ""}
            </span>
            <span>
              {stats.allocatedIndexBlockCount} index block
              {stats.allocatedIndexBlockCount !== 1 ? "s" : ""}
            </span>
            <span>
              {stats.contiguousFragmentationPercent}% contiguous-space
              fragmentation
            </span>
          </div>
        </div>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground">
          {legend.map((item) => (
            <span key={item.label} className="flex items-center gap-2">
              <span
                className={cn(
                  "size-3 rounded-sm border border-border",
                  item.className
                )}
              />
              {item.label}
            </span>
          ))}
          <span className="ml-auto italic">
            Click an occupied block to highlight all blocks for that file.
          </span>
        </div>

        {/* ── Block grid ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Virtual block map</p>
              <p className="text-xs text-muted-foreground">
                {state.disk.totalBlocks} blocks ×{" "}
                {formatBytes(state.disk.blockSizeBytes)} each
              </p>
            </div>
            <label className="text-xs text-muted-foreground">
              Highlight file
              <select
                value={highlightFileId}
                onChange={(e) => {
                  setHighlightFileId(e.target.value);
                  setSelectedId(null);
                }}
                className="ml-2 h-8 max-w-48 rounded-lg border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="">None</option>
                {sortedFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!hasOccupied ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <HardDrive className="size-8 opacity-30" />
              <p>All {state.disk.totalBlocks} blocks are free.</p>
              <p className="text-xs">
                Create files in the File Explorer to see blocks get allocated.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
              {state.disk.blocks.map((block) => {
                const isFree = !block.occupied;
                const isIndex = block.kind === "index";
                const isHighlighted = highlightBlocks.has(block.id);
                const isSelected = selectedId === block.id;

                const baseClass = isFree
                  ? "bg-muted text-muted-foreground"
                  : isIndex
                    ? "bg-violet-500/80 text-white"
                    : "bg-sky-500/80 text-white";

                return (
                  <button
                    key={block.id}
                    type="button"
                    title={
                      isFree
                        ? `Block ${block.id} — free`
                        : `Block ${block.id} — ${block.kind} (${ownerName(state.files, block.ownerFileId)})`
                    }
                    onClick={() => handleBlockClick(block.id)}
                    className={cn(
                      "aspect-square rounded-md text-[10px] font-medium tabular-nums transition-all hover:scale-105 hover:opacity-90",
                      baseClass,
                      isSelected &&
                        "ring-2 ring-ring ring-offset-1 ring-offset-background",
                      isHighlighted &&
                        !isSelected &&
                        "ring-2 ring-primary ring-offset-1 ring-offset-card"
                    )}
                  >
                    {block.id}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Block detail panel ─────────────────────────────────────────── */}
        {selected ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Block {selected.id} — {selected.occupied ? "Occupied" : "Free"}
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">State</dt>
                <dd
                  className={
                    selected.occupied ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {selected.occupied ? "Occupied" : "Free"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Kind</dt>
                <dd className="capitalize">{selected.kind ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Owner</dt>
                <dd>{ownerName(state.files, selected.ownerFileId)}</dd>
              </div>
              {selected.ownerFileId && state.files[selected.ownerFileId] && (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Allocation</dt>
                    <dd>
                      {allocationMethodLabel(
                        state.files[selected.ownerFileId].allocationMethod
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 sm:col-span-2">
                    <dt className="text-muted-foreground">Position</dt>
                    <dd>
                      {blockPositionLabel(
                        state.files[selected.ownerFileId].dataBlockIds,
                        state.files[selected.ownerFileId].indexBlockId,
                        selected.id
                      )}
                    </dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Next (linked)</dt>
                <dd>
                  {selected.nextBlockId === null ? "—" : selected.nextBlockId}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Index references</dt>
                <dd className="mt-1 font-mono text-xs">
                  {selected.indexEntries && selected.indexEntries.length > 0
                    ? `[${selected.indexEntries.join(", ")}]`
                    : "—"}
                </dd>
              </div>
              {contentPreview !== null && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Content preview</dt>
                  <dd className="mt-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                    {contentPreview || "(empty)"}
                  </dd>
                </div>
              )}
            </dl>

            {/* Jump-to-file highlight button */}
            {selected.ownerFileId && state.files[selected.ownerFileId] && (
              <button
                type="button"
                onClick={() => setHighlightFileId(selected.ownerFileId!)}
                className="mt-4 text-xs text-primary underline-offset-4 hover:underline"
              >
                Highlight all blocks for “{state.files[selected.ownerFileId!]?.name}”
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
            No block selected. Click any numbered block to inspect its
            occupancy, owner, allocation method, and position within the file.
          </div>
        )}

        {/* ── File block summary strip ────────────────────────────────────── */}
        {highlightFile && (
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <p className="font-medium">{highlightFile.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allocationMethodLabel(highlightFile.allocationMethod)} ·{" "}
              {formatBytes(highlightFile.sizeBytes)} content ·{" "}
              {highlightFile.dataBlockIds.length} data block
              {highlightFile.dataBlockIds.length !== 1 ? "s" : ""}
              {highlightFile.indexBlockId !== null
                ? " + 1 index block"
                : ""}
            </p>

            {highlightFile.dataBlockIds.length > 0 ? (
              <div className="mt-3 space-y-1">
                {/* Data block sequence */}
                <p className="text-xs text-muted-foreground">Data blocks:</p>
                <div className="flex flex-wrap gap-1.5">
                  {highlightFile.dataBlockIds.map((id, i) => (
                    <span key={id} className="flex items-center gap-0.5">
                      <span className="rounded bg-sky-500/80 px-2 py-1 font-mono text-[11px] text-white">
                        {id}
                      </span>
                      {highlightFile.allocationMethod === "linked" &&
                        i < highlightFile.dataBlockIds.length - 1 && (
                          <span className="text-muted-foreground">→</span>
                        )}
                      {highlightFile.allocationMethod === "linked" &&
                        i === highlightFile.dataBlockIds.length - 1 && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            → null
                          </span>
                        )}
                    </span>
                  ))}
                </div>

                {/* Index block reference */}
                {highlightFile.indexBlockId !== null && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      Index block:
                    </p>
                    <span className="rounded bg-violet-500/80 px-2 py-1 font-mono text-[11px] text-white">
                      {highlightFile.indexBlockId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      → [{highlightFile.dataBlockIds.join(", ")}]
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Empty file — no blocks allocated.
              </p>
            )}
          </div>
        )}

        {/* ── Educational callout ─────────────────────────────────────────── */}
        <aside className="rounded-xl border border-border bg-card/30 p-5 text-sm">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-primary opacity-70" />
            <div className="space-y-2 text-muted-foreground">
              <p className="font-medium text-foreground">
                What is a virtual disk block?
              </p>
              <p>
                MiniFS divides its simulated disk into{" "}
                <span className="text-foreground">{state.disk.totalBlocks}</span>{" "}
                fixed-size blocks of{" "}
                <span className="text-foreground">
                  {formatBytes(state.disk.blockSizeBytes)}
                </span>{" "}
                each. Every file must be stored in one or more blocks. A block
                is the smallest unit of allocation — even a 1-byte file consumes
                an entire block (causing <em>internal fragmentation</em>).
              </p>
              <p>
                <span className="text-sky-400">Data blocks</span> hold file
                content.{" "}
                <span className="text-violet-400">Index blocks</span> (indexed
                allocation only) list the addresses of a file&apos;s data blocks.
                When blocks belonging to one file are non-contiguous, contiguous
                allocation fails even if total free space is sufficient — this is{" "}
                <em>external fragmentation</em>.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
