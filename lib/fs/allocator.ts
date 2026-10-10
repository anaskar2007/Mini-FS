import {
  contentByteLength,
  requiredDataBlocks,
  totalBlocksForAllocation,
} from "@/lib/fs/disk";
import {
  maxIndexReferences,
  type AllocationMethod,
  type AllocationPreview,
  type AllocationResult,
  type DiskBlock,
  type FileSystemError,
  type FileSystemState,
  type VirtualDisk,
} from "@/lib/fs/types";

function err(
  code: FileSystemError["code"],
  message: string
): FileSystemError {
  return { code, message };
}

function freeBlockIds(disk: VirtualDisk): number[] {
  return disk.blocks.filter((b) => !b.occupied).map((b) => b.id);
}

function findContiguousRun(
  disk: VirtualDisk,
  length: number
): number[] | null {
  if (length === 0) return [];
  let runStart = -1;
  let runLen = 0;
  for (const block of disk.blocks) {
    if (!block.occupied) {
      if (runLen === 0) runStart = block.id;
      runLen += 1;
      if (runLen >= length) {
        return Array.from({ length }, (_, i) => runStart + i);
      }
    } else {
      runStart = -1;
      runLen = 0;
    }
  }
  return null;
}

function takeFirstFreeBlocks(disk: VirtualDisk, count: number): number[] | null {
  if (count === 0) return [];
  const ids = freeBlockIds(disk);
  if (ids.length < count) return null;
  return ids.slice(0, count);
}

function markBlock(
  disk: VirtualDisk,
  blockId: number,
  fileId: string,
  kind: DiskBlock["kind"],
  nextBlockId: number | null = null,
  indexEntries: number[] | null = null
): void {
  const block = disk.blocks[blockId];
  block.occupied = true;
  block.ownerFileId = fileId;
  block.kind = kind;
  block.nextBlockId = nextBlockId;
  block.indexEntries = indexEntries;
}

export function allocateBlocks(
  state: FileSystemState,
  method: AllocationMethod,
  fileId: string,
  content: string
): AllocationResult {
  const { disk } = state;
  const sizeBytes = contentByteLength(content);
  const dataCount = requiredDataBlocks(sizeBytes, disk.blockSizeBytes);

  if (dataCount === 0) {
    return { success: true, dataBlockIds: [], indexBlockId: null };
  }

  const maxRefs = maxIndexReferences(disk.blockSizeBytes);
  if (method === "indexed" && dataCount > maxRefs) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err(
        "INDEX_CAPACITY_EXCEEDED",
        `File needs ${dataCount} data blocks but a single index block holds at most ${maxRefs} references.`
      ),
    };
  }

  const needed = totalBlocksForAllocation(method, dataCount);
  if (freeBlockIds(disk).length < needed) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err(
        "INSUFFICIENT_SPACE",
        `Need ${needed} free block(s), only ${freeBlockIds(disk).length} available.`
      ),
    };
  }

  if (method === "contiguous") {
    const run = findContiguousRun(disk, dataCount);
    if (!run) {
      return {
        success: false,
        dataBlockIds: [],
        indexBlockId: null,
        error: err(
          "ALLOCATION_FAILED",
          `No contiguous run of ${dataCount} free block(s) found (external fragmentation).`
        ),
      };
    }
    for (const id of run) markBlock(disk, id, fileId, "data", null, null);
    return { success: true, dataBlockIds: run, indexBlockId: null };
  }

  if (method === "linked") {
    const ids = takeFirstFreeBlocks(disk, dataCount);
    if (!ids) {
      return {
        success: false,
        dataBlockIds: [],
        indexBlockId: null,
        error: err("INSUFFICIENT_SPACE", "Not enough free blocks for linked file."),
      };
    }
    for (let i = 0; i < ids.length; i += 1) {
      const next = i < ids.length - 1 ? ids[i + 1] : null;
      markBlock(disk, ids[i], fileId, "data", next, null);
    }
    return { success: true, dataBlockIds: ids, indexBlockId: null };
  }

  // indexed
  const dataIds = takeFirstFreeBlocks(disk, dataCount);
  const indexCandidates = freeBlockIds(disk).filter((id) => !dataIds!.includes(id));
  const indexId = indexCandidates[0];
  if (!dataIds || indexId === undefined) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err("INSUFFICIENT_SPACE", "Not enough free blocks for indexed file."),
    };
  }
  for (const id of dataIds) markBlock(disk, id, fileId, "data", null, null);
  markBlock(disk, indexId, fileId, "index", null, [...dataIds]);
  return { success: true, dataBlockIds: dataIds, indexBlockId: indexId };
}


/**
 * Allocates virtual disk blocks for a given byte size, without requiring a
 * string content value. Used for binary file uploads.
 *
 * The logic is identical to allocateBlocks but skips the string→bytes step.
 */
export function allocateBlocksBySize(
  state: FileSystemState,
  method: AllocationMethod,
  fileId: string,
  sizeBytes: number
): AllocationResult {
  const { disk } = state;
  const dataCount = requiredDataBlocks(sizeBytes, disk.blockSizeBytes);

  if (dataCount === 0) {
    return { success: true, dataBlockIds: [], indexBlockId: null };
  }

  const maxRefs = maxIndexReferences(disk.blockSizeBytes);
  if (method === "indexed" && dataCount > maxRefs) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err(
        "INDEX_CAPACITY_EXCEEDED",
        `File needs ${dataCount} data blocks but a single index block holds at most ${maxRefs} references.`
      ),
    };
  }

  const needed = totalBlocksForAllocation(method, dataCount);
  if (freeBlockIds(disk).length < needed) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err(
        "INSUFFICIENT_SPACE",
        `Need ${needed} free block(s), only ${freeBlockIds(disk).length} available.`
      ),
    };
  }

  if (method === "contiguous") {
    const run = findContiguousRun(disk, dataCount);
    if (!run) {
      return {
        success: false,
        dataBlockIds: [],
        indexBlockId: null,
        error: err(
          "ALLOCATION_FAILED",
          `No contiguous run of ${dataCount} free block(s) found (external fragmentation).`
        ),
      };
    }
    for (const id of run) markBlock(disk, id, fileId, "data", null, null);
    return { success: true, dataBlockIds: run, indexBlockId: null };
  }

  if (method === "linked") {
    const ids = takeFirstFreeBlocks(disk, dataCount);
    if (!ids) {
      return {
        success: false,
        dataBlockIds: [],
        indexBlockId: null,
        error: err("INSUFFICIENT_SPACE", "Not enough free blocks for linked file."),
      };
    }
    for (let i = 0; i < ids.length; i += 1) {
      const next = i < ids.length - 1 ? ids[i + 1] : null;
      markBlock(disk, ids[i], fileId, "data", next, null);
    }
    return { success: true, dataBlockIds: ids, indexBlockId: null };
  }

  // indexed
  const dataIds = takeFirstFreeBlocks(disk, dataCount);
  const indexCandidates = freeBlockIds(disk).filter((id) => !dataIds!.includes(id));
  const indexId = indexCandidates[0];
  if (!dataIds || indexId === undefined) {
    return {
      success: false,
      dataBlockIds: [],
      indexBlockId: null,
      error: err("INSUFFICIENT_SPACE", "Not enough free blocks for indexed file."),
    };
  }
  for (const id of dataIds) markBlock(disk, id, fileId, "data", null, null);
  markBlock(disk, indexId, fileId, "index", null, [...dataIds]);
  return { success: true, dataBlockIds: dataIds, indexBlockId: indexId };
}

export function releaseFileBlocks(state: FileSystemState, fileId: string): void {
  const { disk } = state;
  for (const block of disk.blocks) {
    if (block.ownerFileId === fileId) {
      block.occupied = false;
      block.ownerFileId = null;
      block.kind = null;
      block.nextBlockId = null;
      block.indexEntries = null;
      delete disk.blockPayload[block.id];
    }
  }
}

export function traverseLinkedChain(
  disk: VirtualDisk,
  headBlockId: number
): { ok: true; chain: number[] } | { ok: false; error: FileSystemError } {
  const chain: number[] = [];
  const visited = new Set<number>();
  let current: number | null = headBlockId;

  while (current !== null) {
    if (visited.has(current)) {
      return {
        ok: false,
        error: err("INVALID_BLOCK_CHAIN", `Cycle detected at block ${current}.`),
      };
    }
    visited.add(current);
    const block: DiskBlock | undefined = disk.blocks[current];
    if (!block || !block.occupied || block.kind !== "data") {
      return {
        ok: false,
        error: err("INVALID_BLOCK_CHAIN", `Invalid block ${current} in chain.`),
      };
    }
    chain.push(current);
    current = block.nextBlockId;
  }
  return { ok: true, chain };
}

export function validateFileBlocks(
  state: FileSystemState,
  fileId: string
): FileSystemError | null {
  const file = state.files[fileId];
  if (!file) return err("NOT_FOUND", "File not found.");

  const dataIds = file.dataBlockIds;
  if (new Set(dataIds).size !== dataIds.length) {
    return err("INVALID_BLOCK_CHAIN", "File contains duplicate data block references.");
  }

  // Binary files (storagePath != null) have content="" with a non-zero sizeBytes —
  // skip the string-content consistency check for them.
  const isBinary = file.storagePath !== null;
  if (!isBinary && file.sizeBytes !== contentByteLength(file.content)) {
    return err("INVALID_BLOCK_CHAIN", "File size does not match its text content.");
  }

  // For binary files that are unallocated on the virtual disk, block arrays
  // must be empty — this is the valid unallocated state.
  if (isBinary && !file.diskAllocated) {
    if (dataIds.length > 0 || file.indexBlockId !== null) {
      return err("INVALID_BLOCK_CHAIN", "Unallocated binary file must have empty block arrays.");
    }
    return null;
  }

  const effectiveSizeBytes = isBinary ? file.sizeBytes : contentByteLength(file.content);
  const expectedDataBlocks = requiredDataBlocks(
    effectiveSizeBytes,
    state.disk.blockSizeBytes
  );
  if (dataIds.length !== expectedDataBlocks) {
    return err("INVALID_BLOCK_CHAIN", "File data block count does not match its size.");
  }

  for (const blockId of dataIds) {
    const block = state.disk.blocks[blockId];
    if (
      !block ||
      !block.occupied ||
      block.ownerFileId !== file.id ||
      block.kind !== "data"
    ) {
      return err("INVALID_BLOCK_CHAIN", `Invalid data block ${blockId} for file ${file.id}.`);
    }
  }

  if (file.allocationMethod === "linked" && dataIds.length > 0) {
    const head = dataIds[0];
    const walked = traverseLinkedChain(state.disk, head);
    if (!walked.ok) return walked.error;
    if (
      walked.chain.length !== dataIds.length ||
      walked.chain.some((blockId, index) => blockId !== dataIds[index])
    ) {
      return err("INVALID_BLOCK_CHAIN", "Linked chain does not match file block order.");
    }
  }

  if (file.allocationMethod === "indexed" && dataIds.length === 0) {
    if (file.indexBlockId !== null) {
      return err("INVALID_BLOCK_CHAIN", "Empty indexed file must not own an index block.");
    }
  }

  if (file.allocationMethod === "indexed" && dataIds.length > 0) {
    if (file.indexBlockId === null) {
      return err("INVALID_BLOCK_CHAIN", "Indexed file is missing its index block.");
    }
    const index = state.disk.blocks[file.indexBlockId];
    if (
      !index ||
      !index.occupied ||
      index.ownerFileId !== file.id ||
      index.kind !== "index" ||
      !index.indexEntries
    ) {
      return err("INVALID_BLOCK_CHAIN", "Invalid index block.");
    }
    if (
      index.indexEntries.length !== dataIds.length ||
      index.indexEntries.some((blockId, index) => blockId !== dataIds[index])
    ) {
      return err("INVALID_BLOCK_CHAIN", "Index entries mismatch data blocks.");
    }
  }

  if (file.allocationMethod !== "indexed" && file.indexBlockId !== null) {
    return err("INVALID_BLOCK_CHAIN", "Only indexed files may own index blocks.");
  }

  return null;
}

/** Hypothetical allocation against current free map — does not mutate state. */
export function previewAllocation(
  state: FileSystemState,
  method: AllocationMethod,
  contentByteLength: number
): AllocationPreview {
  const draft = structuredClone(state);
  const fakeId = "__preview__";
  const dataNeeded = requiredDataBlocks(
    contentByteLength,
    draft.disk.blockSizeBytes
  );
  const totalNeeded = totalBlocksForAllocation(method, dataNeeded);

  const result = allocateBlocksBySize(draft, method, fakeId, contentByteLength);
  return {
    method,
    wouldSucceed: result.success,
    requiredDataBlocks: dataNeeded,
    totalBlocksNeeded: totalNeeded,
    proposedDataBlockIds: result.dataBlockIds,
    proposedIndexBlockId: result.indexBlockId,
    error: result.error,
  };
}
