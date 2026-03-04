"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthPanelProps = {
  onAuthChange?: (email: string | null) => void;
};

export function AuthPanel({ onAuthChange }: AuthPanelProps) {
  const supabase = getSupabaseBrowser();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionEmail = data.session?.user.email ?? null;
      setCurrentEmail(sessionEmail);
      onAuthChange?.(sessionEmail);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionEmail = session?.user.email ?? null;
      setCurrentEmail(sessionEmail);
      onAuthChange?.(sessionEmail);
    });
    return () => subscription.unsubscribe();
  }, [onAuthChange, supabase]);

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      pushToast({
        type: "error",
        title: "Sign-in failed",
        message: error.message,
      });
      return;
    }
    setEmail("");
    setPassword("");
    pushToast({ type: "success", title: "Signed in" });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    pushToast({ type: "info", title: "Signed out" });
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      pushToast({
        type: "error",
        title: "Email required",
        message: "Enter your email to receive a recovery link.",
      });
      return;
    }
    setRecoveryLoading(true);
    const redirectTo =
      "https://on-site-d.vercel.app/auth/callback?next=/auth/reset-password";
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    console.log("Recovery email result:", { data, error, email, redirectTo });
    setRecoveryLoading(false);
    if (error) {
      pushToast({
        type: "error",
        title: "Recovery failed",
        message: error.message,
      });
      return;
    }
    pushToast({
      type: "success",
      title: "Check your email",
      message: "We sent a recovery link to " + email,
    });
  };

  if (currentEmail) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
        <span>Signed in as {currentEmail}</span>
        <Button
          type="button"
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="drainer-button drainer-button-ghost h-9 text-xs"
        >
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-[12px] bg-[var(--surface-2)] p-3">
      <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        Sign in
      </p>
      <Input
        className="drainer-input h-9 text-[16px] md:text-xs"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
      />
      <Input
        className="drainer-input h-9 text-[16px] md:text-xs"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
      />
      <Button
        type="button"
        className="drainer-button drainer-button-primary h-9 text-xs"
        onClick={handleSignIn}
        disabled={loading || !email || !password}
      >
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      <button
        type="button"
        onClick={handleForgotPassword}
        disabled={recoveryLoading || !email}
        className="text-xs text-[var(--muted-foreground)] underline hover:no-underline disabled:opacity-50"
      >
        Forgot password?
      </button>
    </div>
  );
}
