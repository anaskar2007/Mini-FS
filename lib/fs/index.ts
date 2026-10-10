export {
  DEFAULT_DISK_CONFIG,
  maxIndexReferences,
  type AllocationMethod,
  type AllocationPreview,
  type AllocationResult,
  type DirectoryEntry,
  type DiskBlock,
  type DiskStats,
  type FileAllocationView,
  type FileEntry,
  type FileSystemError,
  type FileSystemErrorCode,
  type FileSystemState,
  type OperationResult,
  type VirtualDisk,
  type VirtualDiskConfig,
} from "@/lib/fs/types";

export {
  allocatedCapacityBytes,
  cloneState,
  contentByteLength,
  createVirtualDisk,
  freeRunLayout,
  getDiskStats,
  requiredDataBlocks,
  totalBlocksForAllocation,
} from "@/lib/fs/disk";


export {
  allocateBlocksBySize,
  allocateBlocks,
  previewAllocation,
  releaseFileBlocks,
  traverseLinkedChain,
  validateFileBlocks,
} from "@/lib/fs/allocator";

export {
  assertInvariants,
  copyFile,
  createBinaryFile,
  createDirectory,
  createEmptyFileSystem,
  createFile,
  deleteDirectory,
  deleteFile,
  generateId,
  getDirectoryTree,
  getFileAllocationView,
  getFileMetadata,
  getPathToRoot,
  getRecentFiles,
  listDirectory,
  moveEntry,
  previewAllMethods,
  readFile,
  renameEntry,
  resetIdCounter,
  searchInDirectoryTree,
  setDefaultAllocationMethod,
  validateEntryName,
  writeFile,
  generateUniqueName,
} from "@/lib/fs/engine";


export { seedSampleFileSystem } from "@/lib/fs/seed";

export { commitPersistedOperation } from "@/lib/fs/persistence-commit";

export {
  createExternalFragmentationDemo,
  internalFragmentationBytes,
  type FragmentationDemo,
} from "@/lib/fs/education";

export {
  FileSystemRestoreError,
  restoreFileSystem,
  serializeFileSystem,
  type PersistedDiskState,
  type PersistedFileSystemSnapshot,
} from "@/lib/fs/persistence";
