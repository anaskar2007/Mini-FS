export type AllocationMethod = "contiguous" | "linked" | "indexed";

export type BlockKind = "data" | "index";

export type FileSystemErrorCode =
  | "INVALID_NAME"
  | "DUPLICATE_NAME"
  | "NOT_FOUND"
  | "NOT_EMPTY"
  | "NOT_A_DIRECTORY"
  | "NOT_A_FILE"
  | "INSUFFICIENT_SPACE"
  | "ALLOCATION_FAILED"
  | "INVALID_MOVE"
  | "INDEX_CAPACITY_EXCEEDED"
  | "INVALID_BLOCK_CHAIN"
  | "ALREADY_EXISTS"
  | "FILE_TOO_LARGE";


export interface FileSystemError {
  code: FileSystemErrorCode;
  message: string;
}

export interface DirectoryEntry {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface FileEntry {
  id: string;
  name: string;
  parentId: string;
  /** UTF-8 text content. Empty string ("") for binary files. */
  content: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  allocationMethod: AllocationMethod;
  /** Data blocks in file order (contiguous run, linked chain, or indexed data blocks). */
  dataBlockIds: number[];
  indexBlockId: number | null;
  /**
   * MIME type for binary uploads. null for text files.
   * e.g. "image/png", "application/pdf"
   */
  mimeType: string | null;
  /**
   * Supabase Storage object path for binary files. null for text files.
   * Format: "{userId}/{fileId}/{filename}"
   */
  storagePath: string | null;
  /**
   * Whether the file has been successfully allocated on the virtual disk.
   * Always true for text files. May be false for binary files whose
   * byte size exceeds the virtual disk's total capacity.
   */
  diskAllocated: boolean;
}


export interface DiskBlock {
  id: number;
  occupied: boolean;
  ownerFileId: string | null;
  kind: BlockKind | null;
  /** Linked allocation: next block id, or null at chain end. */
  nextBlockId: number | null;
  /** Indexed allocation: data block ids stored in this index block. */
  indexEntries: number[] | null;
}

export interface VirtualDiskConfig {
  totalBlocks: number;
  blockSizeBytes: number;
}

export interface VirtualDisk extends VirtualDiskConfig {
  blocks: DiskBlock[];
  /** Simulated payload bytes per occupied data block (UTF-8 text slice). */
  blockPayload: Record<number, string>;
}

/** Default allocation method for newly created files. */
export interface FileSystemState {
  disk: VirtualDisk;
  rootDirectoryId: string;
  directories: Record<string, DirectoryEntry>;
  files: Record<string, FileEntry>;
  defaultAllocationMethod: AllocationMethod;
}

export interface AllocationResult {
  success: boolean;
  dataBlockIds: number[];
  indexBlockId: number | null;
  error?: FileSystemError;
}

export interface DiskStats {
  totalBlocks: number;
  usedBlocks: number;
  freeBlocks: number;
  blockSizeBytes: number;
  totalCapacityBytes: number;
  usedCapacityBytes: number;
  freeCapacityBytes: number;
  utilizationPercent: number;
  allocatedDataBlockCount: number;
  allocatedIndexBlockCount: number;
  /** External fragmentation hint for contiguous (0–100, higher = more fragmented free space). */
  contiguousFragmentationPercent: number;
}

export interface FileAllocationView {
  fileId: string;
  fileName: string;
  method: AllocationMethod;
  dataBlockIds: number[];
  indexBlockId: number | null;
  linkedChain: { blockId: number; nextBlockId: number | null }[];
  indexReferences: number[];
  contentSizeBytes: number;
  allocatedCapacityBytes: number;
}

export interface AllocationPreview {
  method: AllocationMethod;
  wouldSucceed: boolean;
  requiredDataBlocks: number;
  totalBlocksNeeded: number;
  proposedDataBlockIds: number[];
  proposedIndexBlockId: number | null;
  error?: FileSystemError;
}

export type OperationResult<T = void> =
  | { ok: true; state: FileSystemState; value: T }
  | { ok: false; state: FileSystemState; error: FileSystemError };

export const DEFAULT_DISK_CONFIG: VirtualDiskConfig = {
  totalBlocks: 1024,
  blockSizeBytes: 1024,
};

/** Max data block pointers storable in one index block (4 bytes per ref). */
export function maxIndexReferences(blockSizeBytes: number): number {
  return Math.floor(blockSizeBytes / 4);
}
