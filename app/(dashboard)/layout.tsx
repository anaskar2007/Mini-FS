import { redirect } from "next/navigation";
import { connection } from "next/server";
import { FileSystemProvider } from "@/components/fs/file-system-provider";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Authenticated workspaces intentionally block on a verified request session.
// This opts this layout out of Next 16's instant-navigation development check.
export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The provider's initial simulation creates timestamps. This authenticated
  // workspace must render for a real request, never during static prerender.
  await connection();
  if (!isSupabaseConfigured()) {
    return <main className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-lg rounded-xl border border-border bg-card p-6"><h1 className="text-lg font-semibold">Supabase setup required</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Copy .env.example to .env.local, add your project URL and publishable key, then apply the migration in supabase/migrations.</p></div></main>;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");

  return (
    <FileSystemProvider>
      <AppShell>{children}</AppShell>
    </FileSystemProvider>
  );
}
