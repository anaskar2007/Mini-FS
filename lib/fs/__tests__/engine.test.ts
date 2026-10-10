import { describe, expect, it, beforeEach } from "vitest";
import {
  allocateBlocks,
  traverseLinkedChain,
} from "@/lib/fs/allocator";
import {
  contentByteLength,
  createVirtualDisk,
  freeRunLayout,
  getDiskStats,
  requiredDataBlocks,
} from "@/lib/fs/disk";
import {
  assertInvariants,
  copyFile,
  createDirectory,
  createEmptyFileSystem,
  createFile,
  deleteDirectory,
  deleteFile,
  getFileAllocationView,
  listDirectory,
  moveEntry,
  previewAllocation,
  previewAllMethods,
  readFile,
  renameEntry,
  resetIdCounter,
  writeFile,
} from "@/lib/fs/engine";
import { restoreFileSystem, serializeFileSystem } from "@/lib/fs/persistence";
import { commitPersistedOperation } from "@/lib/fs/persistence-commit";
import { createExternalFragmentationDemo, internalFragmentationBytes } from "@/lib/fs/education";

import type { FileSystemState, OperationResult } from "@/lib/fs/types";

function ok<T>(result: OperationResult<T>): T {
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function stateOf<T>(result: OperationResult<T>): FileSystemState {
  expect(result.ok, result.ok ? "" : result.error.message).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function expectFail<T>(
  result: OperationResult<T>,
  code: string
): FileSystemState {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.error.code).toBe(code);
  return result.state;
}

function expectClean(state: FileSystemState) {
  expect(assertInvariants(state)).toEqual([]);
}

beforeEach(() => {
  resetIdCounter(0);
});

describe("disk initialization", () => {
  it("creates 1024 x 1 KiB disk by default", () => {
    const disk = createVirtualDisk();
    expect(disk.totalBlocks).toBe(1024);
    expect(disk.blockSizeBytes).toBe(1024);
    expect(disk.blocks).toHaveLength(1024);
    expect(disk.blocks.every((b) => !b.occupied)).toBe(true);

    const fs = createEmptyFileSystem();
    const stats = getDiskStats(fs);
    expect(stats.totalCapacityBytes).toBe(1024 * 1024);
    expect(stats.usedBlocks).toBe(0);
    expect(stats.freeBlocks).toBe(1024);
    expect(stats.utilizationPercent).toBe(0);
  });

  it("accepts a custom disk size", () => {
    const fs = createEmptyFileSystem("linked", {
      totalBlocks: 8,
      blockSizeBytes: 32,
    });
    expect(fs.disk.totalBlocks).toBe(8);
    expect(getDiskStats(fs).totalCapacityBytes).toBe(256);
  });
});

describe("files: create, read, write", () => {
  it("creates and reads a text file", () => {
    let state = createEmptyFileSystem("contiguous");
    const created = createFile(state, state.rootDirectoryId, "notes.txt", "hello");
    state = stateOf(created);
    expect(ok(created).sizeBytes).toBe(contentByteLength("hello"));
    expect(ok(readFile(state, ok(created).id))).toBe("hello");
    expectClean(state);
  });

  it("writes smaller and larger contents", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "a.txt", "abcd");
    const fileId = ok(created).id;
    state = created.state;

    state = stateOf(writeFile(state, fileId, "z"));
    expect(ok(readFile(state, fileId))).toBe("z");
    expect(state.files[fileId].dataBlockIds).toHaveLength(1);

    const large = "x".repeat(24);
    state = stateOf(writeFile(state, fileId, large));
    expect(ok(readFile(state, fileId))).toBe(large);
    expect(state.files[fileId].dataBlockIds).toHaveLength(
      requiredDataBlocks(24, 8)
    );
    expectClean(state);
  });

  it("treats empty files as zero data blocks", () => {
    let state = createEmptyFileSystem("indexed");
    const created = createFile(state, state.rootDirectoryId, "empty.txt", "");
    state = stateOf(created);
    const file = ok(created);
    expect(file.sizeBytes).toBe(0);
    expect(file.dataBlockIds).toEqual([]);
    expect(file.indexBlockId).toBeNull();
    expect(getDiskStats(state).usedBlocks).toBe(0);
  });
});

describe("contiguous allocation", () => {
  it("allocates a consecutive run", () => {
    const state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    const created = createFile(
      state,
      state.rootDirectoryId,
      "run.txt",
      "abcdefghij"
    );
    const file = ok(created);
    expect(file.dataBlockIds).toEqual([0, 1, 2]);
    expect(
      file.dataBlockIds.every(
        (id, i) => i === 0 || id === file.dataBlockIds[i - 1] + 1
      )
    ).toBe(true);
  });

  it("fails when free space is fragmented", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 6,
      blockSizeBytes: 4,
    });
    const files = ["a", "b", "c", "d", "e", "f"].map((name) => {
      const created = createFile(
        state,
        state.rootDirectoryId,
        `${name}.txt`,
        "aaaa"
      );
      state = stateOf(created);
      return created;
    });

    state = stateOf(deleteFile(state, ok(files[1]).id));
    state = stateOf(deleteFile(state, ok(files[3]).id));

    const fail = createFile(
      state,
      state.rootDirectoryId,
      "wide.txt",
      "xxxxxxxx"
    );
    expectFail(fail, "ALLOCATION_FAILED");
    expect(fail.state.files[ok(files[0]).id]?.content).toBe("aaaa");
    expectClean(fail.state);
  });
});

describe("linked allocation", () => {
  it("builds a valid next-block chain", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    const result = createFile(
      state,
      state.rootDirectoryId,
      "chain.txt",
      "1234567890"
    );
    state = stateOf(result);
    const file = ok(result);
    expect(file.dataBlockIds.length).toBeGreaterThan(1);
    const walked = traverseLinkedChain(state.disk, file.dataBlockIds[0]);
    expect(walked.ok).toBe(true);
    if (walked.ok) {
      expect(walked.chain).toEqual(file.dataBlockIds);
    }
    const last = file.dataBlockIds[file.dataBlockIds.length - 1];
    expect(state.disk.blocks[last].nextBlockId).toBeNull();
    expectClean(state);
  });
});

describe("indexed allocation", () => {
  it("counts the index block separately from data blocks", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const created = createFile(
      state,
      state.rootDirectoryId,
      "idx.txt",
      "0123456789ABCDEF"
    );
    state = stateOf(created);
    const file = ok(created);
    expect(file.dataBlockIds.length).toBe(2);
    expect(file.indexBlockId).not.toBeNull();
    expect(file.dataBlockIds).not.toContain(file.indexBlockId);
    const index = state.disk.blocks[file.indexBlockId!];
    expect(index.kind).toBe("index");
    expect(index.indexEntries).toEqual(file.dataBlockIds);
    expect(getDiskStats(state).allocatedIndexBlockCount).toBe(1);
    expect(getDiskStats(state).allocatedDataBlockCount).toBe(2);
    expect(getDiskStats(state).usedBlocks).toBe(3);
    expectClean(state);
  });
});

describe("deletion and space", () => {
  it("releases every owned block on delete", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const created = createFile(
      state,
      state.rootDirectoryId,
      "gone.txt",
      "0123456789ABCDEF"
    );
    state = stateOf(created);
    expect(getDiskStats(state).usedBlocks).toBeGreaterThan(0);
    state = stateOf(deleteFile(state, ok(created).id));
    expect(getDiskStats(state).usedBlocks).toBe(0);
    expect(state.disk.blocks.every((b) => !b.occupied)).toBe(true);
    expectClean(state);
  });

  it("rejects insufficient disk space without leaking files", () => {
    const state = createEmptyFileSystem("linked", {
      totalBlocks: 2,
      blockSizeBytes: 4,
    });
    const fail = createFile(
      state,
      state.rootDirectoryId,
      "huge.txt",
      "0123456789ABCDEF"
    );
    expectFail(fail, "INSUFFICIENT_SPACE");
    expect(Object.keys(fail.state.files)).toHaveLength(0);
    expect(getDiskStats(fail.state).usedBlocks).toBe(0);
  });
});

describe("directory operations", () => {
  it("rejects duplicate names in the same folder", () => {
    let state = createEmptyFileSystem();
    state = stateOf(createDirectory(state, state.rootDirectoryId, "Docs"));
    const dupDir = createDirectory(state, state.rootDirectoryId, "Docs");
    expectFail(dupDir, "DUPLICATE_NAME");
    state = stateOf(createFile(state, state.rootDirectoryId, "a.txt", "x"));
    expectFail(
      createFile(state, state.rootDirectoryId, "a.txt", "y"),
      "DUPLICATE_NAME"
    );
  });

  it("rejects invalid names and missing IDs", () => {
    const state = createEmptyFileSystem();
    expectFail(createDirectory(state, state.rootDirectoryId, "  "), "INVALID_NAME");
    expectFail(createDirectory(state, state.rootDirectoryId, "a/b"), "INVALID_NAME");
    expectFail(createDirectory(state, "missing", "x"), "NOT_FOUND");
    expectFail(deleteFile(state, "missing"), "NOT_FOUND");
  });

  it("prevents deleting a non-empty directory unless recursive", () => {
    let state = createEmptyFileSystem();
    const dir = createDirectory(state, state.rootDirectoryId, "Keep");
    state = stateOf(dir);
    state = stateOf(createFile(state, ok(dir).id, "in.txt", "1"));
    expectFail(deleteDirectory(state, ok(dir).id, false), "NOT_EMPTY");
    state = stateOf(deleteDirectory(state, ok(dir).id, true));
    expect(state.directories[ok(dir).id]).toBeUndefined();
    expect(Object.keys(state.files)).toHaveLength(0);
    expectClean(state);
  });

  it("prevents moving a directory into itself or a descendant", () => {
    let state = createEmptyFileSystem();
    const a = createDirectory(state, state.rootDirectoryId, "A");
    state = stateOf(a);
    const b = createDirectory(state, ok(a).id, "B");
    state = stateOf(b);
    expectFail(moveEntry(state, ok(a).id, ok(a).id, "directory"), "INVALID_MOVE");
    expectFail(moveEntry(state, ok(a).id, ok(b).id, "directory"), "INVALID_MOVE");
  });

  it("moves files and folders without changing a file allocation", () => {
    let state = createEmptyFileSystem("linked", { totalBlocks: 16, blockSizeBytes: 4 });
    const source = createDirectory(state, state.rootDirectoryId, "Source");
    state = stateOf(source);
    const destination = createDirectory(state, state.rootDirectoryId, "Destination");
    state = stateOf(destination);
    const child = createDirectory(state, ok(source).id, "Child");
    state = stateOf(child);
    const file = createFile(state, ok(source).id, "move.txt", "abcdefgh", "linked");
    state = stateOf(file);
    const allocationBefore = [...ok(file).dataBlockIds];

    state = stateOf(moveEntry(state, ok(file).id, ok(destination).id, "file"));
    expect(state.files[ok(file).id].parentId).toBe(ok(destination).id);
    expect(state.files[ok(file).id].dataBlockIds).toEqual(allocationBefore);

    state = stateOf(moveEntry(state, ok(source).id, ok(destination).id, "directory"));
    expect(state.directories[ok(source).id].parentId).toBe(ok(destination).id);
    expectFail(moveEntry(state, ok(destination).id, ok(child).id, "directory"), "INVALID_MOVE");
    expectClean(state);
  });

  it("rejects moves with a destination name conflict", () => {
    let state = createEmptyFileSystem();
    const a = createDirectory(state, state.rootDirectoryId, "A");
    state = stateOf(a);
    const b = createDirectory(state, state.rootDirectoryId, "B");
    state = stateOf(b);
    const source = createFile(state, ok(a).id, "same.txt", "one");
    state = stateOf(source);
    state = stateOf(createFile(state, ok(b).id, "same.txt", "two"));
    expectFail(moveEntry(state, ok(source).id, ok(b).id, "file"), "DUPLICATE_NAME");
  });

  it("keeps the previous state when persistence of a move fails", async () => {
    let state = createEmptyFileSystem();
    const source = createDirectory(state, state.rootDirectoryId, "A");
    state = stateOf(source);
    const destination = createDirectory(state, state.rootDirectoryId, "B");
    state = stateOf(destination);
    const file = createFile(state, ok(source).id, "keep.txt", "content");
    state = stateOf(file);

    const committed = await commitPersistedOperation(
      state,
      moveEntry(state, ok(file).id, ok(destination).id, "file"),
      async () => { throw new Error("Network unavailable"); }
    );
    expectFail(committed, "ALLOCATION_FAILED");
    expect(committed.state.files[ok(file).id].parentId).toBe(ok(source).id);
    expectClean(committed.state);
  });
});

describe("copy, rename, rollback", () => {
  it("copies files with independent block allocations", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    const original = createFile(
      state,
      state.rootDirectoryId,
      "src.txt",
      "payload-one"
    );
    state = stateOf(original);
    const copied = copyFile(
      state,
      ok(original).id,
      state.rootDirectoryId,
      "src-copy.txt"
    );
    state = stateOf(copied);
    expect(ok(copied).dataBlockIds).not.toEqual(ok(original).dataBlockIds);
    expect(
      ok(copied).dataBlockIds.some((id) =>
        ok(original).dataBlockIds.includes(id)
      )
    ).toBe(false);
    state = stateOf(writeFile(state, ok(original).id, "changed"));
    expect(ok(readFile(state, ok(copied).id))).toBe("payload-one");
    expectClean(state);
  });

  it("preserves previous content when a write fails", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 4,
      blockSizeBytes: 8,
    });
    const created = createFile(
      state,
      state.rootDirectoryId,
      "keep.txt",
      "original"
    );
    state = stateOf(created);
    const fileId = ok(created).id;
    const blocksBefore = [...state.files[fileId].dataBlockIds];

    const fail = writeFile(state, fileId, "x".repeat(64));
    expectFail(fail, "INSUFFICIENT_SPACE");
    expect(ok(readFile(fail.state, fileId))).toBe("original");
    expect(fail.state.files[fileId].dataBlockIds).toEqual(blocksBefore);
    expectClean(fail.state);
  });

  it("renames without overwriting siblings", () => {
    let state = createEmptyFileSystem();
    state = stateOf(createFile(state, state.rootDirectoryId, "a.txt", "1"));
    const b = createFile(state, state.rootDirectoryId, "b.txt", "2");
    state = stateOf(b);
    expectFail(
      renameEntry(state, ok(b).id, "a.txt", "file"),
      "DUPLICATE_NAME"
    );
    state = stateOf(renameEntry(state, ok(b).id, "c.txt", "file"));
    expect(state.files[ok(b).id].name).toBe("c.txt");
  });
});

describe("accounting after mixed operations", () => {
  it("keeps used + free = total and unique owners", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 32,
      blockSizeBytes: 16,
    });
    const docs = createDirectory(state, state.rootDirectoryId, "Docs");
    state = stateOf(docs);
    const f1 = createFile(state, ok(docs).id, "one.txt", "alpha", "contiguous");
    state = stateOf(f1);
    const f2 = createFile(state, ok(docs).id, "two.txt", "bravo-charlie", "linked");
    state = stateOf(f2);
    const f3 = createFile(state, state.rootDirectoryId, "three.txt", "delta", "indexed");
    state = stateOf(f3);
    state = stateOf(writeFile(state, ok(f1).id, "alpha-updated-content"));
    const copied = copyFile(state, ok(f2).id, state.rootDirectoryId, "two-copy.txt");
    state = stateOf(copied);
    state = stateOf(deleteFile(state, ok(f3).id));
    state = stateOf(
      moveEntry(state, ok(copied).id, ok(docs).id, "file")
    );

    const stats = getDiskStats(state);
    expect(stats.usedBlocks + stats.freeBlocks).toBe(stats.totalBlocks);
    expectClean(state);
    expect(listDirectory(state, ok(docs).id).files.map((f) => f.name).sort()).toEqual(
      ["one.txt", "two-copy.txt", "two.txt"]
    );
  });

  it("does not mutate state when previewing allocation", () => {
    const state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const snapshot = structuredClone(state);
    const preview = previewAllocation(state, "linked", 20);
    expect(preview.wouldSucceed).toBe(true);
    expect(state).toEqual(snapshot);
  });
});

describe("sample seed", () => {
  it("loads demonstration files without invariant violations", async () => {
    const { seedSampleFileSystem } = await import("@/lib/fs/seed");
    const seeded = seedSampleFileSystem("indexed");
    expectClean(seeded);
    expect(Object.keys(seeded.files).length).toBeGreaterThan(0);
  });
});

describe("persistence serialization", () => {
  it("restores nested directories, content, and all allocation strategies", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 32,
      blockSizeBytes: 8,
    });
    const docs = createDirectory(state, state.rootDirectoryId, "Docs");
    state = stateOf(docs);
    const nested = createDirectory(state, ok(docs).id, "Nested");
    state = stateOf(nested);
    const contiguous = createFile(state, ok(docs).id, "c.txt", "abcdefgh", "contiguous");
    state = stateOf(contiguous);
    const linked = createFile(state, ok(nested).id, "l.txt", "abcdefghijkl", "linked");
    state = stateOf(linked);
    const indexed = createFile(state, ok(nested).id, "i.txt", "1234567890", "indexed");
    state = stateOf(indexed);
    const empty = createFile(state, state.rootDirectoryId, "empty.txt", "", "indexed");
    state = stateOf(empty);

    const restored = restoreFileSystem(serializeFileSystem(state));
    expect(restored).toEqual(state);
    expect(restored.files[ok(empty).id].dataBlockIds).toEqual([]);
    expect(restored.files[ok(indexed).id].indexBlockId).not.toBeNull();
    expect(traverseLinkedChain(restored.disk, restored.files[ok(linked).id].dataBlockIds[0])).toMatchObject({ ok: true });
    expectClean(restored);
  });

  it("rejects malformed persisted snapshots without producing a partial state", () => {
    const state = createEmptyFileSystem("linked");
    const snapshot = serializeFileSystem(state);
    snapshot.disk.blocks = [];
    expect(() => restoreFileSystem(snapshot)).toThrow("Persisted virtual disk configuration is invalid");
  });
});

describe("allocateBlocks occupancy", () => {
  it("never marks an already occupied block", () => {
    const state = createEmptyFileSystem("linked", {
      totalBlocks: 4,
      blockSizeBytes: 8,
    });
    const first = createFile(state, state.rootDirectoryId, "a.txt", "12345678");
    const next = allocateBlocks(first.state, "linked", "file-x", "12345678");
    expect(next.success).toBe(true);
    const overlap = next.dataBlockIds.filter((id) =>
      ok(first).dataBlockIds.includes(id)
    );
    expect(overlap).toEqual([]);
  });
});

describe("allocation integrity validation", () => {
  it("detects a linked pointer that crosses into another file", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    const first = createFile(state, state.rootDirectoryId, "first.txt", "abcdefgh");
    state = stateOf(first);
    const second = createFile(state, state.rootDirectoryId, "second.txt", "ijkl");
    state = stateOf(second);

    state.disk.blocks[ok(first).dataBlockIds[1]].nextBlockId = ok(second).dataBlockIds[0];
    expect(assertInvariants(state).some((error) => error.code === "INVALID_BLOCK_CHAIN")).toBe(true);
  });

  it("detects an indexed file with corrupt references", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "index.txt", "abcdefgh");
    state = stateOf(created);
    const file = ok(created);
    state.disk.blocks[file.indexBlockId!].indexEntries = [file.dataBlockIds[1], file.dataBlockIds[0]];

    expect(assertInvariants(state).some((error) => error.code === "INVALID_BLOCK_CHAIN")).toBe(true);
  });
});

describe("educational allocation helpers", () => {
  it("demonstrates external fragmentation without mutating a user state", () => {
    const demo = createExternalFragmentationDemo();
    expect(demo.state.disk.blocks.filter((block) => !block.occupied)).toHaveLength(4);
    expect(demo.largestFreeRun).toBe(2);
    expect(demo.contiguous.wouldSucceed).toBe(false);
    expect(demo.contiguous.error?.code).toBe("ALLOCATION_FAILED");
    expect(demo.linked.wouldSucceed).toBe(true);
    expectClean(demo.state);
  });

  it("calculates only unused data-block capacity as internal fragmentation", () => {
    let state = createEmptyFileSystem("indexed", { totalBlocks: 8, blockSizeBytes: 8 });
    const file = createFile(state, state.rootDirectoryId, "small.txt", "abc", "indexed");
    state = stateOf(file);
    expect(internalFragmentationBytes(ok(file), state.disk.blockSizeBytes)).toBe(5);
    expect(ok(file).indexBlockId).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 tests

// ─────────────────────────────────────────────────────────────────────────────

describe("block owner resolution", () => {
  it("DiskBlock.ownerFileId resolves to the correct file name", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "owner.txt", "12345678");
    state = stateOf(created);
    const file = ok(created);
    for (const blockId of file.dataBlockIds) {
      const block = state.disk.blocks[blockId];
      expect(block.occupied).toBe(true);
      expect(block.ownerFileId).toBe(file.id);
      expect(state.files[block.ownerFileId!]?.name).toBe("owner.txt");
    }
  });
});

describe("preview immutability", () => {
  it("previewAllMethods does not mutate state for any method", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "base.txt", "hello");
    state = stateOf(created);
    const snapshot = structuredClone(state);

    const previews = previewAllMethods(state, 16);
    expect(previews).toHaveLength(3);
    // committed state must be unchanged
    expect(state).toEqual(snapshot);
    // previews must not share any allocated block IDs with the snapshot
    for (const preview of previews) {
      if (preview.wouldSucceed) {
        for (const id of preview.proposedDataBlockIds) {
          // block must still be free in the original state
          expect(snapshot.disk.blocks[id].occupied).toBe(false);
        }
      }
    }
  });

  it("previewAllocation does not consume real free blocks", () => {
    const state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const stateBefore = structuredClone(state);
    const preview = previewAllocation(state, "indexed", 16);
    expect(preview.wouldSucceed).toBe(true);
    // original state must be untouched
    expect(state).toEqual(stateBefore);
    expect(getDiskStats(state).usedBlocks).toBe(0);
  });
});

describe("freeRunLayout helper", () => {
  it("returns correct runs on a clean disk", () => {
    const state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    const runs = freeRunLayout(state.disk);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({ start: 0, length: 8 });
  });

  it("returns multiple runs after deletions", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    // fill all 8 blocks (1-block files)
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"].map((name) => {
      const r = createFile(state, state.rootDirectoryId, `${name}.txt`, "data", "contiguous");
      state = stateOf(r);
      return r;
    });
    // delete files 1 and 3 (0-indexed) → blocks 1 and 3 become free
    state = stateOf(deleteFile(state, ok(files[1]).id));
    state = stateOf(deleteFile(state, ok(files[3]).id));

    const runs = freeRunLayout(state.disk);
    expect(runs).toHaveLength(2);
    expect(runs[0].length).toBe(1);
    expect(runs[1].length).toBe(1);
  });

  it("returns empty array for a fully occupied disk", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 4,
      blockSizeBytes: 4,
    });
    for (const name of ["a", "b", "c", "d"]) {
      const r = createFile(state, state.rootDirectoryId, `${name}.txt`, "data", "contiguous");
      state = stateOf(r);
    }
    expect(getDiskStats(state).freeBlocks).toBe(0);
    expect(freeRunLayout(state.disk)).toHaveLength(0);
  });
});

describe("storage stats correctness", () => {
  it("accounts correctly after a sequence of create, write, and delete", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 32,
      blockSizeBytes: 16,
    });
    const f1 = createFile(state, state.rootDirectoryId, "a.txt", "x".repeat(16), "indexed");
    state = stateOf(f1);
    const f2 = createFile(state, state.rootDirectoryId, "b.txt", "y".repeat(16), "contiguous");
    state = stateOf(f2);

    const before = getDiskStats(state);
    expect(before.usedBlocks + before.freeBlocks).toBe(before.totalBlocks);

    // Write a larger content to f1
    state = stateOf(writeFile(state, ok(f1).id, "z".repeat(32)));
    // Delete f2
    state = stateOf(deleteFile(state, ok(f2).id));

    const after = getDiskStats(state);
    expect(after.usedBlocks + after.freeBlocks).toBe(after.totalBlocks);
    expectClean(state);
  });
});

describe("getFileAllocationView", () => {
  it("includes index-block overhead in allocatedCapacityBytes", () => {
    let state = createEmptyFileSystem("indexed", {
      totalBlocks: 8,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "idx.txt", "12345678", "indexed");
    state = stateOf(created);
    const file = ok(created);

    const view = getFileAllocationView(state, file.id);
    expect(view).not.toBeNull();
    expect(view!.indexBlockId).not.toBeNull();
    // allocatedCapacity = (dataBlocks + 1 index) × blockSize
    const expected = (file.dataBlockIds.length + 1) * state.disk.blockSizeBytes;
    expect(view!.allocatedCapacityBytes).toBe(expected);
    expect(getDiskStats(state).allocatedIndexBlockCount).toBe(1);
  });

  it("returns correct linked chain with next-pointer data", () => {
    let state = createEmptyFileSystem("linked", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    const created = createFile(state, state.rootDirectoryId, "chain.txt", "12345678", "linked");
    state = stateOf(created);
    const file = ok(created);

    const view = getFileAllocationView(state, file.id);
    expect(view).not.toBeNull();
    expect(view!.linkedChain).toHaveLength(file.dataBlockIds.length);

    for (let i = 0; i < view!.linkedChain.length; i++) {
      expect(view!.linkedChain[i].blockId).toBe(file.dataBlockIds[i]);
      const expectedNext = i < file.dataBlockIds.length - 1
        ? file.dataBlockIds[i + 1]
        : null;
      expect(view!.linkedChain[i].nextBlockId).toBe(expectedNext);
    }
  });
});

describe("internal fragmentation calculation", () => {
  it("calculates fragmentation for a multi-block file's last block", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    // 10 bytes in 8-byte blocks → 2 blocks, last block has 6 bytes unused
    const created = createFile(state, state.rootDirectoryId, "frag.txt", "0123456789", "contiguous");
    state = stateOf(created);
    const file = ok(created);
    expect(file.dataBlockIds).toHaveLength(2);
    expect(internalFragmentationBytes(file, state.disk.blockSizeBytes)).toBe(6);
  });

  it("returns 0 internal fragmentation for a perfectly block-aligned file", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    const created = createFile(state, state.rootDirectoryId, "aligned.txt", "12345678", "contiguous");
    state = stateOf(created);
    const file = ok(created);
    expect(file.dataBlockIds).toHaveLength(1);
    expect(internalFragmentationBytes(file, state.disk.blockSizeBytes)).toBe(0);
  });
});

describe("compare allocation strategies (previewAllMethods)", () => {
  it("returns 3 previews with correct totalBlocksNeeded for indexed", () => {
    const state = createEmptyFileSystem("indexed", {
      totalBlocks: 16,
      blockSizeBytes: 8,
    });
    // 16 bytes → 2 data blocks needed
    const previews = previewAllMethods(state, 16);
    expect(previews).toHaveLength(3);

    const byMethod = Object.fromEntries(previews.map((p) => [p.method, p]));
    expect(byMethod["contiguous"].requiredDataBlocks).toBe(2);
    expect(byMethod["contiguous"].totalBlocksNeeded).toBe(2); // no index
    expect(byMethod["linked"].totalBlocksNeeded).toBe(2);
    expect(byMethod["indexed"].totalBlocksNeeded).toBe(3); // 2 data + 1 index
  });

  it("uses the same initial free map for all three previews", () => {
    let state = createEmptyFileSystem("contiguous", {
      totalBlocks: 8,
      blockSizeBytes: 4,
    });
    // Fill blocks 0 and 1 with a file
    const created = createFile(state, state.rootDirectoryId, "x.txt", "12345678", "contiguous");
    state = stateOf(created);
    const snapshot = structuredClone(state);

    previewAllMethods(state, 8);
    // original state must remain unchanged
    expect(state).toEqual(snapshot);
  });
});

describe("external fragmentation: contiguous fails, linked succeeds", () => {
  it("createExternalFragmentationDemo has expected free-block count and run size", () => {
    const demo = createExternalFragmentationDemo();
    const freeBlocks = demo.state.disk.blocks.filter((b) => !b.occupied).length;
    expect(freeBlocks).toBe(4);
    expect(demo.largestFreeRun).toBeLessThan(demo.requiredDataBlocks);
    expect(demo.contiguous.wouldSucceed).toBe(false);
    expect(demo.contiguous.error?.code).toBe("ALLOCATION_FAILED");
    expect(demo.linked.wouldSucceed).toBe(true);
    expect(demo.linked.proposedDataBlockIds).toHaveLength(demo.requiredDataBlocks);
    expectClean(demo.state);
  });
});
