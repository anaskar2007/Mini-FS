import {
  allocateBlocks,
  allocateBlocksBySize,
  previewAllocation,
  releaseFileBlocks,
  traverseLinkedChain,
  validateFileBlocks,
} from "@/lib/fs/allocator";

import {
  cloneState,
  contentByteLength,
  createVirtualDisk,
  getDiskStats,
  splitContentIntoBlocks,
} from "@/lib/fs/disk";
import type {
  AllocationMethod,
  AllocationPreview,
  DirectoryEntry,
  FileAllocationView,
  FileEntry,
  FileSystemError,
  FileSystemState,
  OperationResult,
} from "@/lib/fs/types";

let idCounter = 0;

export function generateId(prefix: string): string {
  idCounter += 1;
  // UUIDs are accepted directly by the persistence schema while remaining
  // opaque, stable identifiers to the simulation engine.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${prefix}-${idCounter}`;
}

export function resetIdCounter(forTests = 0): void {
  idCounter = forTests;
}

function err(
  code: FileSystemError["code"],
  message: string
): FileSystemError {
  return { code, message };
}

function nowIso(): string {
  return new Date().toISOString();
}

const INVALID_NAME = /[\\/:\0]/;

export function validateEntryName(name: string): FileSystemError | null {
  const trimmed = name.trim();
  if (!trimmed) return err("INVALID_NAME", "Name cannot be empty.");
  if (trimmed === "." || trimmed === "..") {
    return err("INVALID_NAME", "Name cannot be . or ..");
  }
  if (INVALID_NAME.test(trimmed)) {
    return err("INVALID_NAME", "Name contains invalid characters.");
  }
  return null;
}

export function createEmptyFileSystem(
  defaultAllocationMethod: AllocationMethod = "indexed",
  diskConfig?: Parameters<typeof createVirtualDisk>[0]
): FileSystemState {
  const rootId = generateId("dir");
  const disk = createVirtualDisk(diskConfig);
  const root: DirectoryEntry = {
    id: rootId,
    name: "MiniFS",
    parentId: null,
    createdAt: nowIso(),
  };
  return {
    disk,
    rootDirectoryId: rootId,
    directories: { [rootId]: root },
    files: {},
    defaultAllocationMethod,
  };
}

function getDirectory(
  state: FileSystemState,
  id: string
): DirectoryEntry | undefined {
  return state.directories[id];
}

function siblingNameTaken(
  state: FileSystemState,
  parentId: string,
  name: string,
  excludeId?: string
): boolean {
  const normalized = name.trim();
  for (const dir of Object.values(state.directories)) {
    if (dir.id === excludeId) continue;
    if (dir.parentId === parentId && dir.name === normalized) return true;
  }
  for (const file of Object.values(state.files)) {
    if (file.id === excludeId) continue;
    if (file.parentId === parentId && file.name === normalized) return true;
  }
  return false;
}

export function generateUniqueName(
  state: FileSystemState,
  parentId: string,
  baseName: string
): string {
  let name = baseName.trim();
  let counter = 1;
  const lastDot = name.lastIndexOf(".");
  const namePart = lastDot > 0 ? name.slice(0, lastDot) : name;
  const extPart = lastDot > 0 ? name.slice(lastDot) : "";

  while (siblingNameTaken(state, parentId, name)) {
    name = `${namePart} (${counter})${extPart}`;
    counter++;
  }
  return name;
}

function isDescendant(
  state: FileSystemState,
  ancestorId: string,
  nodeId: string
): boolean {
  let current = state.directories[nodeId];
  while (current) {
    if (current.id === ancestorId) return true;
    if (current.parentId === null) break;
    current = state.directories[current.parentId];
  }
  return false;
}

function applyBlockPayload(
  state: FileSystemState,
  fileId: string,
  content: string,
  dataBlockIds: number[]
): void {
  const chunks = splitContentIntoBlocks(
    content,
    state.disk.blockSizeBytes,
    dataBlockIds
  );
  for (const [blockId, payload] of Object.entries(chunks)) {
    state.disk.blockPayload[Number(blockId)] = payload;
  }
}

function commitFileAllocation(
  state: FileSystemState,
  file: FileEntry,
  content: string
): OperationResult<FileEntry> {
  releaseFileBlocks(state, file.id);
  const allocation = allocateBlocks(
    state,
    file.allocationMethod,
    file.id,
    content
  );
  if (!allocation.success) {
    return {
      ok: false,
      state,
      error: allocation.error ?? err("ALLOCATION_FAILED", "Allocation failed."),
    };
  }
  file.dataBlockIds = allocation.dataBlockIds;
  file.indexBlockId = allocation.indexBlockId;
  file.content = content;
  file.sizeBytes = contentByteLength(content);
  file.modifiedAt = nowIso();
  applyBlockPayload(state, file.id, content, file.dataBlockIds);
  const chainError = validateFileBlocks(state, file.id);
  if (chainError) {
    return { ok: false, state, error: chainError };
  }
  return { ok: true, state, value: file };
}

export function createDirectory(
  state: FileSystemState,
  parentId: string,
  name: string
): OperationResult<DirectoryEntry> {
  const draft = cloneState(state);
  const nameError = validateEntryName(name);
  if (nameError) return { ok: false, state, error: nameError };

  const parent = getDirectory(draft, parentId);
  if (!parent) return { ok: false, state, error: err("NOT_FOUND", "Parent directory not found.") };

  const trimmed = name.trim();
  if (siblingNameTaken(draft, parentId, trimmed)) {
    return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in this folder.") };
  }

  const entry: DirectoryEntry = {
    id: generateId("dir"),
    name: trimmed,
    parentId,
    createdAt: nowIso(),
  };
  draft.directories[entry.id] = entry;
  return { ok: true, state: draft, value: entry };
}

export function listDirectory(state: FileSystemState, directoryId: string) {
  const dirs = Object.values(state.directories)
    .filter((d) => d.parentId === directoryId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = Object.values(state.files)
    .filter((f) => f.parentId === directoryId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { directories: dirs, files };
}

export function getDirectoryTree(state: FileSystemState, directoryId: string) {
  const result: { directory: DirectoryEntry; depth: number }[] = [];
  function walk(id: string, depth: number) {
    const children = Object.values(state.directories).filter(
      (d) => d.parentId === id
    );
    for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
      result.push({ directory: child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(directoryId, 0);
  return result;
}

export function getPathToRoot(
  state: FileSystemState,
  directoryId: string
): DirectoryEntry[] {
  const path: DirectoryEntry[] = [];
  let current = getDirectory(state, directoryId);
  while (current) {
    path.unshift(current);
    if (current.parentId === null) break;
    current = getDirectory(state, current.parentId);
  }
  return path;
}

export function createFile(
  state: FileSystemState,
  parentId: string,
  name: string,
  content = "",
  allocationMethod?: AllocationMethod
): OperationResult<FileEntry> {
  const draft = cloneState(state);
  const nameError = validateEntryName(name);
  if (nameError) return { ok: false, state, error: nameError };

  if (!getDirectory(draft, parentId)) {
    return { ok: false, state, error: err("NOT_FOUND", "Parent directory not found.") };
  }

  const trimmed = name.trim();
  if (siblingNameTaken(draft, parentId, trimmed)) {
    return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in this folder.") };
  }

  const file: FileEntry = {
    id: generateId("file"),
    name: trimmed,
    parentId,
    content: "",
    sizeBytes: 0,
    createdAt: nowIso(),
    modifiedAt: nowIso(),
    allocationMethod: allocationMethod ?? draft.defaultAllocationMethod,
    dataBlockIds: [],
    indexBlockId: null,
    mimeType: null,
    storagePath: null,
    diskAllocated: true,
  };
  draft.files[file.id] = file;

  const writeResult = commitFileAllocation(draft, file, content);
  if (!writeResult.ok) return { ok: false, state, error: writeResult.error };

  return { ok: true, state: draft, value: draft.files[file.id] };
}

export function readFile(
  state: FileSystemState,
  fileId: string
): OperationResult<string> {
  const file = state.files[fileId];
  if (!file) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };
  return { ok: true, state, value: file.content };
}

export function writeFile(
  state: FileSystemState,
  fileId: string,
  content: string
): OperationResult<FileEntry> {
  const draft = cloneState(state);
  const file = draft.files[fileId];
  if (!file) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };

  // Clone-and-swap: reuse this file's blocks on the draft disk. If allocation
  // fails, the original state is returned unchanged (no partial mutation).
  releaseFileBlocks(draft, file.id);
  file.dataBlockIds = [];
  file.indexBlockId = null;

  const allocation = allocateBlocks(
    draft,
    file.allocationMethod,
    file.id,
    content
  );
  if (!allocation.success) {
    return {
      ok: false,
      state,
      error: allocation.error ?? err("ALLOCATION_FAILED", "Write failed."),
    };
  }

  file.dataBlockIds = allocation.dataBlockIds;
  file.indexBlockId = allocation.indexBlockId;
  file.content = content;
  file.sizeBytes = contentByteLength(content);
  file.modifiedAt = nowIso();
  applyBlockPayload(draft, file.id, content, file.dataBlockIds);

  return { ok: true, state: draft, value: file };
}

/**
 * Registers a binary file in the filesystem and attempts to allocate virtual
 * disk blocks using the actual byte size.
 *
 * If the file is too large for the virtual disk, it is still created but with
 * `diskAllocated: false` and empty block arrays — a clearly defined unallocated
 * state. The file can be downloaded via its storagePath but cannot be inspected
 * in the disk block map.
 *
 * On allocation success, `diskAllocated: true` and block arrays are populated
 * exactly as for text files.
 */
export function createBinaryFile(
  state: FileSystemState,
  parentId: string,
  name: string,
  sizeBytes: number,
  mimeType: string,
  storagePath: string,
  allocationMethod?: AllocationMethod
): OperationResult<FileEntry> {
  const draft = cloneState(state);
  const nameError = validateEntryName(name);
  if (nameError) return { ok: false, state, error: nameError };

  if (!getDirectory(draft, parentId)) {
    return { ok: false, state, error: err("NOT_FOUND", "Parent directory not found.") };
  }

  const trimmed = name.trim();
  if (siblingNameTaken(draft, parentId, trimmed)) {
    return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in this folder.") };
  }

  const method = allocationMethod ?? draft.defaultAllocationMethod;
  const file: FileEntry = {
    id: generateId("file"),
    name: trimmed,
    parentId,
    content: "",
    sizeBytes,
    createdAt: nowIso(),
    modifiedAt: nowIso(),
    allocationMethod: method,
    dataBlockIds: [],
    indexBlockId: null,
    mimeType,
    storagePath,
    diskAllocated: false,
  };
  draft.files[file.id] = file;

  // Attempt virtual-disk allocation by byte count.
  const allocation = allocateBlocksBySize(draft, method, file.id, sizeBytes);
  if (allocation.success) {
    file.dataBlockIds = allocation.dataBlockIds;
    file.indexBlockId = allocation.indexBlockId;
    file.diskAllocated = true;
    const chainError = validateFileBlocks(draft, file.id);
    if (chainError) {
      // Allocation produced an invalid chain — release and leave unallocated.
      releaseFileBlocks(draft, file.id);
      file.dataBlockIds = [];
      file.indexBlockId = null;
      file.diskAllocated = false;
    }
  }
  // If allocation failed, diskAllocated remains false — consistent and explicit.

  return { ok: true, state: draft, value: draft.files[file.id] };
}

export function renameEntry(
  state: FileSystemState,
  entryId: string,
  newName: string,
  kind: "file" | "directory"
): OperationResult<void> {
  const draft = cloneState(state);
  const nameError = validateEntryName(newName);
  if (nameError) return { ok: false, state, error: nameError };

  const trimmed = newName.trim();
  if (kind === "directory") {
    const dir = draft.directories[entryId];
    if (!dir) return { ok: false, state, error: err("NOT_FOUND", "Directory not found.") };
    if (dir.parentId && siblingNameTaken(draft, dir.parentId, trimmed, entryId)) {
      return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in this folder.") };
    }
    dir.name = trimmed;
    return { ok: true, state: draft, value: undefined };
  }

  const file = draft.files[entryId];
  if (!file) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };
  if (siblingNameTaken(draft, file.parentId, trimmed, entryId)) {
    return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in this folder.") };
  }
  file.name = trimmed;
  file.modifiedAt = nowIso();
  return { ok: true, state: draft, value: undefined };
}

export function moveEntry(
  state: FileSystemState,
  entryId: string,
  newParentId: string,
  kind: "file" | "directory"
): OperationResult<void> {
  const draft = cloneState(state);
  const dest = getDirectory(draft, newParentId);
  if (!dest) return { ok: false, state, error: err("NOT_FOUND", "Destination directory not found.") };

  if (kind === "directory") {
    const dir = draft.directories[entryId];
    if (!dir) return { ok: false, state, error: err("NOT_FOUND", "Directory not found.") };
    if (dir.id === newParentId || isDescendant(draft, entryId, newParentId)) {
      return { ok: false, state, error: err("INVALID_MOVE", "Cannot move a folder into itself or a descendant.") };
    }
    if (siblingNameTaken(draft, newParentId, dir.name, entryId)) {
      return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in destination.") };
    }
    dir.parentId = newParentId;
    return { ok: true, state: draft, value: undefined };
  }

  const file = draft.files[entryId];
  if (!file) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };
  if (siblingNameTaken(draft, newParentId, file.name, entryId)) {
    return { ok: false, state, error: err("DUPLICATE_NAME", "Name already exists in destination.") };
  }
  file.parentId = newParentId;
  file.modifiedAt = nowIso();
  return { ok: true, state: draft, value: undefined };
}

export function copyFile(
  state: FileSystemState,
  fileId: string,
  destParentId: string,
  newName?: string
): OperationResult<FileEntry> {
  const source = state.files[fileId];
  if (!source) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };
  const name = newName?.trim() ?? `Copy of ${source.name}`;
  return createFile(
    state,
    destParentId,
    name,
    source.content,
    source.allocationMethod
  );
}

export function deleteFile(
  state: FileSystemState,
  fileId: string
): OperationResult<void> {
  const draft = cloneState(state);
  const file = draft.files[fileId];
  if (!file) return { ok: false, state, error: err("NOT_FOUND", "File not found.") };
  releaseFileBlocks(draft, fileId);
  delete draft.files[fileId];
  return { ok: true, state: draft, value: undefined };
}

export function deleteDirectory(
  state: FileSystemState,
  directoryId: string,
  recursive = false
): OperationResult<void> {
  const draft = cloneState(state);
  const dir = draft.directories[directoryId];
  if (!dir) return { ok: false, state, error: err("NOT_FOUND", "Directory not found.") };
  if (dir.parentId === null) {
    return { ok: false, state, error: err("INVALID_MOVE", "Cannot delete the root directory.") };
  }

  const { directories, files } = listDirectory(draft, directoryId);
  if ((directories.length > 0 || files.length > 0) && !recursive) {
    return { ok: false, state, error: err("NOT_EMPTY", "Directory is not empty.") };
  }

  if (recursive) {
    const fileIds: string[] = [];
    const dirIds: string[] = [];

    function collect(id: string) {
      const listing = listDirectory(draft, id);
      for (const child of listing.directories) {
        collect(child.id);
        dirIds.push(child.id);
      }
      for (const file of listing.files) {
        fileIds.push(file.id);
      }
    }

    collect(directoryId);
    for (const fileId of fileIds) {
      releaseFileBlocks(draft, fileId);
      delete draft.files[fileId];
    }
    for (const childId of dirIds) {
      delete draft.directories[childId];
    }
  }

  delete draft.directories[directoryId];
  return { ok: true, state: draft, value: undefined };
}

export function setDefaultAllocationMethod(
  state: FileSystemState,
  method: AllocationMethod
): FileSystemState {
  const draft = cloneState(state);
  draft.defaultAllocationMethod = method;
  return draft;
}

export function getFileMetadata(state: FileSystemState, fileId: string) {
  const file = state.files[fileId];
  if (!file) return null;
  return file;
}

export function searchInDirectoryTree(
  state: FileSystemState,
  folderId: string,
  query: string
): Array<
  | { kind: "directory"; entry: DirectoryEntry }
  | { kind: "file"; entry: FileEntry }
> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: Array<
    | { kind: "directory"; entry: DirectoryEntry }
    | { kind: "file"; entry: FileEntry }
  > = [];

  function underFolder(entryParentId: string | null, targetId: string): boolean {
    let current = entryParentId;
    while (current !== null) {
      if (current === targetId) return true;
      const dir = state.directories[current];
      if (!dir) break;
      current = dir.parentId;
    }
    return folderId === targetId && entryParentId === folderId;
  }

  for (const dir of Object.values(state.directories)) {
    if (dir.id === state.rootDirectoryId) continue;
    if (underFolder(dir.parentId, folderId) && dir.name.toLowerCase().includes(q)) {
      results.push({ kind: "directory", entry: dir });
    }
  }
  for (const file of Object.values(state.files)) {
    if (underFolder(file.parentId, folderId) && file.name.toLowerCase().includes(q)) {
      results.push({ kind: "file", entry: file });
    }
  }
  return results.sort((a, b) => {
    const nameA = a.kind === "directory" ? a.entry.name : a.entry.name;
    const nameB = b.kind === "directory" ? b.entry.name : b.entry.name;
    return nameA.localeCompare(nameB);
  });
}

export function getRecentFiles(state: FileSystemState, limit = 6): FileEntry[] {
  return Object.values(state.files)
    .sort(
      (a, b) =>
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    )
    .slice(0, limit);
}

export function getFileAllocationView(
  state: FileSystemState,
  fileId: string
): FileAllocationView | null {
  const file = state.files[fileId];
  if (!file) return null;

  let linkedChain: FileAllocationView["linkedChain"] = [];
  if (file.allocationMethod === "linked" && file.dataBlockIds.length > 0) {
    const walked = traverseLinkedChain(state.disk, file.dataBlockIds[0]);
    if (walked.ok) {
      linkedChain = walked.chain.map((blockId) => ({
        blockId,
        nextBlockId: state.disk.blocks[blockId].nextBlockId,
      }));
    }
  }

  const indexReferences =
    file.indexBlockId !== null
      ? (state.disk.blocks[file.indexBlockId].indexEntries ?? [])
      : [];

  const allocatedCapacityBytes =
    (file.dataBlockIds.length + (file.indexBlockId !== null ? 1 : 0)) *
    state.disk.blockSizeBytes;

  return {
    fileId: file.id,
    fileName: file.name,
    method: file.allocationMethod,
    dataBlockIds: file.dataBlockIds,
    indexBlockId: file.indexBlockId,
    linkedChain,
    indexReferences,
    contentSizeBytes: file.sizeBytes,
    allocatedCapacityBytes,
  };
}

export function previewAllMethods(
  state: FileSystemState,
  contentByteLength: number
): AllocationPreview[] {
  return (["contiguous", "linked", "indexed"] as AllocationMethod[]).map(
    (method) => previewAllocation(state, method, contentByteLength)
  );
}

export function assertInvariants(state: FileSystemState): FileSystemError[] {
  const errors: FileSystemError[] = [];
  const stats = getDiskStats(state);
  if (stats.usedBlocks + stats.freeBlocks !== stats.totalBlocks) {
    errors.push(err("INVALID_BLOCK_CHAIN", "Used + free blocks != total blocks."));
  }

  const root = state.directories[state.rootDirectoryId];
  if (!root || root.parentId !== null) {
    errors.push(err("NOT_FOUND", "Root directory is missing or has a parent."));
  }

  for (const block of state.disk.blocks) {
    if (block.id < 0 || block.id >= state.disk.totalBlocks) {
      errors.push(err("INVALID_BLOCK_CHAIN", `Block has invalid id ${block.id}.`));
    }
    if (!block.occupied) continue;
    if (!block.ownerFileId) {
      errors.push(err("INVALID_BLOCK_CHAIN", `Block ${block.id} occupied without owner.`));
    }
    if (!block.kind) {
      errors.push(err("INVALID_BLOCK_CHAIN", `Block ${block.id} occupied without kind.`));
    }
  }

  for (const file of Object.values(state.files)) {
    for (const blockId of file.dataBlockIds) {
      const block = state.disk.blocks[blockId];
      if (!block?.occupied || block.ownerFileId !== file.id) {
        errors.push(err("INVALID_BLOCK_CHAIN", `File ${file.id} owns invalid data block ${blockId}.`));
      }
    }
    if (file.indexBlockId !== null) {
      const index = state.disk.blocks[file.indexBlockId];
      if (!index?.occupied || index.ownerFileId !== file.id) {
        errors.push(err("INVALID_BLOCK_CHAIN", `File ${file.id} invalid index block.`));
      }
    }
    const validation = validateFileBlocks(state, file.id);
    if (validation) errors.push(validation);
  }

  for (const dir of Object.values(state.directories)) {
    if (dir.parentId !== null && !state.directories[dir.parentId]) {
      errors.push(err("NOT_FOUND", `Directory ${dir.id} has invalid parent.`));
    }
    const visited = new Set<string>();
    let current: DirectoryEntry | undefined = dir;
    while (current?.parentId !== null) {
      if (visited.has(current.id)) {
        errors.push(err("INVALID_MOVE", `Directory ${dir.id} has a parent cycle.`));
        break;
      }
      visited.add(current.id);
      current = state.directories[current.parentId];
    }
  }

  for (const file of Object.values(state.files)) {
    if (!state.directories[file.parentId]) {
      errors.push(err("NOT_FOUND", `File ${file.id} has invalid parent.`));
    }
  }

  for (const block of state.disk.blocks) {
    if (block.occupied && block.ownerFileId && !state.files[block.ownerFileId]) {
      errors.push(
        err("INVALID_BLOCK_CHAIN", `Block ${block.id} owned by missing file.`)
      );
    }
  }

  const occupiedIds = new Set(
    state.disk.blocks.filter((b) => b.occupied).map((b) => b.id)
  );
  const referenced = new Set<number>();
  const referencedBy = new Map<number, string>();
  for (const file of Object.values(state.files)) {
    for (const id of [...file.dataBlockIds, file.indexBlockId].filter(
      (id): id is number => id !== null
    )) {
      const existingOwner = referencedBy.get(id);
      if (existingOwner) {
        errors.push(
          err("INVALID_BLOCK_CHAIN", `Block ${id} is referenced by both ${existingOwner} and ${file.id}.`)
        );
      }
      referencedBy.set(id, file.id);
      referenced.add(id);
    }
  }
  for (const id of occupiedIds) {
    if (!referenced.has(id)) {
      errors.push(err("INVALID_BLOCK_CHAIN", `Leaked occupied block ${id}.`));
    }
  }

  const namesByParent = new Map<string, Set<string>>();
  for (const entry of [...Object.values(state.directories), ...Object.values(state.files)]) {
    if (entry.parentId === null) continue;
    const names = namesByParent.get(entry.parentId) ?? new Set<string>();
    if (names.has(entry.name)) {
      errors.push(err("DUPLICATE_NAME", `Duplicate name ${entry.name} in directory ${entry.parentId}.`));
    }
    names.add(entry.name);
    namesByParent.set(entry.parentId, names);
  }

  return errors;
}

export { getDiskStats, previewAllocation };
