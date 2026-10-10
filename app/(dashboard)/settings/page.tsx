"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { allocationMethodLabel } from "@/lib/format";
import type { AllocationMethod } from "@/lib/fs";
import { toast } from "sonner";
import { AccountSettings } from "@/components/settings/account-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";

const METHODS: AllocationMethod[] = ["contiguous", "linked", "indexed"];
const VIEW_KEY = "minifs_default_view";
const VALID_VIEWS = ["grid", "list"] as const;
type ViewPref = "grid" | "list";

function readView(): ViewPref {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "grid" || v === "list") return v;
  } catch { /* SSR */ }
  return "grid";
}

export default function SettingsPage() {
  const { state, setAllocationMethod } = useFileSystem();
  // Lazy initial state avoids hydration mismatch without needing an effect.
  // `readView` is safe to call here — it is synchronous and SSR-safe (try/catch).
  const [viewPref, setViewPref] = useState<ViewPref>(readView);
  const [mounted, setMounted] = useState(false);

  // Single side-effect: mark mounted after first client render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  function handleView(v: ViewPref) {
    setViewPref(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
    toast.success(`Default view set to ${v}.`);
  }

  async function handleMethod(method: AllocationMethod) {
    if (await setAllocationMethod(method)) {
      toast.success(`Default allocation set to ${allocationMethodLabel(method)}.`);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Configure your MiniFS workspace preferences." />
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-7 lg:px-9">

        {/* Account */}
        <AccountSettings />

        {/* Appearance */}
        <AppearanceSettings />

        {/* Explorer view */}
        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Default explorer view</CardTitle>
          </CardHeader>
          <CardContent>
            {mounted ? (
              <div className="flex gap-2">
                {(VALID_VIEWS as readonly ViewPref[]).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={viewPref === v ? "default" : "outline"}
                    onClick={() => handleView(v)}
                    className="capitalize"
                  >
                    {v}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted/60" />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Saved to your browser and applied in the Explorer.
            </p>
          </CardContent>
        </Card>

        {/* Allocation method */}
        <Card className="border border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Default allocation method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={state.defaultAllocationMethod === m ? "default" : "outline"}
                  onClick={() => void handleMethod(m)}
                >
                  {allocationMethodLabel(m)}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Applied to newly created and uploaded files. Saved to your account.
            </p>
          </CardContent>
        </Card>

      </div>
    </>
  );
}
