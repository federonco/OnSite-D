import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminCrewIds } from "@/lib/admin-crew";
import {
  computeMinItrRequired,
  computeSectionItrProgress,
  ITR_PAGE_SIZE,
} from "@/lib/drainer";
import { fetchSectionById, pipeRecordsSectionOrFilter } from "@/lib/section-catalog";
import { normalizeGuideXmlFromJsonb } from "@/lib/installation-guide-xml";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crewIds = await getAdminCrewIds(supabase);
  const section = await fetchSectionById(supabase, id, { crewIds });
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { data: records } = await supabase
    .from("drainer_pipe_records")
    .select("id")
    .or(pipeRecordsSectionOrFilter(id));

  const installedCount = records?.length ?? 0;
  const startCh = section.start_ch != null ? Number(section.start_ch) : null;
  const endCh = section.end_ch != null ? Number(section.end_ch) : null;

  const guideXml = normalizeGuideXmlFromJsonb(section.app_config?.guide_xml);
  const guideEnabled = section.app_config?.guide_enabled === true;
  const guideItemCount =
    guideEnabled && guideXml?.length ? guideXml.length : undefined;

  const minItrRequired = computeMinItrRequired(startCh, endCh, { guideItemCount });
  const totalRecordSlots =
    minItrRequired != null ? minItrRequired * ITR_PAGE_SIZE : null;
  const progressPercent = computeSectionItrProgress(installedCount, minItrRequired);

  return NextResponse.json({
    progressPercent,
    configured: minItrRequired != null,
    hasRecords: installedCount > 0,
    installedCount,
    minItrRequired,
    totalRecordSlots,
    endCh,
  });
}
