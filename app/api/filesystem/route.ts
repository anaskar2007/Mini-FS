import { NextResponse } from "next/server";
import { seedSampleFileSystem } from "@/lib/fs/seed";
import { restoreFileSystem, serializeFileSystem } from "@/lib/fs/persistence";
import { loadFileSystemForUser, saveFileSystemForUser } from "@/lib/fs/supabase-persistence";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string") return { supabase, user: null };
  return { supabase, user: { id: userId, email: typeof claims?.email === "string" ? claims.email : null } };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  try {
    const { supabase, user } = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let state = await loadFileSystemForUser(supabase, user.id);
    if (!state) {
      state = seedSampleFileSystem("indexed");
      await saveFileSystemForUser(supabase, state);
    }
    return NextResponse.json({ snapshot: serializeFileSystem(state), email: user.email });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to restore filesystem." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  try {
    const { supabase, user } = await currentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await request.json();
    const state = restoreFileSystem(payload.snapshot);
    await saveFileSystemForUser(supabase, state);
    return NextResponse.json({ snapshot: serializeFileSystem(state) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save filesystem." }, { status: 400 });
  }
}
