"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { type FileSystemState, type DirectoryEntry, getPathToRoot } from "@/lib/fs";

interface DirectoryTreeProps {
  state: FileSystemState;
  currentFolderId: string;
  onSelect: (folderId: string) => void;
}

export function DirectoryTree({ state, currentFolderId, onSelect }: DirectoryTreeProps) {
  // Keep track of expanded folders
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Automatically expand ancestors of the current folder
  useEffect(() => {
    const path = getPathToRoot(state, currentFolderId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const crumb of path) {
        if (!next.has(crumb.id)) {
          next.add(crumb.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentFolderId, state]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const root = state.directories[state.rootDirectoryId];
  if (!root) return null;

  return (
    <ul role="tree" aria-label="Filesystem directories" className="text-sm font-medium">
      <DirectoryNode
        entry={root}
        state={state}
        currentFolderId={currentFolderId}
        expandedIds={expandedIds}
        onSelect={onSelect}
        onToggle={toggleExpand}
        depth={0}
        isLast={true}
        activeDepths={[]}
      />
    </ul>
  );
}

interface DirectoryNodeProps {
  entry: DirectoryEntry;
  state: FileSystemState;
  currentFolderId: string;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth: number;
  isLast: boolean;
  activeDepths: boolean[];
}

function DirectoryNode({
  entry,
  state,
  currentFolderId,
  expandedIds,
  onSelect,
  onToggle,
  depth,
  isLast,
  activeDepths,
}: DirectoryNodeProps) {
  const isRoot = entry.id === state.rootDirectoryId;
  const isSelected = entry.id === currentFolderId;
  const isExpanded = expandedIds.has(entry.id) || isRoot;
  
  const children = Object.values(state.directories)
    .filter((d) => d.parentId === entry.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const hasChildren = children.length > 0;
  const nextActiveDepths = isRoot ? [] : [...activeDepths, !isLast];

  return (
    <li className="relative">
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(entry.id);
          }
        }}
        className={cn(
          "group relative flex items-center rounded-md py-1 pr-2 transition-colors cursor-pointer",
          isSelected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
        onClick={() => onSelect(entry.id)}
      >
        {/* Draw vertical lines for active ancestors */}
        {activeDepths.map((isActive, d) => isActive && (
          <div 
            key={d} 
            className="absolute top-0 bottom-0 border-l border-border/70 pointer-events-none" 
            style={{ left: `${d * 16 + 12}px` }} 
          />
        ))}

        {/* Draw THIS node's L-shape connector if not root */}
        {!isRoot && (
          <>
            <div 
              className="absolute border-l border-border/70 pointer-events-none" 
              style={{
                left: `${(depth - 1) * 16 + 12}px`,
                top: 0,
                bottom: isLast ? "50%" : 0
              }} 
            />
            <div 
              className="absolute border-t border-border/70 pointer-events-none" 
              style={{
                left: `${(depth - 1) * 16 + 12}px`,
                width: "12px",
                top: "50%"
              }} 
            />
          </>
        )}

        <div 
          className="flex items-center gap-1 w-full relative z-10"
          style={{ paddingLeft: `${Math.max(4, depth * 16)}px` }}
        >
          <button
            type="button"
            disabled={!hasChildren || isRoot}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${entry.name}`}
            className={cn(
              "flex size-5 items-center justify-center rounded-sm hover:bg-muted-foreground/20 shrink-0",
              !hasChildren && "invisible"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren && !isRoot) onToggle(entry.id);
            }}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform text-muted-foreground",
                isExpanded && "rotate-90"
              )}
            />
          </button>

          {isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-amber-500/90" />
          ) : (
            <Folder className="size-4 shrink-0 text-amber-500/90" />
          )}
          
          <span className="truncate ml-1 font-medium">
            {isRoot ? `${entry.name} (root)` : entry.name}
          </span>
        </div>
      </div>
      
      {/* Children rendering */}
      {isExpanded && hasChildren && (
        <ul role="group" className="mt-0 animate-in fade-in duration-150">
          {children.map((child, index) => (
            <DirectoryNode
              key={child.id}
              entry={child}
              state={state}
              currentFolderId={currentFolderId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
              isLast={index === children.length - 1}
              activeDepths={nextActiveDepths}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
