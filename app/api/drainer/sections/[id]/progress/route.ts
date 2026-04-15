import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

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
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ accessToken: token });

  const { data: section, error: sectionError } = await supabase
    .from("drainer_sections")
    .select("start_ch,end_ch,direction")
    .eq("id", id)
    .single();

  if (sectionError || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { data: records } = await supabase
    .from("drainer_pipe_records")
    .select("chainage")
    .eq("section_id", id);

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

  // Progress = how far lodged chainages have advanced along the configured
  // start_ch → end_ch span (section size). Single metric — no dual-pipe / duplicate-CH heuristic
  // (air cushion and similar phases can lodge duplicate chainages without meaning “second line”).
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

  console.log("[sections/progress]", {
    sectionId: id,
    totalRecords: chainages.length,
    minCh,
    maxCh,
    currentCh,
    direction,
    progressPercent,
  });

  return NextResponse.json({
    currentCh,
    endCh,
    progressPercent,
    configured: startCh != null && endCh != null,
    hasRecords: chainages.length > 0,
  });
}
