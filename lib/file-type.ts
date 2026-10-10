import {
  Archive,
  Code,
  Database,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  FileVideo,
  Folder,
  Music,
  type LucideIcon,
} from "lucide-react";

// ─── Extension → language ID (for CodeMirror) ─────────────────────────────────

const EXT_LANGUAGE: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  py: "python",
  java: "java",
  css: "css", scss: "css",
  html: "html", htm: "html", xml: "xml", svg: "xml",
  json: "json", jsonc: "json",
  sql: "sql",
  md: "markdown", mdx: "markdown",
  c: "c", h: "c",
  cpp: "cpp", cc: "cpp", cxx: "cpp", hh: "cpp", hpp: "cpp",
  rs: "rust",
  go: "go",
  rb: "ruby",
  php: "php",
  sh: "shell", bash: "shell", zsh: "shell",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  txt: "text",
};

export function getLanguageId(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE[ext] ?? "text";
}

// ─── Extension / MIME → Lucide icon ──────────────────────────────────────────

const EXT_ICON: Record<string, LucideIcon> = {
  // Text / documents
  txt: FileText, md: FileText, mdx: FileText, log: FileText,
  pdf: FileText,
  // Code
  js: FileCode, jsx: FileCode, ts: FileCode, tsx: FileCode,
  mjs: FileCode, cjs: FileCode, mts: FileCode,
  py: FileCode, java: FileCode, c: FileCode, h: FileCode,
  cpp: FileCode, cc: FileCode, cxx: FileCode, hh: FileCode, hpp: FileCode,
  rs: FileCode, go: FileCode, rb: FileCode, php: FileCode,
  sh: FileCode, bash: FileCode, zsh: FileCode,
  // Markup / styles
  html: Code, htm: Code, xml: Code, svg: FileImage,
  css: Code, scss: Code,
  // Data
  json: FileJson, jsonc: FileJson, yaml: FileText, yml: FileText, toml: FileText,
  csv: Database, sql: Database,
  // Images
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage,
  webp: FileImage, bmp: FileImage, ico: FileImage, avif: FileImage,
  // Video
  mp4: FileVideo, mov: FileVideo, avi: FileVideo, mkv: FileVideo, webm: FileVideo,
  // Audio
  mp3: Music, wav: Music, ogg: Music, flac: Music, m4a: Music,
  // Archives
  zip: Archive, tar: Archive, gz: Archive, bz2: Archive, "7z": Archive, rar: Archive,
};

const MIME_ICON: Record<string, LucideIcon> = {
  "text/": FileText,
  "application/json": FileJson,
  "application/pdf": FileText,
  "image/": FileImage,
  "image/svg+xml": FileImage,
  "video/": FileVideo,
  "audio/": Music,
  "application/zip": Archive,
  "application/x-tar": Archive,
  "application/gzip": Archive,
};

function iconFromMime(mimeType: string): LucideIcon | null {
  // Exact match first
  if (MIME_ICON[mimeType]) return MIME_ICON[mimeType];
  // Prefix match
  for (const [prefix, icon] of Object.entries(MIME_ICON)) {
    if (mimeType.startsWith(prefix)) return icon;
  }
  return null;
}

export function getFileIcon(
  filename: string,
  mimeType?: string | null
): LucideIcon {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXT_ICON[ext]) return EXT_ICON[ext];
  if (mimeType) {
    const fromMime = iconFromMime(mimeType);
    if (fromMime) return fromMime;
  }
  return File;
}

export function getFolderIcon(): LucideIcon {
  return Folder;
}

// ─── Type predicates ──────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  "txt", "md", "mdx", "json", "jsonc", "yaml", "yml", "toml", "csv",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "mts",
  "py", "java", "c", "h", "cpp", "cc", "cxx", "hh", "hpp",
  "rs", "go", "rb", "php", "sh", "bash", "zsh",
  "html", "htm", "xml", "css", "scss", "sql",
  "log", "ini", "env", "gitignore", "dockerignore",
]);

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif",
]);

const PDF_EXTS = new Set(["pdf"]);

export function isTextFile(filename: string, mimeType?: string | null): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (TEXT_EXTS.has(ext)) return true;
  if (mimeType && mimeType.startsWith("text/")) return true;
  return false;
}

export function isImageFile(filename: string, mimeType?: string | null): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return true;
  if (mimeType && mimeType.startsWith("image/")) return true;
  return false;
}

export function isPdfFile(filename: string, mimeType?: string | null): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (PDF_EXTS.has(ext)) return true;
  if (mimeType === "application/pdf") return true;
  return false;
}

export function isBinaryFile(filename: string, mimeType?: string | null): boolean {
  return !isTextFile(filename, mimeType);
}

// ─── Upload validation ────────────────────────────────────────────────────────

/** Maximum upload size: 10 MB */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * MIME types permitted for upload. Blocks executables and scripts that could
 * be served back as trusted application markup.
 */
export const ALLOWED_UPLOAD_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "text/",
  "application/json",
  "application/pdf",
  "application/zip",
  "application/x-tar",
  "application/gzip",
  "application/x-7z-compressed",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/msword",
  "application/octet-stream",
];

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_UPLOAD_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

export function getAcceptAttribute(): string {
  // Used as the `accept` attribute on <input type="file">
  return [
    "image/*", "video/*", "audio/*", "text/*",
    ".json", ".pdf", ".zip", ".tar", ".gz", ".7z",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ].join(",");
}
