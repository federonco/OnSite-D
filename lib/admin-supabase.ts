import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * After verifying app admin via JWT, use service role for data reads/writes
 * (same pattern as GET /api/drainer/sections).
 */
export async function getSupabaseForVerifiedAdmin(
  request: NextRequest
): Promise<{
  user: User | null;
  token: string | null;
  isAdmin: boolean;
  supabase: SupabaseClient;
}> {
  const { user, token } = await getUserFromRequest(request);
  const userSb = token ? getSupabaseServer({ accessToken: token }) : null;
  const verifiedAdmin =
    !!userSb && !!user && !!token && (await isAdmin(userSb));

  const supabase = verifiedAdmin
    ? getSupabaseServer({ useServiceRole: true })
    : token
      ? getSupabaseServer({ accessToken: token })
      : getSupabaseServer({ useServiceRole: true });

  return { user, token, isAdmin: verifiedAdmin, supabase };
}
