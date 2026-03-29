import type { SupabaseClient } from "@supabase/supabase-js";

const APP_ID = "onsite-d";

export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", {
    p_app_id: APP_ID,
    p_role: "admin",
  });
  return !!data;
}

export async function isSuperAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", {
    p_app_id: APP_ID,
    p_role: "super_admin",
  });
  return !!data;
}

// Legacy: mantener por compatibilidad mientras se migra el resto del código
export function isAdminEmail(email?: string | null) {
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST;
  if (!allowlist || !email) return false;
  const allowed = allowlist
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
