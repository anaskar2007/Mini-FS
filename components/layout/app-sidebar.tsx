"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Blocks,
  FolderTree,
  HardDrive,
  Info,
  LayoutDashboard,
  Layers,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileSystem } from "@/components/fs/file-system-provider";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, short: "Home" },
  { href: "/explorer", label: "File Explorer", icon: FolderTree, short: "Files" },
  { href: "/disk", label: "Disk Blocks", icon: Blocks, short: "Disk" },
  { href: "/allocation", label: "Allocation Methods", icon: Layers, short: "Alloc" },
  { href: "/about", label: "About", icon: Info, short: "About" },
  { href: "/settings", label: "Settings", icon: Settings, short: "Settings" },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  short,
  active,
  compact,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  short: string;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md transition-colors",
        compact ? "shrink-0 px-3 py-2 text-xs" : "px-3 py-2 text-sm",
        active
          ? "bg-sidebar-primary/15 font-medium text-sidebar-primary-foreground ring-1 ring-sidebar-primary/20"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{compact ? short : label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { email } = useFileSystem();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar p-2 lg:hidden"
        aria-label="Main"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            compact
          />
        ))}
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden h-full w-[252px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-primary/30">
            <HardDrive className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">MiniFS</p>
            <p className="truncate text-xs text-muted-foreground">
              File System Simulator
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Main">
          <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="truncate text-xs text-muted-foreground">{email ?? "Signed in"}</p>
        </div>
      </aside>
    </>
  );
}
