export type AllocationMethodLabel = "contiguous" | "linked" | "indexed";

export type MockEntryType = "folder" | "file";

export interface MockEntry {
  id: string;
  name: string;
  type: MockEntryType;
  parentId: string | null;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  mimeType?: string;
  extension?: string;
  allocatedBlocks?: number;
}

export const VIRTUAL_DISK = {
  totalBlocks: 1024,
  blockSizeBytes: 1024,
  usedBlocks: 47,
  freeBlocks: 977,
  allocationMethod: "indexed" as AllocationMethodLabel,
};

/** Sample tree for demos — no database required. */
export const MOCK_ENTRIES: MockEntry[] = [
  {
    id: "root",
    name: "MiniFS",
    type: "folder",
    parentId: null,
    sizeBytes: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    modifiedAt: "2026-03-28T14:22:00.000Z",
  },
  {
    id: "folder-documents",
    name: "Documents",
    type: "folder",
    parentId: "root",
    sizeBytes: 0,
    createdAt: "2026-03-02T10:00:00.000Z",
    modifiedAt: "2026-03-27T11:05:00.000Z",
  },
  {
    id: "folder-projects",
    name: "Projects",
    type: "folder",
    parentId: "root",
    sizeBytes: 0,
    createdAt: "2026-03-02T10:05:00.000Z",
    modifiedAt: "2026-03-28T09:15:00.000Z",
  },
  {
    id: "folder-minifs",
    name: "MiniFS",
    type: "folder",
    parentId: "folder-projects",
    sizeBytes: 0,
    createdAt: "2026-03-10T08:00:00.000Z",
    modifiedAt: "2026-03-28T13:40:00.000Z",
  },
  {
    id: "folder-system",
    name: "System",
    type: "folder",
    parentId: "root",
    sizeBytes: 0,
    createdAt: "2026-03-01T09:10:00.000Z",
    modifiedAt: "2026-03-15T16:00:00.000Z",
  },
  {
    id: "file-readme",
    name: "README.md",
    type: "file",
    parentId: "folder-minifs",
    sizeBytes: 2048,
    createdAt: "2026-03-10T08:30:00.000Z",
    modifiedAt: "2026-03-28T13:40:00.000Z",
    extension: "md",
    mimeType: "text/markdown",
    allocatedBlocks: 2,
  },
  {
    id: "file-architecture",
    name: "architecture.txt",
    type: "file",
    parentId: "folder-minifs",
    sizeBytes: 1536,
    createdAt: "2026-03-12T12:00:00.000Z",
    modifiedAt: "2026-03-26T18:20:00.000Z",
    extension: "txt",
    mimeType: "text/plain",
    allocatedBlocks: 2,
  },
  {
    id: "file-notes",
    name: "lecture-notes.txt",
    type: "file",
    parentId: "folder-documents",
    sizeBytes: 4096,
    createdAt: "2026-03-05T14:00:00.000Z",
    modifiedAt: "2026-03-27T11:05:00.000Z",
    extension: "txt",
    mimeType: "text/plain",
    allocatedBlocks: 4,
  },
  {
    id: "file-report",
    name: "os-unit-report.md",
    type: "file",
    parentId: "folder-documents",
    sizeBytes: 8192,
    createdAt: "2026-03-08T09:00:00.000Z",
    modifiedAt: "2026-03-25T20:10:00.000Z",
    extension: "md",
    mimeType: "text/markdown",
    allocatedBlocks: 8,
  },
  {
    id: "file-disk-map",
    name: "disk-layout.json",
    type: "file",
    parentId: "folder-system",
    sizeBytes: 512,
    createdAt: "2026-03-01T09:15:00.000Z",
    modifiedAt: "2026-03-15T16:00:00.000Z",
    extension: "json",
    mimeType: "application/json",
    allocatedBlocks: 1,
  },
  {
    id: "file-boot",
    name: "boot-config.txt",
    type: "file",
    parentId: "folder-system",
    sizeBytes: 256,
    createdAt: "2026-03-01T09:12:00.000Z",
    modifiedAt: "2026-03-01T09:12:00.000Z",
    extension: "txt",
    mimeType: "text/plain",
    allocatedBlocks: 1,
  },
  {
    id: "file-todo",
    name: "project-todo.txt",
    type: "file",
    parentId: "folder-projects",
    sizeBytes: 1024,
    createdAt: "2026-03-11T07:00:00.000Z",
    modifiedAt: "2026-03-28T09:15:00.000Z",
    extension: "txt",
    mimeType: "text/plain",
    allocatedBlocks: 1,
  },
];

export const ROOT_FOLDER_ID = "root";
