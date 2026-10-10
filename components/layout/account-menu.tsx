"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import Link from "next/link";

import { useFileSystem } from "@/components/fs/file-system-provider";

function getInitials(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0];
  return local.slice(0, 2).toUpperCase();
}

export function AccountMenu() {
  const { email, signOut } = useFileSystem();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {/* Avatar */}
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
          {getInitials(email)}
        </span>
        <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:block">
          {email ?? "Account"}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-popover py-1 shadow-xl"
        >
          {/* Identity */}
          <div className="border-b border-border px-3.5 py-2.5">
            <p className="text-xs font-medium text-foreground">Signed in as</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{email ?? "—"}</p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <Link
              href="/settings"
              role="menuitem"
              className="flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-accent focus-visible:bg-accent"
              onClick={() => setOpen(false)}
            >
              <Settings className="size-3.5 text-muted-foreground" />
              Settings
            </Link>
          </div>

          <div className="border-t border-border py-1">
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10"
              onClick={() => { setOpen(false); void signOut(); }}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
