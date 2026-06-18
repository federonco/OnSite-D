import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminCrewIds } from "@/lib/admin-crew";
import { fetchSectionById, pipeRecordsSectionOrFilter } from "@/lib/section-catalog";

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
    .select("chainage")
    .or(pipeRecordsSectionOrFilter(id));

  const chainages = (records ?? [])
    .map((r) => Number(r.chainage))
    .filter((n) => Number.isFinite(n));
  const minCh = chainages.length > 0 ? Math.min(...chainages) : null;
  const maxCh = chainages.length > 0 ? Math.max(...chainages) : null;
  const direction = String(section.direction ?? "forward").toLowerCase();
  const isBackward = direction === "backward" || direction === "backwards";

  const startCh = section.start_ch != null ? Number(section.start_ch) : null;
  const endCh = section.end_ch != null ? Number(section.end_ch) : null;

  let currentCh = isBackward ? minCh : maxCh;
  let progressPercent = 0;

  if (
    startCh != null &&
    endCh != null &&
    chainages.length > 0 &&
    startCh !== endCh
  ) {
    const denom = endCh - startCh;
    const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
    const ratioFor = (ch: number) => clamp01((ch - startCh) / denom);

    let bestRatio = -Infinity;
    let bestChainage: number | null = null;
    for (const ch of chainages) {
      const ratio = ratioFor(ch);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestChainage = ch;
      }
    }

    currentCh = bestChainage;
    progressPercent = Math.round(bestRatio * 100 * 10) / 10;
  }

  return NextResponse.json({
    currentCh,
    endCh,
    progressPercent,
    configured: startCh != null && endCh != null,
    hasRecords: chainages.length > 0,
  });
}
