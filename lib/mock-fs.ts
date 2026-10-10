import {
  MOCK_ENTRIES,
  ROOT_FOLDER_ID,
  VIRTUAL_DISK,
  type MockEntry,
} from "@/lib/mock-data";

const entryById = new Map(MOCK_ENTRIES.map((e) => [e.id, e]));

export function getEntry(id: string): MockEntry | undefined {
  return entryById.get(id);
}

export function getChildren(folderId: string): MockEntry[] {
  return MOCK_ENTRIES.filter((e) => e.parentId === folderId).sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function getFolderPath(folderId: string): MockEntry[] {
  const path: MockEntry[] = [];
  let current = entryById.get(folderId);
  while (current) {
    path.unshift(current);
    if (current.parentId === null) break;
    current = entryById.get(current.parentId);
  }
  return path;
}

export function getAllFiles(): MockEntry[] {
  return MOCK_ENTRIES.filter((e) => e.type === "file");
}

export function getRecentFiles(limit = 5): MockEntry[] {
  return [...getAllFiles()]
    .sort(
      (a, b) =>
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    )
    .slice(0, limit);
}

function isUnderFolder(entryId: string, folderId: string): boolean {
  let current = entryById.get(entryId);
  while (current) {
    if (current.id === folderId) return true;
    if (current.parentId === null) break;
    current = entryById.get(current.parentId);
  }
  return false;
}

export function searchInFolder(folderId: string, query: string): MockEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return MOCK_ENTRIES.filter(
    (e) =>
      e.id !== folderId &&
      e.id !== ROOT_FOLDER_ID &&
      isUnderFolder(e.id, folderId) &&
      e.name.toLowerCase().includes(q)
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function getStorageSummary() {
  const totalCapacityBytes =
    VIRTUAL_DISK.totalBlocks * VIRTUAL_DISK.blockSizeBytes;
  const usedCapacityBytes = VIRTUAL_DISK.usedBlocks * VIRTUAL_DISK.blockSizeBytes;
  const freeCapacityBytes = VIRTUAL_DISK.freeBlocks * VIRTUAL_DISK.blockSizeBytes;
  const fileCount = getAllFiles().length;
  const folderCount = MOCK_ENTRIES.filter((e) => e.type === "folder").length - 1;

  return {
    totalCapacityBytes,
    usedCapacityBytes,
    freeCapacityBytes,
    utilizationPercent: Math.round(
      (VIRTUAL_DISK.usedBlocks / VIRTUAL_DISK.totalBlocks) * 100
    ),
    fileCount,
    folderCount,
    ...VIRTUAL_DISK,
  };
}

export function getFolderTreeRoots(): MockEntry[] {
  return getChildren(ROOT_FOLDER_ID);
}

/** Depth-first folder list for sidebar tree (folders only). */
export function buildFolderTree(
  folderId: string = ROOT_FOLDER_ID,
  depth = 0
): { entry: MockEntry; depth: number }[] {
  const result: { entry: MockEntry; depth: number }[] = [];
  const root = entryById.get(folderId);
  if (root && folderId !== ROOT_FOLDER_ID) {
    result.push({ entry: root, depth });
  }
  for (const child of getChildren(folderId)) {
    if (child.type === "folder") {
      result.push(...buildFolderTree(child.id, depth + 1));
    }
  }
  return result;
}
