"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createEmptyFileSystem,
  getDiskStats,
  restoreFileSystem,
  serializeFileSystem,
  setDefaultAllocationMethod,
  type AllocationMethod,
  type DiskStats,
  type FileSystemState,
  type OperationResult,
} from "@/lib/fs";
import { commitPersistedOperation } from "@/lib/fs/persistence-commit";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface FileSystemContextValue {
  state: FileSystemState;
  stats: DiskStats;
  isLoading: boolean;
  persistenceError: string | null;
  email: string | null;
  apply: <T>(result: OperationResult<T>, successMessage?: string) => Promise<T | null>;
  setAllocationMethod: (method: AllocationMethod) => Promise<boolean>;
  signOut: () => Promise<void>;
}

const FileSystemContext = createContext<FileSystemContextValue | null>(null);

async function saveSnapshot(state: FileSystemState): Promise<FileSystemState> {
  const response = await fetch("/api/filesystem", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot: serializeFileSystem(state) }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Failed to persist filesystem.");
  return restoreFileSystem(body.snapshot);
}

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<FileSystemState>(() =>
    createEmptyFileSystem("indexed")
  );
  const [isLoading, setIsLoading] = useState(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/filesystem")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Failed to restore filesystem.");
        return body;
      })
      .then((body) => {
        if (!live) return;
        setState(restoreFileSystem(body.snapshot));
        setEmail(typeof body.email === "string" ? body.email : null);
        setPersistenceError(null);
      })
      .catch((error: unknown) => {
        if (live) setPersistenceError(error instanceof Error ? error.message : "Failed to restore filesystem.");
      })
      .finally(() => {
        if (live) setIsLoading(false);
      });
    return () => { live = false; };
  }, []);

  const apply = useCallback(
    async <T,>(result: OperationResult<T>, successMessage?: string): Promise<T | null> => {
      if (!result.ok) {
        toast.error(result.error.message);
        return null;
      }
      const committed = await commitPersistedOperation(state, result, saveSnapshot);
      if (committed.ok) {
        setState(committed.state);
        setPersistenceError(null);
        if (successMessage) toast.success(successMessage);
        return committed.value;
      }
      setPersistenceError(committed.error.message);
      toast.error(committed.error.message);
      return null;
    },
    [state]
  );

  const setAllocationMethod = useCallback(async (method: AllocationMethod) => {
    const nextState = setDefaultAllocationMethod(state, method);
    try {
      setState(await saveSnapshot(nextState));
      setPersistenceError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Allocation preference was not saved.";
      setPersistenceError(message);
      toast.error(message);
      return false;
    }
  }, [state]);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<FileSystemContextValue>(
    () => ({
      state,
      stats: getDiskStats(state),
      isLoading,
      persistenceError,
      email,
      apply,
      setAllocationMethod,
      signOut,
    }),
    [apply, email, isLoading, persistenceError, setAllocationMethod, signOut, state]
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Skeleton header */}
        <div className="h-11 border-b border-border" />
        <div className="flex flex-1">
          {/* Skeleton sidebar */}
          <div className="hidden w-[252px] shrink-0 border-r border-border p-4 lg:flex lg:flex-col gap-3">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="mt-4 h-5 w-3/4 rounded" />
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
          </div>
          {/* Skeleton main */}
          <div className="flex flex-1 flex-col gap-4 p-7">
            <Skeleton className="h-14 w-72 rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (persistenceError) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-destructive/40 bg-card p-5 text-sm">
          <p className="font-medium text-foreground">Workspace unavailable</p>
          <p className="mt-2 text-muted-foreground">{persistenceError}</p>
          <button className="mt-4 text-primary underline" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>;
}

export function useFileSystem(): FileSystemContextValue {
  const ctx = useContext(FileSystemContext);
  if (!ctx) throw new Error("useFileSystem must be used within FileSystemProvider.");
  return ctx;
}
