"use server";

import { createClient } from "@/lib/supabase/server";

export async function resetPasswordForEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims?.sub) throw new Error("Your password reset session has expired. Request a new recovery link.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function deleteUserAccount() {
  const supabase = await createClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    throw new Error("You must be signed in to delete your account.");
  }
  const userId = session.user.id;

  // Cleanup Supabase Storage (files)
  const { data: files } = await supabase.storage.from("user-files").list(userId + "/", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" }
  });
  if (files && files.length > 0) {
    // Delete files inside user prefix (assuming flat structure inside user dir, or simple folders)
    // For a real prod app with deep folders, a robust recursive delete or edge function is required.
    const paths = files.map(f => `${userId}/${f.name}`);
    await supabase.storage.from("user-files").remove(paths);
  }

  // File system state in database is handled by row level security and CASCADE if fk exists,
  // but let's delete fs_state explicitly just in case.
  await supabase.from("fs_state").delete().eq("user_id", userId);

  // Delete the user via Postgres RPC. The RPC has SECURITY DEFINER and deletes from auth.users.
  const { error: rpcError } = await supabase.rpc("delete_user");
  if (rpcError) {
    throw new Error(`Account deletion failed: ${rpcError.message}`);
  }

  await supabase.auth.signOut();
}
