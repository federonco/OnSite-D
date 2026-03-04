"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const { pushToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      pushToast({
        type: "error",
        title: "Passwords don't match",
        message: "Please ensure both passwords are identical.",
      });
      return;
    }
    if (password.length < 6) {
      pushToast({
        type: "error",
        title: "Password too short",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      pushToast({
        type: "error",
        title: "Failed to reset password",
        message: error.message,
      });
      return;
    }

    pushToast({ type: "success", title: "Password updated" });
    router.push("/admin");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-[16px] bg-[var(--surface-2)] p-6 shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-[var(--ink)]">
          Set new password
        </h1>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Enter your new password below.
        </p>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="drainer-input"
            required
            minLength={6}
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="drainer-input"
            required
            minLength={6}
          />
          <Button
            type="submit"
            className="drainer-button drainer-button-primary w-full"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? "Updating..." : "Update password"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
          <Link href="/admin" className="underline hover:no-underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
