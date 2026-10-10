"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ open, title, description, confirmLabel, pending = false, destructive = false, onCancel, onConfirm }: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return <dialog ref={dialogRef} onCancel={onCancel} onClose={onCancel} aria-labelledby="confirm-title" aria-describedby="confirm-description" className="w-[calc(100%-2rem)] max-w-md border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/60">
    <div className="p-5 sm:p-6">
      <h2 id="confirm-title" className="text-lg font-semibold">{title}</h2>
      <p id="confirm-description" className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={pending}>{pending ? "Please wait…" : confirmLabel}</Button>
      </div>
    </div>
  </dialog>;
}
