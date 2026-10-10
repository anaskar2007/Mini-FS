"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NamePromptProps {
  open: boolean;
  title: string;
  label?: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function NamePrompt({
  open,
  title,
  label = "Name",
  initialValue = "",
  confirmLabel = "Create",
  onCancel,
  onConfirm,
}: NamePromptProps) {
  if (!open) return null;

  return <NamePromptContent key={`${title}-${initialValue}`} title={title} label={label} initialValue={initialValue} confirmLabel={confirmLabel} onCancel={onCancel} onConfirm={onConfirm} />;
}

function NamePromptContent({
  title,
  label,
  initialValue,
  confirmLabel,
  onCancel,
  onConfirm,
}: Omit<NamePromptProps, "open">) {
  const [value, setValue] = useState(initialValue ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(value);
        }}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        <label className="mt-3 block text-xs text-muted-foreground">
          {label}
          <Input
            autoFocus
            className="mt-1.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}
