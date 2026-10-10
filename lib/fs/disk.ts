import {
  DEFAULT_DISK_CONFIG,
  type DiskStats,
  type FileEntry,
  type FileSystemState,
  type VirtualDisk,
  type VirtualDiskConfig,
} from "@/lib/fs/types";

export function createVirtualDisk(
  config: Partial<VirtualDiskConfig> = {}
): VirtualDisk {
  const totalBlocks = config.totalBlocks ?? DEFAULT_DISK_CONFIG.totalBlocks;
  const blockSizeBytes =
    config.blockSizeBytes ?? DEFAULT_DISK_CONFIG.blockSizeBytes;

  const blocks = Array.from({ length: totalBlocks }, (_, id) => ({
    id,
    occupied: false,
    ownerFileId: null,
    kind: null,
    nextBlockId: null,
    indexEntries: null,
  }));

  return { totalBlocks, blockSizeBytes, blocks, blockPayload: {} };
}

export function requiredDataBlocks(
  contentByteLength: number,
  blockSizeBytes: number
): number {
  if (contentByteLength <= 0) return 0;
  return Math.ceil(contentByteLength / blockSizeBytes);
}

export function totalBlocksForAllocation(
  method: FileEntry["allocationMethod"],
  dataBlockCount: number
): number {
  if (dataBlockCount === 0) return 0;
  if (method === "indexed") return dataBlockCount + 1;
  return dataBlockCount;
}

export function allocatedCapacityBytes(
  file: FileEntry,
  blockSizeBytes: number
): number {
  const data = file.dataBlockIds.length;
  const index = file.indexBlockId !== null ? 1 : 0;
  return (data + index) * blockSizeBytes;
}

export function getDiskStats(state: FileSystemState): DiskStats {
  const { disk } = state;
  const usedBlocks = disk.blocks.filter((b) => b.occupied).length;
  const freeBlocks = disk.totalBlocks - usedBlocks;
  const totalCapacityBytes = disk.totalBlocks * disk.blockSizeBytes;
  const usedCapacityBytes = usedBlocks * disk.blockSizeBytes;
  const freeCapacityBytes = freeBlocks * disk.blockSizeBytes;
  const utilizationPercent =
    disk.totalBlocks === 0
      ? 0
      : Math.round((usedBlocks / disk.totalBlocks) * 100);

  let allocatedDataBlockCount = 0;
  let allocatedIndexBlockCount = 0;
  for (const block of disk.blocks) {
    if (!block.occupied) continue;
    if (block.kind === "index") allocatedIndexBlockCount += 1;
    else if (block.kind === "data") allocatedDataBlockCount += 1;
  }

  return {
    totalBlocks: disk.totalBlocks,
    usedBlocks,
    freeBlocks,
    blockSizeBytes: disk.blockSizeBytes,
    totalCapacityBytes,
    usedCapacityBytes,
    freeCapacityBytes,
    utilizationPercent,
    allocatedDataBlockCount,
    allocatedIndexBlockCount,
    contiguousFragmentationPercent: computeContiguousFragmentation(disk),
  };
}

/** Higher value when free space is split into many small holes (contiguous stress). */
function computeContiguousFragmentation(disk: VirtualDisk): number {
  const freeRuns: number[] = [];
  let run = 0;
  for (const block of disk.blocks) {
    if (!block.occupied) {
      run += 1;
    } else if (run > 0) {
      freeRuns.push(run);
      run = 0;
    }
  }
  if (run > 0) freeRuns.push(run);

  const freeBlocks = disk.blocks.filter((b) => !b.occupied).length;
  if (freeBlocks === 0 || freeRuns.length <= 1) return 0;

  const largest = Math.max(...freeRuns);
  const wastedFragmentation = freeBlocks - largest;
  return Math.round((wastedFragmentation / freeBlocks) * 100);
}

/**
 * Returns the layout of free-block runs across the disk.
 * Each entry describes a contiguous run of unoccupied blocks.
 * Useful for visualizing external fragmentation.
 */
export function freeRunLayout(
  disk: VirtualDisk
): { start: number; length: number }[] {
  const runs: { start: number; length: number }[] = [];
  let runStart = -1;
  let runLen = 0;
  for (const block of disk.blocks) {
    if (!block.occupied) {
      if (runLen === 0) runStart = block.id;
      runLen += 1;
    } else if (runLen > 0) {
      runs.push({ start: runStart, length: runLen });
      runStart = -1;
      runLen = 0;
    }
  }
  if (runLen > 0) runs.push({ start: runStart, length: runLen });
  return runs;
}

export function cloneState(state: FileSystemState): FileSystemState {
  return structuredClone(state);
}

export function contentByteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function splitContentIntoBlocks(
  content: string,
  blockSizeBytes: number,
  dataBlockIds: number[]
): Record<number, string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const payload: Record<number, string> = {};
  const decoder = new TextDecoder();

  for (let i = 0; i < dataBlockIds.length; i += 1) {
    const start = i * blockSizeBytes;
    const slice = bytes.slice(start, start + blockSizeBytes);
    payload[dataBlockIds[i]] = decoder.decode(slice);
  }
  return payload;
}
