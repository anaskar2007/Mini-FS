import { assertInvariants } from "@/lib/fs/engine";
import { contentByteLength, splitContentIntoBlocks } from "@/lib/fs/disk";
import { allocateBlocksBySize } from "@/lib/fs/allocator";
import type {
  DirectoryEntry,
  DiskBlock,
  FileEntry,
  FileSystemState,
  VirtualDisk,
} from "@/lib/fs/types";

export interface PersistedDiskState {
  totalBlocks: number;
  blockSizeBytes: number;
  blocks: DiskBlock[];
}

export interface PersistedFileSystemSnapshot {
  rootDirectoryId: string;
  defaultAllocationMethod: FileSystemState["defaultAllocationMethod"];
  directories: DirectoryEntry[];
  files: FileEntry[];
  disk: PersistedDiskState;
}

export class FileSystemRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileSystemRestoreError";
  }
}

export function serializeFileSystem(
  state: FileSystemState
): PersistedFileSystemSnapshot {
  return {
    rootDirectoryId: state.rootDirectoryId,
    defaultAllocationMethod: state.defaultAllocationMethod,
    directories: Object.values(state.directories),
    files: Object.values(state.files),
    disk: {
      totalBlocks: state.disk.totalBlocks,
      blockSizeBytes: state.disk.blockSizeBytes,
      blocks: state.disk.blocks,
    },
  };
}

function asRecord<T extends { id: string }>(entries: T[]): Record<string, T> {
  return Object.fromEntries(entries.map((entry) => [entry.id, entry]));
}

/** Restores a validated simulation state without persisting text content per block. */
export function restoreFileSystem(
  snapshot: PersistedFileSystemSnapshot
): FileSystemState {
  const { disk } = snapshot;
  if (
    !Number.isInteger(disk.totalBlocks) ||
    disk.totalBlocks <= 0 ||
    !Number.isInteger(disk.blockSizeBytes) ||
    disk.blockSizeBytes <= 0 ||
    disk.blocks.length !== disk.totalBlocks
  ) {
    throw new FileSystemRestoreError("Persisted virtual disk configuration is invalid.");
  }

  const blockIds = new Set<number>();
  for (const block of disk.blocks) {
    if (!Number.isInteger(block.id) || block.id < 0 || block.id >= disk.totalBlocks || blockIds.has(block.id)) {
      throw new FileSystemRestoreError("Persisted virtual disk contains invalid block IDs.");
    }
    blockIds.add(block.id);
  }

  const directories = asRecord(snapshot.directories);
  const files = asRecord(snapshot.files);
  if (!directories[snapshot.rootDirectoryId]) {
    throw new FileSystemRestoreError("Persisted root directory is missing.");
  }

  // Phase 7 Migration: Upgrade 128-block disks to 1024 blocks automatically.
  // We only target exactly 128 (the old default) to avoid breaking custom configs or tests.
  const targetTotalBlocks = disk.totalBlocks === 128 ? 1024 : disk.totalBlocks;
  const didUpgrade = targetTotalBlocks !== disk.totalBlocks;
  const migratedBlocks = structuredClone(disk.blocks);
  for (let id = disk.totalBlocks; id < targetTotalBlocks; id++) {
    migratedBlocks.push({
      id,
      occupied: false,
      ownerFileId: null,
      kind: null,
      nextBlockId: null,
      indexEntries: null,
    });
  }

  const virtualDisk: VirtualDisk = {
    totalBlocks: targetTotalBlocks,
    blockSizeBytes: disk.blockSizeBytes,
    blocks: migratedBlocks,
    blockPayload: {},
  };
  const state: FileSystemState = {
    disk: virtualDisk,
    rootDirectoryId: snapshot.rootDirectoryId,
    directories: structuredClone(directories),
    files: structuredClone(files),
    defaultAllocationMethod: snapshot.defaultAllocationMethod,
  };

  for (const file of Object.values(state.files)) {
    // Ensure new Phase 6 fields are present with safe defaults for
    // snapshots created before Phase 6 (backward compatibility).
    if (!("mimeType" in file)) (file as FileEntry).mimeType = null;
    if (!("storagePath" in file)) (file as FileEntry).storagePath = null;
    if (!("diskAllocated" in file)) (file as FileEntry).diskAllocated = true;

    // Binary files store actual bytes in Supabase Storage; their content
    // field is always "" so the string-size check must be skipped.
    const isBinary = (file as FileEntry).storagePath !== null;
    if (!isBinary && file.sizeBytes !== contentByteLength(file.content)) {
      throw new FileSystemRestoreError(`Persisted size for ${file.name} does not match its content.`);
    }
    if (!isBinary) {
      Object.assign(
        state.disk.blockPayload,
        splitContentIntoBlocks(file.content, state.disk.blockSizeBytes, file.dataBlockIds)
      );
    }
  }

  // Old snapshots could contain files in Storage that failed virtual allocation
  // only because the original 128-block disk was too small. Retry with the same
  // method after expanding the disk; files that still do not fit remain explicit.
  if (didUpgrade) {
    for (const file of Object.values(state.files)) {
      if (!file.storagePath || file.diskAllocated) continue;
      const allocation = allocateBlocksBySize(state, file.allocationMethod, file.id, file.sizeBytes);
      if (allocation.success) {
        file.dataBlockIds = allocation.dataBlockIds;
        file.indexBlockId = allocation.indexBlockId;
        file.diskAllocated = true;
      }
    }
  }

  const errors = assertInvariants(state);
  if (errors.length > 0) {
    throw new FileSystemRestoreError(`Persisted filesystem is invalid: ${errors[0].message}`);
  }
  return state;
}
