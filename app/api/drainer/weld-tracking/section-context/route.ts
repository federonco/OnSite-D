import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminCrewIds } from "@/lib/admin-crew";
import { fetchSectionById, fetchUnifiedSectionByCatalogId } from "@/lib/section-catalog";
import { guideConfigFromAppConfig, guideModeContextFields } from "@/lib/section-app-config";
import {
  computeBackfillUpTo,
  fetchPspBackfillRecordsForDrainerSection,
  filterCheckpointsInSpan,
  parseCheckpointChainage,
  type WeldWrapSectionContext,
} from "@/lib/weld-wrap/section-context";

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(getSupabaseServer({ accessToken: token })))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sectionId = request.nextUrl.searchParams.get("sectionId")?.trim();
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const crewIds = await getAdminCrewIds(supabase);
  const unifiedSection = await fetchUnifiedSectionByCatalogId(supabase, sectionId, {
    crewIds,
  });
  const section =
    unifiedSection ?? (await fetchSectionById(supabase, sectionId, { crewIds }));
  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { records: pspRecordRows, error: pspError } =
    await fetchPspBackfillRecordsForDrainerSection(supabase, sectionId);

  if (pspError) {
    return NextResponse.json({ error: pspError }, { status: 500 });
  }

  const startCh = section.start_ch != null ? Number(section.start_ch) : null;
  const endCh = section.end_ch != null ? Number(section.end_ch) : null;
  const direction = section.direction;
  const backfillUpTo = computeBackfillUpTo(pspRecordRows, direction);

  const { data: checkpointRows, error: cpError } = await supabase
    .from("checkpoints")
    .select("*");

  if (cpError) {
    return NextResponse.json({ error: cpError.message }, { status: 500 });
  }

  const parsedCheckpoints = (checkpointRows ?? [])
    .map((row) => {
      const ch = parseCheckpointChainage(row as Record<string, unknown>);
      if (ch == null) return null;
      const r = row as {
        id: string;
        name: string;
        type?: string;
        is_active?: boolean | null;
        active?: boolean | null;
      };
      return {
        id: r.id,
        name: r.name,
        chainage: ch,
        type: r.type ?? "Info",
        is_active: r.is_active ?? r.active ?? true,
      };
    })
    .filter((cp): cp is NonNullable<typeof cp> => cp != null);

  const guideCfg = guideConfigFromAppConfig(unifiedSection?.app_config ?? null);

  const context: WeldWrapSectionContext = {
    startCh,
    endCh,
    direction,
    backfillUpTo,
    checkpoints: filterCheckpointsInSpan(
      parsedCheckpoints,
      startCh,
      endCh,
      backfillUpTo,
      direction
    ),
    ...guideModeContextFields(guideCfg),
  };

  return NextResponse.json({ context });
}
