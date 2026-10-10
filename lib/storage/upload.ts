import { createClient } from "@/lib/supabase/client";
import { isAllowedMimeType, MAX_UPLOAD_BYTES } from "@/lib/file-type";

const BUCKET = "user-files";

export interface UploadResult {
  storagePath: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Uploads a File to Supabase Storage under the authenticated user's prefix.
 * Never trusts a caller-provided userId — always reads from the active session.
 *
 * Object path: {userId}/{fileId}/{filename}
 */
export async function uploadUserFile(
  fileId: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`
    );
  }
  const mime = file.type || "application/octet-stream";
  if (!isAllowedMimeType(mime)) {
    throw new Error(`File type "${mime}" is not permitted.`);
  }

  const supabase = createClient();

  // Read the authenticated user from the session — never from caller input.
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error("You must be signed in to upload files.");
  }
  const userId = session.user.id;

  const storagePath = `${userId}/${fileId}`;

  if (onProgress) {
    // Use XMLHttpRequest for progress tracking.
    await uploadWithProgress(supabase, storagePath, file, mime, onProgress);
  } else {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  }

  return { storagePath };
}

async function uploadWithProgress(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  storagePath: string,
  file: File,
  mime: string,
  onProgress: (p: UploadProgress) => void
): Promise<void> {
  // Supabase storage JS SDK v2 does not yet expose an onUploadProgress API.
  // Fall back to direct XHR with the same Authorization header.
  const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string } | null } };
  if (!session) throw new Error("Not authenticated.");

  // Build storage URL from the Supabase project URL env var.
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const url = `${projectUrl}/storage/v1/object/${BUCKET}/${storagePath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(`Upload failed: ${body.error ?? xhr.statusText}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload was cancelled.")));
    xhr.send(file);
  });
}


/**
 * Generates a short-lived signed URL (60 seconds) for a private storage object.
 * Use for image/PDF previews — do not embed as a permanent src.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Could not generate preview URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

/**
 * Deletes a storage object. Logs a warning on failure but does not throw —
 * callers must decide whether to surface the error to the user.
 * Returns true on success, false on failure.
 */
export async function deleteStorageObject(storagePath: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    console.warn(`Storage cleanup failed for ${storagePath}:`, error.message);
    return false;
  }
  return true;
}

/**
 * Triggers a file download in the browser using a signed URL.
 */
export async function downloadFile(storagePath: string, filename: string): Promise<void> {
  const url = await getSignedUrl(storagePath);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
