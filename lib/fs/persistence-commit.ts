import type { FileSystemError, FileSystemState, OperationResult } from "@/lib/fs/types";

function persistenceError(message: string): FileSystemError {
  return { code: "ALLOCATION_FAILED", message };
}

/**
 * Commits an engine operation only when the persistence adapter succeeds.
 * On an adapter failure the caller receives the previous, valid state.
 */
export async function commitPersistedOperation<T>(
  previousState: FileSystemState,
  result: OperationResult<T>,
  persist: (state: FileSystemState) => Promise<FileSystemState>
): Promise<OperationResult<T>> {
  if (!result.ok) return result;
  try {
    const state = await persist(result.state);
    return { ok: true, state, value: result.value };
  } catch (error) {
    return {
      ok: false,
      state: previousState,
      error: persistenceError(
        error instanceof Error ? error.message : "Filesystem changes were not saved."
      ),
    };
  }
}
