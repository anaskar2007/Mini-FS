"use client";

import { usePathname, useRouter } from "next/navigation";
import { HardDrive, Search } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { Input } from "@/components/ui/input";

const ROUTES: Record<string, string> = {
  "/": "Overview",
  "/explorer": "File Explorer",
  "/disk": "Disk Blocks",
  "/allocation": "Allocation Methods",
  "/about": "About",
  "/settings": "Settings",
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = ROUTES[pathname] || "MiniFS";
  
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-4 flex-1">
        {/* Branding - only visible on lg screens where sidebar branding is hidden, OR visible on mobile if sidebar is closed. Wait, sidebar is hidden on mobile? Yes. So we show branding on mobile, hide on lg because sidebar has it. */}
        <div className="flex items-center gap-2 lg:hidden text-sidebar-primary">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardDrive className="size-4" aria-hidden />
          </div>
          <span className="font-semibold tracking-tight text-foreground">MiniFS</span>
        </div>

        {/* Page Title / Breadcrumb */}
        <div className="hidden sm:flex items-center text-sm text-muted-foreground font-medium lg:ml-2">
          {pageTitle}
        </div>

        {/* Global Search */}
        <form 
          className="relative hidden max-w-sm flex-1 sm:block lg:max-w-md ml-auto mr-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const query = formData.get("q");
            if (query) {
              router.push(`/explorer?q=${encodeURIComponent(query.toString())}`);
            }
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            placeholder="Global search…"
            className="h-9 w-full rounded-md border border-input bg-background/60 pl-9 shadow-sm"
          />
        </form>
      </div>
      <AccountMenu />
    </header>
  );
}
