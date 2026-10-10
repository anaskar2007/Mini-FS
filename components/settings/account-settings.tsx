"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFileSystem } from "@/components/fs/file-system-provider";
import { toast } from "sonner";
import { resetPasswordForEmail, deleteUserAccount } from "@/lib/actions/account";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function AccountSettings() {
  const router = useRouter();
  const { email, signOut } = useFileSystem();
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  async function handleResetPassword() {
    if (!email) return;
    setIsResetting(true);
    try {
      await resetPasswordForEmail(email);
      toast.success("Password reset email sent. Please check your inbox.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reset password.");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      toast.success("Account deleted successfully.");
      router.push("/login");
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete account.");
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  }

  return (
    <Card className="border border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Account</CardTitle>
        <CardDescription>Manage your account settings and security.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="mt-0.5 text-sm font-medium">{email ?? "—"}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-2 size-3.5" />
            Sign out
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleResetPassword}
            disabled={!email || isResetting}
          >
            <Key className="mr-2 size-3.5" />
            {isResetting ? "Sending..." : "Reset password"}
          </Button>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-destructive">Danger Zone</p>
              <p className="text-xs text-muted-foreground mt-1">
                Permanently delete your account, files, and all virtual disk data. This action cannot be undone.
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setShowConfirmDelete(true)}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete account
            </Button>
            
            <ConfirmDialog open={showConfirmDelete} title="Delete account permanently?" description="This permanently deletes your account, files, and virtual disk data. This action cannot be undone." confirmLabel="Delete account" destructive pending={isDeleting} onCancel={() => setShowConfirmDelete(false)} onConfirm={() => void handleDeleteAccount()} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
