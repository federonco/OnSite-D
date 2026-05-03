"use client";

import { useState } from "react";
import { getSupabaseBrowser as createClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(err.message || "Invalid credentials");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="psp-page">
      <div className="psp-shell max-w-sm">
        <div className="psp-card space-y-6">
          <div>
            <h1
              className="psp-page-title"
              style={{ color: "#ea580c" }}
            >
              Drainer Admin
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Sign in with your email and password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="psp-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="psp-input"
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="psp-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="psp-input"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p
                className="rounded-[12px] p-3 text-sm"
                style={{
                  background: "rgba(232, 82, 74, 0.1)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="psp-button w-full disabled:opacity-60"
              style={{
                background: "#ea580c",
                color: "white",
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <Link
            href="/"
            className="block text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            ← Back to form
          </Link>
        </div>
      </div>
    </div>
  );
}
