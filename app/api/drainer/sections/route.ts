import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { listDrainerSectionsWithProjectFallback } from "@/lib/drainer-sections-read";
import { sectionsWriteForbiddenResponse } from "@/lib/drainer-sections-policy";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  const subsectionId = request.nextUrl.searchParams.get("subsection_id")?.trim() || null;
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

  let sections = data;
  if (subsectionId) {
    const { data: subsectionData, error: subsectionError } = await supabase
      .from("subsections")
      .select("id,section_id,app_config")
      .eq("id", subsectionId)
      .maybeSingle();

    if (subsectionError) {
      return NextResponse.json(
        { error: subsectionError.message },
        { status: 500 }
      );
    }

    if (subsectionData) {
      const appConfig = (subsectionData.app_config ?? {}) as Record<string, unknown>;
      const subsectionGuideEnabledRaw = appConfig.guide_enabled;
      const subsectionGuideXmlRaw = appConfig.guide_xml;
      const subsectionGuideEnabled =
        typeof subsectionGuideEnabledRaw === "boolean"
          ? subsectionGuideEnabledRaw
          : undefined;
      const subsectionGuideXml = Array.isArray(subsectionGuideXmlRaw)
        ? (subsectionGuideXmlRaw as { sequence_number: number; item_id: string }[])
        : undefined;

      sections = data.map((section) => {
        if (section.id !== subsectionData.section_id) return section;
        return {
          ...section,
          guide_enabled:
            subsectionGuideEnabled !== undefined
              ? subsectionGuideEnabled
              : section.guide_enabled,
          guide_xml:
            subsectionGuideXml !== undefined ? subsectionGuideXml : section.guide_xml,
          subsection_id: subsectionData.id,
        };
      });
    }
  }

  return NextResponse.json({
    sections,
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
