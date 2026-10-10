"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilenameDisplay({ name, copyable = false, className }: { name: string; copyable?: boolean; className?: string }) {
  async function copyName(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(name);
      toast.success("Filename copied.");
    } catch {
      toast.error("Could not copy filename.");
    }
  }

  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="min-w-0 truncate" title={name}>{name}</span>
      {copyable && <Button type="button" variant="ghost" size="icon-xs" className="shrink-0" aria-label={`Copy filename ${name}`} onClick={(event) => void copyName(event)}><Copy className="size-3.5" /></Button>}
    </span>
  );
}
