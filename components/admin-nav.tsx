"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const links = [
  { href: "/admin", label: "Sections" },
  { href: "/admin/checkpoints", label: "Checkpoints" },
  { href: "/admin/notifications", label: "Data Analysis" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [alertsCount, setAlertsCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const fetchCount = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await fetch("/api/drainer/alerts-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setAlertsCount(json.count ?? 0);
        }
      } catch {
        setAlertsCount(null);
      }
    };
    fetchCount();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetchCount());
    return () => subscription.unsubscribe();
  }, [pathname]);

  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2 mb-3">
      {links.map(({ href, label }) => {
        const isActive =
          href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(href);
        const showBadge = href === "/admin/notifications" && alertsCount !== null && alertsCount > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium px-4 py-3 min-h-[44px] flex items-center gap-2 rounded-md ${
              isActive
                ? "bg-[#B8682A] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {label}
            {showBadge && (
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${
                  isActive ? "bg-white/25" : "bg-[#B8682A] text-white"
                }`}
              >
                {alertsCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
