"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Sections" },
  { href: "/admin/checkpoints", label: "Checkpoints" },
  { href: "/admin/notifications", label: "Notifications" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2 mb-3">
      {links.map(({ href, label }) => {
        const isActive =
          href === "/admin"
            ? pathname === "/admin"
            : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm font-medium px-4 py-3 min-h-[44px] flex items-center rounded-md ${
              isActive
                ? "bg-[var(--primary)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
