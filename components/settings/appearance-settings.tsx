"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <Card className="border border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Appearance</CardTitle>
        <CardDescription>Customize the look and feel of the application.</CardDescription>
      </CardHeader>
      <CardContent>
        {mounted ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 size-4" /> Light
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 size-4" /> Dark
            </Button>
            <Button
              size="sm"
              variant={theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
            >
              <Monitor className="mr-2 size-4" /> System
            </Button>
          </div>
        ) : (
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
        )}
      </CardContent>
    </Card>
  );
}
