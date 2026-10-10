import { describe, expect, it } from "vitest";
import { 
  createEmptyFileSystem, 
  createBinaryFile,
  generateUniqueName,
  previewAllocation, 
} from "../index";
import { serializeFileSystem, restoreFileSystem } from "../persistence";

describe("Issue #1: Virtual disk allocation constraints", () => {
  it("migrates a 128-block snapshot to 1,024 blocks", () => {
    // Simulate an old 128 block, 1 KiB block size system
    const oldState = createEmptyFileSystem("contiguous", { totalBlocks: 128, blockSizeBytes: 1024 });
    expect(oldState.disk.blocks.length).toBe(128);
    
    // Migrate it via persistence round-trip
    const serialized = serializeFileSystem(oldState);
    const migrated = restoreFileSystem(serialized);
    
    expect(migrated.disk.blocks.length).toBe(1024);
    expect(migrated.disk.blockSizeBytes).toBe(1024);
    // Preserves existing properties
    expect(migrated.rootDirectoryId).toBe(oldState.rootDirectoryId);
  });

  it("retries an unallocated binary file after the disk upgrade", () => {
    const oldState = createEmptyFileSystem("indexed", { totalBlocks: 128, blockSizeBytes: 1024 });
    const result = createBinaryFile(oldState, oldState.rootDirectoryId, "archive.bin", 200 * 1024, "application/octet-stream", "user/file/archive.bin");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diskAllocated).toBe(false);
    const restored = restoreFileSystem(serializeFileSystem(result.state));
    expect(restored.files[result.value.id].diskAllocated).toBe(true);
    expect(restored.files[result.value.id].dataBlockIds).toHaveLength(200);
  });

  it("can allocate a 619 KB binary file on a 1 MiB disk using contiguous allocation", () => {
    const state = createEmptyFileSystem("contiguous", { totalBlocks: 1024, blockSizeBytes: 1024 });
    const sizeBytes = 619 * 1024; // 619 KB
    const preview = previewAllocation(state, "contiguous", sizeBytes);
    
    expect(preview.wouldSucceed).toBe(true);
    expect(preview.totalBlocksNeeded).toBe(619);
    expect(preview.proposedDataBlockIds?.length).toBe(619);
  });

  it("allocates 619 KiB of binary data and preserves that allocation after restore", () => {
    const state = createEmptyFileSystem("contiguous");
    const result = createBinaryFile(state, state.rootDirectoryId, "holiday-photo.pdf", 619 * 1024, "application/pdf", "user/file/holiday-photo.pdf", "contiguous");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.diskAllocated).toBe(true);
    expect(result.value.dataBlockIds).toHaveLength(619);
    const restored = restoreFileSystem(serializeFileSystem(result.state));
    expect(restored.files[result.value.id].name).toBe("holiday-photo.pdf");
    expect(restored.files[result.value.id].diskAllocated).toBe(true);
    expect(restored.files[result.value.id].dataBlockIds).toHaveLength(619);
  });

  it("adds readable duplicate suffixes before the original extension", () => {
    const state = createEmptyFileSystem("indexed");
    const first = createBinaryFile(state, state.rootDirectoryId, "holiday-photo.png", 1, "image/png", "user/a", "indexed");
    expect(first.ok).toBe(true);
    expect(generateUniqueName(first.state, first.state.rootDirectoryId, "holiday-photo.png")).toBe("holiday-photo (1).png");
  });

  it("fails to allocate a 619 KB binary file using indexed allocation (capacity limit)", () => {
    const state = createEmptyFileSystem("indexed", { totalBlocks: 1024, blockSizeBytes: 1024 });
    const sizeBytes = 619 * 1024; // 619 KB
    const preview = previewAllocation(state, "indexed", sizeBytes);
    
    expect(preview.wouldSucceed).toBe(false);
    expect(preview.error?.code).toBe("INDEX_CAPACITY_EXCEEDED");
    expect(preview.error?.message).toMatch(/single index block holds at most 256 references/);
  });
});
