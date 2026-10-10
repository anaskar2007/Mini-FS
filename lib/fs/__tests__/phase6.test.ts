import { describe, expect, it } from "vitest";
import {
  createBinaryFile,
  createEmptyFileSystem,
  createFile,
  deleteFile,
  assertInvariants,
} from "@/lib/fs/engine";
import {
  getFileIcon,
  getFolderIcon,
  isTextFile,
  isBinaryFile,
  isImageFile,
  isPdfFile,
  MAX_UPLOAD_BYTES,
  isAllowedMimeType,
} from "@/lib/file-type";
import { File, FileCode, FileImage, FileJson, FileText, Folder } from "lucide-react";

// ─── Binary file registration ─────────────────────────────────────────────────

describe("createBinaryFile", () => {
  it("creates a binary file with the provided metadata", () => {
    const state = createEmptyFileSystem();
    const result = createBinaryFile(
      state,
      state.rootDirectoryId,
      "photo.jpg",
      2048,
      "image/jpeg",
      "user-id/file-id/photo.jpg"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");

    const file = result.value;
    expect(file.name).toBe("photo.jpg");
    expect(file.mimeType).toBe("image/jpeg");
    expect(file.storagePath).toBe("user-id/file-id/photo.jpg");
    expect(file.sizeBytes).toBe(2048);
    expect(file.content).toBe(""); // binary files have no text content
  });

  it("allocates virtual disk blocks for a small binary file (≤ disk capacity)", () => {
    const state = createEmptyFileSystem();
    // 1 KiB = exactly one block
    const result = createBinaryFile(
      state, state.rootDirectoryId, "small.png", 1024, "image/png", "u/f/small.png"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.diskAllocated).toBe(true);
    expect(result.value.dataBlockIds.length).toBeGreaterThan(0);
  });

  it("marks diskAllocated=false for a file that exceeds virtual disk capacity", () => {
    const state = createEmptyFileSystem(); // 1024 blocks × 1024 = 1048576 bytes
    const oversizedBytes = 2000 * 1024; // 2000 KiB > 1024 KiB capacity
    const result = createBinaryFile(
      state, state.rootDirectoryId, "big.zip", oversizedBytes, "application/zip", "u/f/big.zip"
    );
    expect(result.ok).toBe(true); // succeeds — file is registered
    if (!result.ok) throw new Error();
    expect(result.value.diskAllocated).toBe(false); // but not allocated
    expect(result.value.dataBlockIds).toHaveLength(0);
    expect(result.value.indexBlockId).toBeNull();
  });

  it("maintains disk invariants after binary file creation", () => {
    const state = createEmptyFileSystem();
    const result = createBinaryFile(
      state, state.rootDirectoryId, "img.webp", 2048, "image/webp", "u/f/img.webp"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    const errors = assertInvariants(result.state);
    expect(errors).toHaveLength(0);
  });

  it("releases blocks correctly when a binary file is deleted", () => {
    const state = createEmptyFileSystem();
    const result = createBinaryFile(
      state, state.rootDirectoryId, "doc.pdf", 2048, "application/pdf", "u/f/doc.pdf"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    const file = result.value;

    const blocksBefore = result.state.disk.blocks.filter((b) => b.occupied).length;
    const delResult = deleteFile(result.state, file.id);
    expect(delResult.ok).toBe(true);
    if (!delResult.ok) throw new Error();
    const blocksAfter = delResult.state.disk.blocks.filter((b) => b.occupied).length;
    expect(blocksAfter).toBeLessThan(blocksBefore);
    expect(delResult.state.files[file.id]).toBeUndefined();
  });

  it("rejects duplicate filenames in the same folder", () => {
    const state = createEmptyFileSystem();
    const r1 = createBinaryFile(
      state, state.rootDirectoryId, "dup.png", 100, "image/png", "u/f/dup.png"
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) throw new Error();
    const r2 = createBinaryFile(
      r1.state, state.rootDirectoryId, "dup.png", 100, "image/png", "u/f/dup2.png"
    );
    expect(r2.ok).toBe(false);
    if (r2.ok) throw new Error();
    expect(r2.error.code).toBe("DUPLICATE_NAME");
  });

  it("unallocated binary file passes assertInvariants", () => {
    const state = createEmptyFileSystem();
    const result = createBinaryFile(
      state, state.rootDirectoryId, "huge.zip", 999_999, "application/zip", "u/f/huge.zip"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.diskAllocated).toBe(false);
    const errors = assertInvariants(result.state);
    expect(errors).toHaveLength(0);
  });
});

// ─── Existing text files still get diskAllocated=true ─────────────────────────

describe("createFile (text, existing behaviour)", () => {
  it("sets diskAllocated=true for text files", () => {
    const state = createEmptyFileSystem();
    const result = createFile(state, state.rootDirectoryId, "hello.txt", "hello");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.diskAllocated).toBe(true);
    expect(result.value.mimeType).toBeNull();
    expect(result.value.storagePath).toBeNull();
  });
});

// ─── File-type icon resolver ──────────────────────────────────────────────────

describe("getFileIcon", () => {
  it("returns FileImage for png", () => expect(getFileIcon("photo.png")).toBe(FileImage));
  it("returns FileImage for jpeg", () => expect(getFileIcon("photo.jpeg")).toBe(FileImage));
  it("returns FileImage for webp", () => expect(getFileIcon("img.webp")).toBe(FileImage));
  it("returns FileCode for ts", () => expect(getFileIcon("index.ts")).toBe(FileCode));
  it("returns FileCode for js", () => expect(getFileIcon("app.js")).toBe(FileCode));
  it("returns FileCode for py", () => expect(getFileIcon("script.py")).toBe(FileCode));
  it("returns FileCode for java", () => expect(getFileIcon("Main.java")).toBe(FileCode));
  it("returns FileJson for json", () => expect(getFileIcon("data.json")).toBe(FileJson));
  it("returns FileText for md", () => expect(getFileIcon("README.md")).toBe(FileText));
  it("returns FileText for pdf", () => expect(getFileIcon("report.pdf")).toBe(FileText));
  it("falls back to File for unknown extension", () => expect(getFileIcon("data.xyz")).toBe(File));
  it("uses MIME type as fallback when extension unknown", () =>
    expect(getFileIcon("data", "image/png")).toBe(FileImage));
  it("returns Folder for getFolderIcon()", () => expect(getFolderIcon()).toBe(Folder));
});

// ─── Type predicates ──────────────────────────────────────────────────────────

describe("isTextFile / isBinaryFile / isImageFile / isPdfFile", () => {
  it("txt is text", () => expect(isTextFile("readme.txt")).toBe(true));
  it("ts is text", () => expect(isTextFile("app.ts")).toBe(true));
  it("json is text", () => expect(isTextFile("config.json")).toBe(true));
  it("png is not text", () => expect(isTextFile("photo.png")).toBe(false));
  it("pdf is not text", () => expect(isTextFile("doc.pdf")).toBe(false));

  it("png is binary", () => expect(isBinaryFile("photo.png")).toBe(true));
  it("ts is not binary", () => expect(isBinaryFile("app.ts")).toBe(false));

  it("jpg is image", () => expect(isImageFile("photo.jpg")).toBe(true));
  it("webp is image", () => expect(isImageFile("img.webp")).toBe(true));
  it("txt is not image", () => expect(isImageFile("readme.txt")).toBe(false));
  it("uses MIME for image detection", () => expect(isImageFile("blob", "image/svg+xml")).toBe(true));

  it("pdf is PDF", () => expect(isPdfFile("report.pdf")).toBe(true));
  it("jpg is not PDF", () => expect(isPdfFile("photo.jpg")).toBe(false));
  it("uses MIME for PDF detection", () => expect(isPdfFile("blob", "application/pdf")).toBe(true));
});

// ─── Upload validation ────────────────────────────────────────────────────────

describe("upload validation constants", () => {
  it("MAX_UPLOAD_BYTES is 10 MB", () => expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024));
  it("allows common image types", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/webp")).toBe(true);
  });
  it("allows PDF", () => expect(isAllowedMimeType("application/pdf")).toBe(true));
  it("allows JSON", () => expect(isAllowedMimeType("application/json")).toBe(true));
  it("allows text types", () => expect(isAllowedMimeType("text/plain")).toBe(true));
  it("allows zip", () => expect(isAllowedMimeType("application/zip")).toBe(true));
  it("blocks executables", () => expect(isAllowedMimeType("application/x-msdownload")).toBe(false));
});
