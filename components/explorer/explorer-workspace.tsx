"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Copy,
  Grid2X2,
  FilePlus,
  Folder,
  FolderInput,
  FolderPlus,
  Pencil,
  Search,
  List,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { FeedbackBanner } from "@/components/fs/feedback-banner";
import { FilePreview } from "@/components/fs/file-preview";
import { FilenameDisplay } from "@/components/fs/filename-display";
import { UploadDialog } from "@/components/fs/upload-dialog";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { NamePrompt } from "@/components/fs/name-prompt";
import { MoveDialog, type MoveTarget } from "@/components/fs/move-dialog";
import { DeleteFolderDialog } from "@/components/fs/delete-folder-dialog";
import { DirectoryTree } from "@/components/explorer/directory-tree";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, formatDate, allocationMethodLabel } from "@/lib/format";
import {
  copyFile,
  createBinaryFile,
  createDirectory,
  createFile,
  deleteDirectory,
  deleteFile,
  getPathToRoot,
  listDirectory,
  moveEntry,
  renameEntry,
  searchInDirectoryTree,
  writeFile,
  generateUniqueName,
  previewAllocation,
  type DirectoryEntry,
  type FileEntry,
} from "@/lib/fs";
import { getFileIcon } from "@/lib/file-type";
import { deleteStorageObject } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

type ListingItem =
  | { type: "folder"; entry: DirectoryEntry }
  | { type: "file"; entry: FileEntry };

type PromptKind = "file" | "folder" | "rename" | "move" | "upload" | "delete-folder" | null;

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return "File";
  return name.slice(i + 1).toUpperCase();
}

function allocatedBlocks(file: FileEntry): number {
  return file.dataBlockIds.length + (file.indexBlockId !== null ? 1 : 0);
}

export function ExplorerWorkspace() {
  const { state, apply } = useFileSystem();
  const searchParams = useSearchParams();
  const initFileId = searchParams.get("fileId");
  const initFile = initFileId ? state.files[initFileId] : null;

  const [currentFolderId, setCurrentFolderId] = useState(
    initFile ? initFile.parentId : state.rootDirectoryId
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initFileId);
  const [prompt, setPrompt] = useState<PromptKind>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const dropRef = useRef<HTMLDivElement>(null);

  // Sync route params when navigating
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const fId = searchParams.get("fileId");
    startTransition(() => {
      setSearchQuery(q);
      if (fId && state.files[fId]) {
        setCurrentFolderId(state.files[fId].parentId);
        setSelectedId(fId);
      }
    });
  }, [searchParams, state.files]);

  useEffect(() => {
    try {
      const savedView = localStorage.getItem("minifs_default_view");
      if (savedView === "grid" || savedView === "list") startTransition(() => setView(savedView));
    } catch { /* Storage may be unavailable in private browsing. */ }
  }, []);

  function changeView(nextView: "grid" | "list") {
    setView(nextView);
    try { localStorage.setItem("minifs_default_view", nextView); } catch { /* Storage is optional. */ }
  }

  const folderExists = Boolean(state.directories[currentFolderId]);
  const folderId = folderExists ? currentFolderId : state.rootDirectoryId;

  const breadcrumbs = useMemo(
    () => getPathToRoot(state, folderId),
    [folderId, state]
  );

  const listing = useMemo<ListingItem[]>(() => {
    const q = searchQuery.trim();
    if (q) {
      return searchInDirectoryTree(state, folderId, q).map((hit) =>
        hit.kind === "directory"
          ? { type: "folder" as const, entry: hit.entry }
          : { type: "file" as const, entry: hit.entry }
      );
    }
    const { directories, files } = listDirectory(state, folderId);
    return [
      ...directories.map((entry) => ({ type: "folder" as const, entry })),
      ...files.map((entry) => ({ type: "file" as const, entry })),
    ];
  }, [folderId, searchQuery, state]);

  const selectedFile =
    selectedId && state.files[selectedId] ? state.files[selectedId] : undefined;
  const currentFolder = state.directories[folderId];
  const canMutateFolder =
    Boolean(currentFolder) && currentFolder.id !== state.rootDirectoryId;
  const renameTarget = selectedFile ?? (canMutateFolder ? currentFolder : undefined);
  const moveTarget: MoveTarget | null = selectedFile
    ? { id: selectedFile.id, name: selectedFile.name, parentId: selectedFile.parentId, kind: "file" }
    : canMutateFolder && currentFolder
      ? { id: currentFolder.id, name: currentFolder.name, parentId: currentFolder.parentId ?? "", kind: "directory" }
      : null;

  function openFolder(id: string) {
    setCurrentFolderId(id);
    setSearchQuery("");
    setSelectedId(null);
  }

  function selectFile(file: FileEntry) {
    setSelectedId(file.id);
  }

  function onRowActivate(item: ListingItem) {
    if (item.type === "folder") { openFolder(item.entry.id); return; }
    selectFile(item.entry);
  }

  // Keyboard delete / rename
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!selectedId) return;
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "F2") { setPrompt("rename"); }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [selectedId]);

  // Global drag-and-drop on the file list area
  function onDragOverList(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  }
  function onDragLeaveList(e: React.DragEvent) {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }
  function onDropList(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) setPrompt("upload");
  }

  // Save text file
  const handleSave = useCallback(async (content: string) => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await apply(writeFile(state, selectedFile.id, content), "File saved.");
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, state, apply]);

  // Delete with storage cleanup
  async function handleDelete() {
    if (selectedFile) {
      const { storagePath } = selectedFile;
      const id = selectedFile.id;
      const deleted = await apply(deleteFile(state, id), "File deleted.");
      if (deleted !== null && storagePath) {
        const ok = await deleteStorageObject(storagePath);
        if (!ok) toast.error("File removed from filesystem but storage cleanup failed. You may need to delete it manually from Supabase Storage.");
      }
      if (deleted !== null) setSelectedId(null);
      return;
    }
    if (currentFolder && canMutateFolder) {
      setPrompt("delete-folder");
    }
  }

  async function handleConfirmDeleteFolder() {
    if (!currentFolder || !canMutateFolder) return;
    const parentId = currentFolder.parentId ?? state.rootDirectoryId;
    
    // Collect all storage paths for binary files in this directory tree
    const pathsToDelete: string[] = [];
    function collectPaths(dirId: string) {
      const listing = listDirectory(state, dirId);
      for (const f of listing.files) {
        if (f.storagePath) pathsToDelete.push(f.storagePath);
      }
      for (const d of listing.directories) {
        collectPaths(d.id);
      }
    }
    collectPaths(currentFolder.id);

    // Apply recursive delete to filesystem state
    const deleted = await apply(deleteDirectory(state, currentFolder.id, true), "Folder deleted.");
    if (deleted !== null) {
      setPrompt(null);
      openFolder(parentId);
      
      // Cleanup storage objects
      if (pathsToDelete.length > 0) {
        let failed = 0;
        for (const path of pathsToDelete) {
          const ok = await deleteStorageObject(path);
          if (!ok) failed++;
        }
        if (failed > 0) {
          toast.error(`${failed} file(s) failed to clean up from Supabase Storage.`);
        }
      }
    }
  }

  // Upload completion handler
  async function handleUploaded(params: {
    fileId: string; name: string; sizeBytes: number; mimeType: string; storagePath: string;
  }) {
    const finalName = generateUniqueName(state, folderId, params.name);
    const result = createBinaryFile(
      state, folderId, finalName, params.sizeBytes, params.mimeType,
      params.storagePath, state.defaultAllocationMethod
    );
    const created = await apply(result);
    if (created === null) {
      throw new Error("Failed to register uploaded file in the filesystem.");
    }
    let unallocatedReason = "File exceeds virtual disk capacity";
    if (!created.diskAllocated) {
      const preview = previewAllocation(state, created.allocationMethod, params.sizeBytes);
      if (!preview.wouldSucceed && preview.error) {
        unallocatedReason = preview.error.message;
      }
    }
    toast.success(
      created.diskAllocated
        ? `${finalName} uploaded and allocated on virtual disk.`
        : `${finalName} uploaded. ${unallocatedReason} (Stored in Supabase Storage only).`
    );
  }

  return (
    <>
      <FeedbackBanner />
      <div
        ref={dropRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-background lg:flex-row",
          isDraggingOver && "ring-2 ring-primary/40 ring-inset"
        )}
        onDragOver={onDragOverList}
        onDragLeave={onDragLeaveList}
        onDrop={onDropList}
      >
        {/* ── Directory tree sidebar ── */}
        <div className="w-full border-b border-border bg-sidebar/50 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r xl:w-64">
          <div className="px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Directories
            </p>
          </div>
          <ScrollArea className="h-[180px] lg:h-[calc(100vh-13rem)]">
            <ul className="space-y-0.5 px-3 pb-3">
              <DirectoryTree
                state={state}
                currentFolderId={folderId}
                onSelect={openFolder}
              />
            </ul>
          </ScrollArea>
        </div>

        {/* ── Main area ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Toolbar */}
          <div className="space-y-3 border-b border-border bg-card/40 px-5 py-4 sm:px-6">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <span key={crumb.id} className="contents">
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink
                            render={
                              <button type="button" className="cursor-pointer" onClick={() => openFolder(crumb.id)} />
                            }
                          >
                            {crumb.name}
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? <BreadcrumbSeparator /> : null}
                    </span>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in this folder…"
                  className="h-9 border-border bg-background/60 pl-9"
                  aria-label="Search files and folders"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <div className="mr-1 flex rounded-md border border-border p-0.5" aria-label="File view">
                  <Button size="icon-sm" variant={view === "grid" ? "secondary" : "ghost"} aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => changeView("grid")}><Grid2X2 /></Button>
                  <Button size="icon-sm" variant={view === "list" ? "secondary" : "ghost"} aria-label="List view" aria-pressed={view === "list"} onClick={() => changeView("list")}><List /></Button>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPrompt("folder")}>
                  <FolderPlus /> Folder
                </Button>
                <Button size="sm" onClick={() => setPrompt("file")}>
                  <FilePlus /> New file
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPrompt("upload")}>
                  <Upload /> Upload
                </Button>
                <Button size="sm" variant="outline" disabled={!renameTarget} onClick={() => setPrompt("rename")}>
                  <Pencil /> Rename
                </Button>
                <Button size="sm" variant="outline" disabled={!moveTarget} onClick={() => setPrompt("move")}>
                  <FolderInput /> Move
                </Button>
                <Button
                  size="sm" variant="outline" disabled={!selectedFile}
                  onClick={() => {
                    if (!selectedFile) return;
                    void apply(copyFile(state, selectedFile.id, folderId, `Copy of ${selectedFile.name}`), "File copied.");
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button
                  size="sm" variant="destructive"
                  disabled={!selectedFile && !canMutateFolder}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          </div>

          {/* File list + editor panel */}
          <div className="flex min-h-0 flex-1 flex-col bg-background xl:flex-row">
            <div className="min-w-0 flex-1 overflow-auto px-2 py-2 sm:px-3">
              {listing.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={searchQuery.trim() ? Search : Folder}
                    title={searchQuery.trim() ? "No matches" : "This folder is empty"}
                    description={
                      searchQuery.trim()
                        ? `Nothing named like "${searchQuery.trim()}" under this location.`
                        : "Create a file, upload a document, or create a new folder."
                    }
                  />
                </div>
              ) : (
                view === "grid" ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] gap-2 p-1">
                    {listing.map((item) => {
                      const isFile = item.type === "file";
                      const file = isFile ? item.entry as FileEntry : null;
                      const Icon = isFile ? getFileIcon(item.entry.name, file?.mimeType) : Folder;
                      return <button type="button" key={item.entry.id} aria-pressed={selectedId === item.entry.id} onClick={() => onRowActivate(item)} onDoubleClick={() => item.type === "folder" && openFolder(item.entry.id)} className={cn("min-w-0 rounded-lg border border-border bg-card/40 p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selectedId === item.entry.id && "border-primary/50 bg-primary/10")}>
                        <div className="flex min-w-0 items-center gap-2"><Icon className={cn("size-4 shrink-0", isFile ? "text-sky-400/90" : "text-amber-500/90")} /><FilenameDisplay name={item.entry.name} className="text-sm font-medium" /></div>
                        <p className="mt-2 text-xs text-muted-foreground">{isFile && file ? formatBytes(file.sizeBytes) : "Folder"}</p>
                        {file && !file.diskAllocated && <Badge variant="outline" className="mt-2 text-[9px] border-amber-500/40 text-amber-400">unallocated</Badge>}
                      </button>;
                    })}
                  </div>
                ) : <Table className="overflow-hidden rounded-lg border border-border bg-card/40">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden sm:table-cell">Size</TableHead>
                      <TableHead className="hidden lg:table-cell">Modified</TableHead>
                      <TableHead className="hidden xl:table-cell text-right">Blocks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listing.map((item) => {
                      const id = item.entry.id;
                      const isFile = item.type === "file";
                      const file = isFile ? (item.entry as FileEntry) : null;
                      const FileIcon = isFile
                        ? getFileIcon(item.entry.name, file?.mimeType)
                        : Folder;
                      const iconColor = isFile ? "text-sky-400/90" : "text-amber-500/90";
                      return (
                        <TableRow
                          key={id}
                          data-state={selectedId === id ? "selected" : undefined}
                          className="cursor-pointer border-border/70 transition-colors hover:bg-muted/70 data-[state=selected]:bg-primary/10"
                          onClick={() => onRowActivate(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowActivate(item); }
                          }}
                          tabIndex={0}
                        >
                          <TableCell className="max-w-[200px] sm:max-w-[300px] lg:max-w-[400px]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileIcon className={cn("size-4 shrink-0", iconColor)} />
                              <FilenameDisplay name={item.entry.name} className="font-medium" />
                              {isFile && file && !file.diskAllocated && (
                                <Badge variant="outline" className="ml-1 text-[9px] border-amber-500/40 text-amber-400 py-0">
                                  unallocated
                                </Badge>
                              )}
                              {!isFile && (
                                <ChevronRight className="size-3.5 text-muted-foreground lg:hidden" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden capitalize text-muted-foreground md:table-cell">
                            {!isFile ? "Folder" : (file?.mimeType ?? fileExtension(item.entry.name))}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {isFile ? formatBytes(item.entry.sizeBytes) : "—"}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {isFile
                              ? formatDate((item.entry as FileEntry).modifiedAt)
                              : formatDate(item.entry.createdAt)}
                          </TableCell>
                          <TableCell className="hidden text-right text-muted-foreground xl:table-cell">
                            {isFile && file
                              ? (file.diskAllocated ? allocatedBlocks(file) : "—")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* File preview / editor panel */}
            {selectedFile ? (
              <>
                <Separator orientation="vertical" className="hidden xl:block" />
                <aside className="flex w-full min-h-0 flex-col border-t border-border bg-card/65 xl:w-[28rem] xl:shrink-0 xl:border-t-0 xl:border-l">
                  {/* File header */}
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 shrink-0">
                      {(() => {
                        const Icon = getFileIcon(selectedFile.name, selectedFile.mimeType);
                        return <Icon className="size-5 text-primary" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <FilenameDisplay name={selectedFile.name} className="text-sm font-medium" />
                      <p className="text-xs text-muted-foreground">
                        {allocationMethodLabel(selectedFile.allocationMethod)} allocation
                        {selectedFile.diskAllocated ? "" : " · not on virtual disk"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-muted-foreground hover:text-foreground text-xs shrink-0"
                      aria-label="Close panel"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Preview */}
                  <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                    <FilePreview
                      file={selectedFile}
                      isSaving={isSaving}
                      onSave={handleSave}
                      onClose={() => setSelectedId(null)}
                    />
                  </div>
                </aside>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <NamePrompt
        open={prompt === "file"}
        title="New text file"
        initialValue="untitled.txt"
        confirmLabel="Create"
        onCancel={() => setPrompt(null)}
        onConfirm={async (name) => {
          const created = await apply(
            createFile(state, folderId, name, "", state.defaultAllocationMethod),
            "File created."
          );
          setPrompt(null);
          if (created) selectFile(created);
        }}
      />
      <NamePrompt
        open={prompt === "folder"}
        title="New folder"
        initialValue="New folder"
        confirmLabel="Create"
        onCancel={() => setPrompt(null)}
        onConfirm={async (name) => {
          await apply(createDirectory(state, folderId, name), "Folder created.");
          setPrompt(null);
        }}
      />
      <NamePrompt
        open={prompt === "rename" && Boolean(renameTarget)}
        title="Rename"
        initialValue={renameTarget?.name ?? ""}
        confirmLabel="Rename"
        onCancel={() => setPrompt(null)}
        onConfirm={async (name) => {
          if (!renameTarget) return;
          await apply(
            renameEntry(state, renameTarget.id, name, selectedFile ? "file" : "directory"),
            "Renamed."
          );
          setPrompt(null);
        }}
      />
      <MoveDialog
        open={prompt === "move"}
        state={state}
        target={moveTarget}
        onCancel={() => setPrompt(null)}
        onConfirm={async (destinationId) => {
          if (!moveTarget) return;
          const moved = await apply(
            moveEntry(state, moveTarget.id, destinationId, moveTarget.kind),
            `${moveTarget.kind === "file" ? "File" : "Folder"} moved.`
          );
          if (moved) {
            setPrompt(null);
            if (moveTarget.kind === "file") setSelectedId(null);
          }
        }}
      />
      <UploadDialog
        open={prompt === "upload"}
        folderId={folderId}
        state={state}
        onUploaded={handleUploaded}
        onClose={() => setPrompt(null)}
      />
      <DeleteFolderDialog
        open={prompt === "delete-folder"}
        state={state}
        target={currentFolder && canMutateFolder ? currentFolder : null}
        onCancel={() => setPrompt(null)}
        onConfirm={handleConfirmDeleteFolder}
      />
    </>
  );
}
