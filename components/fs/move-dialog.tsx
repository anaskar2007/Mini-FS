"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPathToRoot, type DirectoryEntry, type FileSystemState } from "@/lib/fs";

export interface MoveTarget {
  id: string;
  name: string;
  parentId: string;
  kind: "file" | "directory";
}

interface MoveDialogProps {
  open: boolean;
  state: FileSystemState;
  target: MoveTarget | null;
  onCancel: () => void;
  onConfirm: (destinationId: string) => Promise<void>;
}

function isInvalidDirectoryDestination(
  state: FileSystemState,
  target: MoveTarget,
  directory: DirectoryEntry
): boolean {
  if (directory.id === target.parentId) return true;
  if (target.kind !== "directory") return false;
  return getPathToRoot(state, directory.id).some(
    (ancestor) => ancestor.id === target.id
  );
}

export function MoveDialog({ open, state, target, onCancel, onConfirm }: MoveDialogProps) {
  const currentLocation = target
    ? getPathToRoot(state, target.parentId).map((item) => item.name).join(" / ")
    : "";
  const destinations = useMemo(() => {
    if (!target) return [];
    return Object.values(state.directories)
      .filter((directory) => !isInvalidDirectoryDestination(state, target, directory))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((directory) => ({
        id: directory.id,
        label: getPathToRoot(state, directory.id).map((item) => item.name).join(" / "),
      }));
  }, [state, target]);
  const [destinationId, setDestinationId] = useState("");

  if (!open || !target) return null;
  const selectedDestination = destinations.some((destination) => destination.id === destinationId)
    ? destinationId
    : destinations[0]?.id ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
        onSubmit={async (event) => {
          event.preventDefault();
          if (selectedDestination) await onConfirm(selectedDestination);
        }}
      >
        <h2 className="text-sm font-semibold">Move {target.kind === "file" ? "file" : "folder"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Move <span className="font-medium text-foreground">{target.name}</span> from its current location.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Current: {currentLocation}</p>
        <label className="mt-4 block text-xs text-muted-foreground">
          Destination folder
          <select
            autoFocus
            value={selectedDestination}
            onChange={(event) => setDestinationId(event.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>{destination.label}</option>
            ))}
          </select>
        </label>
        {destinations.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No valid destination folders are available.</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={!selectedDestination}>Move</Button>
        </div>
      </form>
    </div>
  );
}
