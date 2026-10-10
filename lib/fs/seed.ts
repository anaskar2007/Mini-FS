import {
  createDirectory,
  createEmptyFileSystem,
  createFile,
} from "@/lib/fs/engine";
import type {
  AllocationMethod,
  FileSystemState,
  OperationResult,
} from "@/lib/fs/types";

function unwrap<T>(result: OperationResult<T>, label: string): FileSystemState {
  if (!result.ok) {
    throw new Error(`Seed failed (${label}): ${result.error.message}`);
  }
  return result.state;
}

function repeatLine(line: string, times: number): string {
  return Array.from({ length: times }, () => line).join("\n");
}

/**
 * Demo tree used once at session start. Allocation methods are mixed so
 * disk and comparison views have real committed layouts to inspect.
 */
export function seedSampleFileSystem(
  defaultMethod: AllocationMethod = "indexed"
): FileSystemState {
  let state = createEmptyFileSystem(defaultMethod);

  const mkdir = (parentId: string, name: string) => {
    const result = createDirectory(state, parentId, name);
    state = unwrap(result, name);
    if (!result.ok) throw new Error("unreachable");
    return result.value.id;
  };

  const mkfile = (
    parentId: string,
    name: string,
    content: string,
    method: AllocationMethod
  ) => {
    state = unwrap(
      createFile(state, parentId, name, content, method),
      name
    );
  };

  const root = state.rootDirectoryId;
  const documents = mkdir(root, "Documents");
  const projects = mkdir(root, "Projects");
  const system = mkdir(root, "System");
  const minifs = mkdir(projects, "MiniFS");

  mkfile(
    minifs,
    "README.md",
    [
      "# MiniFS",
      "",
      "Browser-based file system simulator for an Operating Systems mini project.",
      "This file is stored with indexed allocation on the virtual disk.",
      "",
      repeatLine("Indexed allocation uses one index block plus data blocks.", 12),
    ].join("\n"),
    "indexed"
  );

  mkfile(
    minifs,
    "architecture.txt",
    [
      "Engine (pure TypeScript) -> React UI -> later: persistence adapter.",
      "Virtual disk: 1,024 blocks x 1 KiB.",
      repeatLine("Architecture notes for contiguous vs linked vs indexed.", 8),
    ].join("\n"),
    "contiguous"
  );

  mkfile(
    documents,
    "lecture-notes.txt",
    [
      "Lecture notes: file allocation methods.",
      "Contiguous: consecutive run of blocks.",
      "Linked: block pointers form a chain.",
      "Indexed: index block lists data block IDs.",
      repeatLine("More notes on free-space maps and fragmentation.", 20),
    ].join("\n"),
    "linked"
  );

  mkfile(
    documents,
    "os-unit-report.md",
    [
      "# OS Unit Report",
      "",
      "This slightly larger file demonstrates multi-block allocation.",
      repeatLine("Paragraph about virtual disks and block size tradeoffs.", 40),
    ].join("\n"),
    "indexed"
  );

  mkfile(
    system,
    "disk-layout.json",
    JSON.stringify(
      {
        totalBlocks: 1024,
        blockSizeBytes: 1024,
        note: "Simulated layout metadata; not a host disk map.",
      },
      null,
      2
    ),
    "contiguous"
  );

  mkfile(
    system,
    "boot-config.txt",
    "boot.method=indexed\nboot.blocks=1024\n",
    "linked"
  );

  mkfile(
    projects,
    "project-todo.txt",
    [
      "- [x] Phase 1 UI shell",
      "- [x] Phase 2 simulation engine",
      "- [ ] Persistence (later)",
    ].join("\n"),
    "contiguous"
  );

  return state;
}
