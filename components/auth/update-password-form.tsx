"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/lib/actions/account";
import styles from "./auth-layout.module.css";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setIsUpdating(true);
    try {
      await updatePassword(password);
      toast.success("Password updated successfully.");
      router.replace("/");
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : "Failed to update password.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <AuthLayout>
      <header className={styles.authHeader}>
        <p className={`${styles.authEyebrow} font-mono uppercase`}>Account recovery</p>
        <h1 className={styles.authTitle}>Choose a new password</h1>
        <p className={styles.authDescription}>Create a new password for your MiniFS account.</p>
      </header>
      <form onSubmit={submit} className={styles.authForm} aria-busy={isUpdating}>
        <div className={styles.authField}>
          <label htmlFor="new-password" className={styles.authLabel}>New password</label>
          <Input id="new-password" className={styles.authInput} type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <div className={styles.authField}>
          <label htmlFor="confirm-password" className={styles.authLabel}>Confirm new password</label>
          <Input id="confirm-password" className={styles.authInput} type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </div>
        <Button type="submit" disabled={isUpdating} className={`${styles.authAction} w-full`}>{isUpdating ? "Updating…" : "Update password"}</Button>
      </form>
    </AuthLayout>
  );
}
