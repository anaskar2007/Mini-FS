import { createEmptyFileSystem, createFile, deleteFile } from "@/lib/fs/engine";
import { getDiskStats } from "@/lib/fs/disk";
import { previewAllocation } from "@/lib/fs/allocator";
import type { AllocationPreview, FileEntry, FileSystemState } from "@/lib/fs/types";

export function internalFragmentationBytes(
  file: FileEntry,
  blockSizeBytes: number
): number {
  return Math.max(0, file.dataBlockIds.length * blockSizeBytes - file.sizeBytes);
}

export interface FragmentationDemo {
  state: FileSystemState;
  requiredDataBlocks: number;
  contiguous: AllocationPreview;
  linked: AllocationPreview;
  largestFreeRun: number;
}

/** A separate deterministic disk: four free blocks, but no 3-block free run. */
export function createExternalFragmentationDemo(): FragmentationDemo {
  let state = createEmptyFileSystem("contiguous", {
    totalBlocks: 8,
    blockSizeBytes: 4,
  });
  const files = ["A", "B", "C", "D", "E", "F"].map((name) => {
    const created = createFile(state, state.rootDirectoryId, `${name}.txt`, "data", "contiguous");
    if (!created.ok) throw new Error(created.error.message);
    state = created.state;
    return created.value;
  });
  for (const file of [files[1], files[3]]) {
    const deleted = deleteFile(state, file.id);
    if (!deleted.ok) throw new Error(deleted.error.message);
    state = deleted.state;
  }
  const contentBytes = 12; // three 4-byte blocks
  const freeRuns = state.disk.blocks.reduce<number[]>((runs, block) => {
    if (!block.occupied) {
      runs[runs.length - 1] = (runs[runs.length - 1] ?? 0) + 1;
    } else {
      runs.push(0);
    }
    return runs;
  }, [0]);
  return {
    state,
    requiredDataBlocks: 3,
    contiguous: previewAllocation(state, "contiguous", contentBytes),
    linked: previewAllocation(state, "linked", contentBytes),
    largestFreeRun: Math.max(...freeRuns),
  };
}

export function demoDiskStats() {
  return getDiskStats(createExternalFragmentationDemo().state);
}
