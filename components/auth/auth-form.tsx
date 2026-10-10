"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "./auth-layout";
import styles from "./auth-layout.module.css";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const result = isSignup
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (isSignup && !result.data.session) {
        setMessage("Account created. Check your email to confirm your account, then sign in.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <header className={styles.authHeader}>
        <p className={`${styles.authEyebrow} font-mono uppercase`}>{isSignup ? "Get started" : "Account access"}</p>
        <h1 className={styles.authTitle}>{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className={styles.authDescription}>
          {isSignup ? "Set up an account for your private virtual filesystem." : "Sign in to return to your saved virtual filesystem."}
        </p>
      </header>

      <form className={styles.authForm} onSubmit={submit} aria-busy={pending}>
        <div className={styles.authField}>
          <label htmlFor="auth-email" className={styles.authLabel}>Email address</label>
          <Input id="auth-email" className={styles.authInput} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error" : undefined} />
        </div>

        <div className={styles.authField}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="auth-password" className={styles.authLabel}>Password</label>
            {!isSignup && <Link href="/forgot-password" className="rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Forgot password?</Link>}
          </div>
          <div className="relative">
            <Input id="auth-password" className={`${styles.authInput} pr-11`} type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} placeholder="At least 6 characters" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required aria-invalid={Boolean(error)} aria-describedby={error ? "auth-error" : undefined} />
            <button type="button" className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
        </div>

        {error && <p id="auth-error" role="alert" className="border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm leading-5 text-destructive">{error}</p>}
        {message && <p role="status" className="border border-primary/25 bg-primary/10 px-3 py-2.5 text-sm leading-5 text-primary">{message}</p>}

        <Button className={`${styles.authAction} w-full`} type="submit" disabled={pending}>
          {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className={`${styles.authFooter} text-center`}>
        {isSignup ? "Already have an account?" : "New to MiniFS?"}{" "}
        <Link className="rounded-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </AuthLayout>
  );
}
