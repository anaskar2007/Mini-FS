import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { createClient } from "@/lib/supabase/server";

async function ResetPasswordContent() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-semibold">Recovery link unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">This link may have expired. Request a new password recovery email to continue.</p>
        <Link className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" href="/forgot-password">Request a new link</Link>
      </AuthLayout>
    );
  }
  return <UpdatePasswordForm />;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<AuthLayout><p className="text-sm text-muted-foreground">Checking recovery session…</p></AuthLayout>}><ResetPasswordContent /></Suspense>;
}
