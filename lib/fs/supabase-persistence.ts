import type { SupabaseClient } from "@supabase/supabase-js";
import {
  restoreFileSystem,
  serializeFileSystem,
  type PersistedFileSystemSnapshot,
} from "@/lib/fs/persistence";
import type { FileSystemState } from "@/lib/fs/types";

type Row = Record<string, unknown>;

function stringValue(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Persisted ${key} is invalid.`);
  return value;
}

function nullableNumber(row: Row, key: string): number | null {
  const value = row[key];
  return value === null ? null : typeof value === "number" ? value : null;
}

export async function loadFileSystemForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<FileSystemState | null> {
  const { data: diskRow, error: diskError } = await supabase
    .from("fs_virtual_disks")
    .select("root_directory_id, default_allocation_method, total_blocks, block_size_bytes, blocks")
    .eq("owner_id", userId)
    .maybeSingle();
  if (diskError) throw new Error(diskError.message);
  if (!diskRow) return null;

  const [directoriesResult, filesResult] = await Promise.all([
    supabase.from("fs_directories").select("id, name, parent_id, created_at").eq("owner_id", userId),
    supabase
      .from("fs_files")
      .select("id, name, parent_id, content, size_bytes, allocation_method, data_block_ids, index_block_id, created_at, modified_at, mime_type, storage_path")
      .eq("owner_id", userId),
  ]);
  if (directoriesResult.error) throw new Error(directoriesResult.error.message);
  if (filesResult.error) throw new Error(filesResult.error.message);

  const disk = diskRow as Row;
  const snapshot: PersistedFileSystemSnapshot = {
    rootDirectoryId: stringValue(disk, "root_directory_id"),
    defaultAllocationMethod: stringValue(disk, "default_allocation_method") as FileSystemState["defaultAllocationMethod"],
    directories: (directoriesResult.data as Row[]).map((row) => ({
      id: stringValue(row, "id"), name: stringValue(row, "name"),
      parentId: row.parent_id === null ? null : stringValue(row, "parent_id"),
      createdAt: stringValue(row, "created_at"),
    })),
    files: (filesResult.data as Row[]).map((row) => ({
      id: stringValue(row, "id"), name: stringValue(row, "name"),
      parentId: stringValue(row, "parent_id"), content: stringValue(row, "content"),
      sizeBytes: Number(row.size_bytes),
      allocationMethod: stringValue(row, "allocation_method") as FileSystemState["defaultAllocationMethod"],
      dataBlockIds: Array.isArray(row.data_block_ids) ? row.data_block_ids.map(Number) : [],
      indexBlockId: nullableNumber(row, "index_block_id"),
      createdAt: stringValue(row, "created_at"), modifiedAt: stringValue(row, "modified_at"),
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
      // diskAllocated is derived: binary files with no blocks but a storagePath are unallocated.
      diskAllocated: typeof row.storage_path === "string"
        ? (Number(row.size_bytes) === 0 || (Array.isArray(row.data_block_ids) && row.data_block_ids.length > 0))
        : true,
    })),
    disk: {
      totalBlocks: Number(disk.total_blocks),
      blockSizeBytes: Number(disk.block_size_bytes),
      blocks: Array.isArray(disk.blocks) ? disk.blocks as PersistedFileSystemSnapshot["disk"]["blocks"] : [],
    },
  };
  const restored = restoreFileSystem(snapshot);
  if (restored.disk.totalBlocks !== snapshot.disk.totalBlocks) {
    await saveFileSystemForUser(supabase, restored);
  }
  return restored;
}

export async function saveFileSystemForUser(
  supabase: SupabaseClient,
  state: FileSystemState
): Promise<void> {
  // Validates the exact snapshot that will be persisted before the SQL RPC
  // commits all tables in a single transaction.
  const snapshot = serializeFileSystem(state);
  restoreFileSystem(snapshot);
  const { error } = await supabase.rpc("save_filesystem_snapshot", {
    p_snapshot: snapshot,
  });
  if (error) throw new Error(error.message);
}
