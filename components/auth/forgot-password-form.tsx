"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordForEmail } from "@/lib/actions/account";
import { AuthLayout } from "./auth-layout";
import { toast } from "sonner";
import styles from "./auth-layout.module.css";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    
    setPending(true);
    try {
      await resetPasswordForEmail(email.trim());
      toast.success("Recovery email sent. Please check your inbox.");
      setEmail("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to send recovery email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <header className={styles.authHeader}>
        <p className={`${styles.authEyebrow} font-mono uppercase`}>Account recovery</p>
        <h1 className={styles.authTitle}>Reset password</h1>
        <p className={styles.authDescription}>Enter your email address and we’ll send you a link to reset your password.</p>
      </header>
      <form className={styles.authForm} onSubmit={submit} aria-busy={pending}>
        <div className={styles.authField}>
          <label htmlFor="recovery-email" className={styles.authLabel}>Email address</label>
          <Input id="recovery-email" className={styles.authInput} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <Button className={`${styles.authAction} w-full`} type="submit" disabled={pending}>
          {pending ? "Sending link…" : "Send recovery link"}
        </Button>
      </form>
      <p className={`${styles.authFooter} text-center`}>
        Remember your password?{" "}
        <Link className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
