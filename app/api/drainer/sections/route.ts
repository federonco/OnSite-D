import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { listDrainerSectionsWithProjectFallback } from "@/lib/drainer-sections-read";
import { sectionsWriteForbiddenResponse } from "@/lib/drainer-sections-policy";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const includeQrFields = !!(
    user &&
    token &&
    isAdminEmail(user.email)
  );

  const { data, error, projectEmbedOk } =
    await listDrainerSectionsWithProjectFallback(supabase, {
      includeQrFields,
    });

  if (error || data == null) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load sections" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sections: data,
    sectionsMeta: { projectEmbedOk },
  });
}

export async function POST(_request: NextRequest) {
  const { user, token } = await getUserFromRequest(_request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sectionsWriteForbiddenResponse();
}
