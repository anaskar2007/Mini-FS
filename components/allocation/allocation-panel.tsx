"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { FeedbackBanner } from "@/components/fs/feedback-banner";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { allocationMethodLabel, formatBytes } from "@/lib/format";
import {
  contentByteLength,
  createExternalFragmentationDemo,
  freeRunLayout,
  getFileAllocationView,
  internalFragmentationBytes,
  previewAllMethods,
  type AllocationMethod,
  type AllocationPreview,
  type FileAllocationView,
} from "@/lib/fs";
import { cn } from "@/lib/utils";

// ─── Static method reference data ─────────────────────────────────────────────

const METHODS: {
  id: AllocationMethod;
  name: string;
  summary: string;
  access: string;
  accessWhy: string;
  strength: string;
  limitation: string;
  fragmentation: string;
}[] = [
  {
    id: "contiguous",
    name: "Contiguous",
    summary:
      "Each file occupies a consecutive run of disk blocks. The OS records only the start block and the length.",
    access: "Direct: start + offset",
    accessWhy:
      "Because blocks are consecutive, any position is reachable with a single seek.",
    strength: "Fast sequential and random access",
    limitation: "Must find one unbroken free run of the right size",
    fragmentation: "External fragmentation grows as files are created and deleted",
  },
  {
    id: "linked",
    name: "Linked",
    summary:
      "Each block stores a pointer to the next block in the file. Blocks may be scattered anywhere on disk.",
    access: "Sequential: follow next-pointers",
    accessWhy:
      "To reach block n you must read all n−1 previous blocks to discover each pointer.",
    strength: "No contiguous-run requirement; uses separated free blocks",
    limitation:
      "Slow random access; each block loses space to a pointer field",
    fragmentation: "No external fragmentation for the file itself",
  },
  {
    id: "indexed",
    name: "Indexed",
    summary:
      "A dedicated index block lists every data-block address for the file. MiniFS allows one index block (max ⌊blockSize/4⌋ pointers).",
    access: "Direct: read index, then jump to block n",
    accessWhy:
      "The index block acts like a table of contents — any data block address is one lookup away.",
    strength: "Direct access without requiring contiguous space",
    limitation:
      "Requires one extra index block even for small files; bounded file size",
    fragmentation: "No external fragmentation for data blocks",
  },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** A compact horizontal strip of block cells (sky = data, violet = index, muted = other). */
function BlockStrip({
  blockIds,
  indexId,
  label,
}: {
  blockIds: number[];
  indexId?: number | null;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {indexId !== null && indexId !== undefined && (
          <span className="inline-flex items-center justify-center rounded bg-violet-500/80 px-2 py-1 font-mono text-[11px] text-white">
            {indexId}
          </span>
        )}
        {blockIds.map((id, i) => (
          <span key={id} className="flex items-center gap-0.5">
            <span className="inline-flex items-center justify-center rounded bg-sky-500/80 px-2 py-1 font-mono text-[11px] text-white">
              {id}
            </span>
            {i < blockIds.length - 1 && (
              <span className="text-xs text-muted-foreground">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Visual for contiguous allocation: consecutive block run. */
function ContiguousViz({ view }: { view: FileAllocationView }) {
  if (view.dataBlockIds.length === 0)
    return <p className="text-xs text-muted-foreground">No blocks (empty file).</p>;
  const start = view.dataBlockIds[0];
  const end = view.dataBlockIds[view.dataBlockIds.length - 1];
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Consecutive run: blocks {start}–{end}
      </p>
      <BlockStrip blockIds={view.dataBlockIds} />
    </div>
  );
}

/** Visual for linked allocation: chain with next-pointer annotations. */
function LinkedViz({ view }: { view: FileAllocationView }) {
  if (view.linkedChain.length === 0)
    return <p className="text-xs text-muted-foreground">No blocks (empty file).</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Block chain with next-pointers:</p>
      <div className="flex flex-wrap items-center gap-1">
        {view.linkedChain.map((node, i) => (
          <span key={node.blockId} className="flex items-center gap-1">
            <span className="rounded border border-sky-500/40 bg-sky-500/80 px-2 py-1 font-mono text-[11px] text-white">
              {node.blockId}
            </span>
            <span className="text-[10px] text-muted-foreground">
              →{node.nextBlockId !== null ? node.nextBlockId : "null"}
            </span>
            {i < view.linkedChain.length - 1 && (
              <span className="text-xs text-muted-foreground">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Visual for indexed allocation: index block → data blocks. */
function IndexedViz({ view }: { view: FileAllocationView }) {
  if (view.dataBlockIds.length === 0)
    return <p className="text-xs text-muted-foreground">No blocks (empty file).</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="rounded bg-violet-500/80 px-2 py-1.5 font-mono text-[11px] text-white">
            idx {view.indexBlockId}
          </span>
          <span className="text-[10px] text-muted-foreground">index</span>
        </div>
        <span className="mt-2 text-xs text-muted-foreground">→</span>
        <div className="flex flex-wrap gap-1">
          {view.dataBlockIds.map((id) => (
            <div key={id} className="flex flex-col items-center gap-1">
              <span className="rounded bg-sky-500/80 px-2 py-1.5 font-mono text-[11px] text-white">
                {id}
              </span>
              <span className="text-[10px] text-muted-foreground">data</span>
            </div>
          ))}
        </div>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        Index [{view.indexReferences.join(", ")}]
      </p>
    </div>
  );
}

/** Preview card for a single allocation strategy (hypothetical). */
function PreviewCard({ preview }: { preview: AllocationPreview }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/50 p-3 text-sm",
        preview.wouldSucceed
          ? "border-border"
          : "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-medium">{allocationMethodLabel(preview.method)}</p>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            preview.wouldSucceed
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {preview.wouldSucceed ? "Would succeed" : "Would fail"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Needs {preview.requiredDataBlocks} data block
        {preview.requiredDataBlocks !== 1 ? "s" : ""}
        {preview.method === "indexed" && preview.requiredDataBlocks > 0
          ? " + 1 index block"
          : ""}
        {" "}({preview.totalBlocksNeeded} total)
      </p>
      {preview.wouldSucceed ? (
        <p className="mt-2 font-mono text-xs">
          {preview.proposedDataBlockIds.length > 0
            ? preview.proposedDataBlockIds.join(
                preview.method === "contiguous" ? "–" : ", "
              )
            : "(no data blocks)"}
          {preview.proposedIndexBlockId !== null
            ? ` · idx ${preview.proposedIndexBlockId}`
            : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-destructive">
          {preview.error?.message ?? "Allocation would fail."}
        </p>
      )}
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        Preview only — not committed
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AllocationPanel() {
  const { state, setAllocationMethod } = useFileSystem();
  const files = useMemo(
    () => Object.values(state.files).sort((a, b) => a.name.localeCompare(b.name)),
    [state.files]
  );
  const [fileId, setFileId] = useState(files[0]?.id ?? "");
  const [conceptsOpen, setConceptsOpen] = useState(false);

  const selected = state.files[fileId] ?? files[0] ?? null;
  const view = selected ? getFileAllocationView(state, selected.id) : null;
  const previews = selected
    ? previewAllMethods(state, contentByteLength(selected.content))
    : [];

  const fragmentationDemo = useMemo(() => createExternalFragmentationDemo(), []);
  const demoFreeRuns = useMemo(
    () => freeRunLayout(fragmentationDemo.state.disk),
    [fragmentationDemo]
  );

  // Internal fragmentation for the selected file
  const internalFrag =
    selected
      ? internalFragmentationBytes(selected, state.disk.blockSizeBytes)
      : 0;

  return (
    <>
      <PageHeader
        title="Allocation Methods"
        description="Committed layouts come directly from the simulator engine. Previews clone the current free map without touching disk state or Supabase."
      />
      <FeedbackBanner />
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">

        {/* ── Section 1: Method reference cards ──────────────────────────── */}
        <div className="grid gap-3 md:grid-cols-3">
          {METHODS.map((method) => (
            <Card
              key={method.id}
              className="border border-border bg-card shadow-none"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-semibold">
                  {method.name}
                  {state.defaultAllocationMethod === method.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                      Default
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {method.summary}
                </p>
                <dl className="space-y-1.5 text-xs text-muted-foreground">
                  <div>
                    <dt className="inline text-foreground">Access: </dt>
                    <dd className="inline">{method.access}</dd>
                  </div>
                  <div className="rounded bg-muted/60 px-2 py-1 italic">
                    {method.accessWhy}
                  </div>
                  <div>
                    <dt className="inline text-foreground">Advantage: </dt>
                    <dd className="inline">{method.strength}</dd>
                  </div>
                  <div>
                    <dt className="inline text-foreground">Trade-off: </dt>
                    <dd className="inline">{method.limitation}</dd>
                  </div>
                  <div>
                    <dt className="inline text-foreground">Fragmentation: </dt>
                    <dd className="inline">{method.fragmentation}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => void setAllocationMethod(method.id)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {state.defaultAllocationMethod === method.id
                    ? "✓ Default for new files"
                    : "Use for new files"}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Section 2: Committed allocation view ───────────────────────── */}
        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Committed allocation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No files yet. Create one in File Explorer.
              </p>
            ) : (
              <>
                <label className="block max-w-md text-xs text-muted-foreground">
                  File
                  <select
                    className="mt-1.5 h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground dark:bg-input/30"
                    value={selected?.id ?? ""}
                    onChange={(e) => setFileId(e.target.value)}
                  >
                    {files.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} ({allocationMethodLabel(file.allocationMethod)})
                      </option>
                    ))}
                  </select>
                </label>

                {view && (
                  <div className="space-y-4">
                    {/* Stats row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground">Content:</span>{" "}
                        {formatBytes(view.contentSizeBytes)}
                      </span>
                      <span>
                        <span className="text-foreground">Allocated:</span>{" "}
                        {formatBytes(view.allocatedCapacityBytes)}
                      </span>
                      <span>
                        <span className="text-foreground">
                          Internal fragmentation:
                        </span>{" "}
                        {formatBytes(internalFrag)}
                        {internalFrag > 0 && (
                          <span className="ml-1 text-amber-500">
                            (unused space in last data block)
                          </span>
                        )}
                      </span>
                      {view.indexBlockId !== null && (
                        <span>
                          <span className="text-foreground">Index overhead:</span>{" "}
                          {formatBytes(state.disk.blockSizeBytes)} (1 block)
                        </span>
                      )}
                    </div>

                    {/* Graphical visualization */}
                    <div className="rounded-lg border border-border bg-background/50 p-4">
                      {view.method === "contiguous" && (
                        <ContiguousViz view={view} />
                      )}
                      {view.method === "linked" && <LinkedViz view={view} />}
                      {view.method === "indexed" && <IndexedViz view={view} />}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Hypothetical preview ────────────────────────────── */}
        {selected && (
          <Card className="border border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Compare allocation strategies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If a new {formatBytes(selected.sizeBytes)} file were allocated
                right now (without freeing &ldquo;{selected.name}&rdquo;), each strategy
                would behave as shown. This preview clones the current disk
                state and{" "}
                <span className="font-medium text-foreground">
                  does not write to disk or Supabase
                </span>
                .
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {previews.map((preview) => (
                  <PreviewCard key={preview.method} preview={preview} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section 4: Fragmentation sandbox ───────────────────────────── */}
        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              Fragmentation sandbox
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                Isolated example disk
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Explanation */}
            <p className="text-sm text-muted-foreground">
              This is a <span className="font-medium text-foreground">separate</span>,{" "}
              throw-away 8-block disk. It is created once and never changes your
              persisted state. Four blocks are free, but the largest free run is
              only{" "}
              <span className="font-semibold text-foreground">
                {fragmentationDemo.largestFreeRun}
              </span>{" "}
              blocks.
            </p>

            {/* Block grid */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                8-block disk layout
              </p>
              <div className="grid grid-cols-8 gap-1.5 rounded-lg border border-border bg-background/50 p-3">
                {fragmentationDemo.state.disk.blocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      "grid aspect-square place-items-center rounded text-[10px] font-medium",
                      block.occupied
                        ? "bg-sky-500/80 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {block.id}
                  </div>
                ))}
              </div>
            </div>

            {/* Free-run breakdown */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Free-space runs
              </p>
              <div className="flex flex-wrap gap-2">
                {demoFreeRuns.map((run, i) => (
                  <div
                    key={run.start}
                    className="rounded-lg border border-border bg-background/50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">Run {i + 1}:</span>{" "}
                    blocks{" "}
                    {Array.from({ length: run.length }, (_, j) =>
                      run.start + j
                    ).join(", ")}{" "}
                    ({run.length} block{run.length !== 1 ? "s" : ""})
                  </div>
                ))}
              </div>
            </div>

            {/* External fragmentation result */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                External fragmentation — allocating a 3-block file
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium">Contiguous: fails</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Needs {fragmentationDemo.requiredDataBlocks} consecutive
                    blocks. Largest free run is only{" "}
                    {fragmentationDemo.largestFreeRun}.
                  </p>
                  <p className="mt-1 text-xs text-destructive">
                    {fragmentationDemo.contiguous.error?.message}
                  </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Linked: succeeds</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    Uses separated blocks:{" "}
                    {fragmentationDemo.linked.proposedDataBlockIds.join(" → ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Total free blocks:{" "}
                    {fragmentationDemo.state.disk.blocks.filter(
                      (b) => !b.occupied
                    ).length}{" "}
                    — sufficient, just not contiguous.
                  </p>
                </div>
              </div>
            </div>

            {/* Internal fragmentation example */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Internal fragmentation — 1-byte file in a 4-byte block
              </p>
              <div className="rounded-lg border border-border bg-background/50 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex overflow-hidden rounded border border-sky-500/40">
                    <div
                      className="bg-sky-500/80 px-2 py-2 text-[10px] font-medium text-white"
                      style={{ width: "25%" }}
                    >
                      d
                    </div>
                    <div
                      className="flex-1 bg-muted px-2 py-2 text-[10px] text-muted-foreground"
                    >
                      unused
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    1 byte of content in a 4-byte block → 3 bytes wasted
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The entire block is allocated to the file. The 3 unused bytes
                  cannot be used by any other file — this wasted space inside an
                  allocated block is <em>internal fragmentation</em>.
                </p>
              </div>
            </div>

            {/* Definitions */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  External fragmentation:
                </span>{" "}
                Free blocks exist, but they are split into runs that are each too
                small for a contiguous request. Contiguous allocation may fail
                even when total free capacity is sufficient.
              </p>
              <p className="mt-2">
                <span className="font-medium text-foreground">
                  Internal fragmentation:
                </span>{" "}
                A file&apos;s last data block may be only partially filled. The
                unused space inside that block is wasted because blocks are the
                smallest allocation unit. Index-block overhead is separate — it
                is metadata cost, not internal fragmentation.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Section 5: OS Concepts reference ───────────────────────────── */}
        <Card className="border border-border bg-card shadow-none">
          <button
            type="button"
            className="flex w-full items-center justify-between p-6 text-left"
            onClick={() => setConceptsOpen((v) => !v)}
            aria-expanded={conceptsOpen}
          >
            <div className="flex items-center gap-2">
              <Info className="size-4 text-primary opacity-70" />
              <span className="text-base font-semibold">OS concepts reference</span>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                conceptsOpen && "rotate-180"
              )}
            />
          </button>

          {conceptsOpen && (
            <CardContent className="space-y-5 pt-0 text-sm">
              {/* Comparison table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 pr-4 font-medium text-muted-foreground">Property</th>
                      <th className="pb-2 pr-4 font-medium">Contiguous</th>
                      <th className="pb-2 pr-4 font-medium">Linked</th>
                      <th className="pb-2 font-medium">Indexed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      {
                        prop: "Sequential access",
                        c: "Fast",
                        l: "Fast (follow chain)",
                        i: "Fast (read data blocks in order)",
                      },
                      {
                        prop: "Random access",
                        c: "Fast (direct offset)",
                        l: "Slow (walk chain)",
                        i: "Fast (index lookup)",
                      },
                      {
                        prop: "External fragmentation",
                        c: "Yes — grows over time",
                        l: "No",
                        i: "No (data blocks)",
                      },
                      {
                        prop: "Internal fragmentation",
                        c: "Last block only",
                        l: "Last block only",
                        i: "Last data block only",
                      },
                      {
                        prop: "Extra storage overhead",
                        c: "None",
                        l: "Pointer in each block",
                        i: "One index block",
                      },
                      {
                        prop: "Contiguous space needed",
                        c: "Yes (all blocks)",
                        l: "No (1 block at a time)",
                        i: "No (1 block at a time)",
                      },
                    ].map((row) => (
                      <tr key={row.prop}>
                        <td className="py-2 pr-4 text-muted-foreground">{row.prop}</td>
                        <td className="py-2 pr-4">{row.c}</td>
                        <td className="py-2 pr-4">{row.l}</td>
                        <td className="py-2">{row.i}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Concept explanations */}
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">
                    What does a file allocation method do?
                  </p>
                  <p>
                    It determines how the OS maps the logical, sequential bytes
                    of a file to physical (or virtual) disk blocks. The method
                    controls where blocks are placed, how they are found, and
                    how much overhead the OS must maintain.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Why does contiguous allocation need consecutive blocks?
                  </p>
                  <p>
                    The OS stores only the start block and the count. To read
                    byte at offset <em>k</em>, it computes start +
                    ⌊k/blockSize⌋ — a single arithmetic step that requires all
                    blocks to be adjacent.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    How does linked allocation use pointers?
                  </p>
                  <p>
                    Each block&apos;s last few bytes hold the block address of the
                    next block (or a sentinel such as −1). The OS reads block 0,
                    extracts the pointer, reads that block, and so on. Blocks
                    can be anywhere on disk; no contiguous run is needed.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Why does indexed allocation need an index block?
                  </p>
                  <p>
                    The index block is a flat array of block addresses — one
                    entry per data block. Reading data block <em>n</em> means
                    reading index entry <em>n</em> to get its address, then
                    reading that block. This enables direct access without
                    scanning a chain, but every file needs at least one index
                    block even if it contains a single data block.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Free space vs. contiguous availability
                  </p>
                  <p>
                    A disk can have plenty of free blocks but no single free run
                    large enough for a given file. For contiguous allocation
                    this means the request fails even though total free capacity
                    is sufficient — the blocks exist but are scattered (external
                    fragmentation). Linked and indexed allocation are immune
                    because they claim one block at a time from anywhere on disk.
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
