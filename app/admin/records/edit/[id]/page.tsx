"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRecordEditRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin");
  }, [router]);
  return (
    <div className="drainer-page">
      <div className="drainer-shell">
        <p className="text-sm text-[var(--muted-foreground)]">
          Redirecting to Admin…
        </p>
      </div>
    </div>
  );
}
