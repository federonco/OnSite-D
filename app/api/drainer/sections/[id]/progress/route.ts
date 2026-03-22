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

  // Section metadata from drainer_sections (start_ch, end_ch, direction)
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

  const chainages = (records ?? []).map((r) => Number(r.chainage));
  const minCh = chainages.length > 0 ? Math.min(...chainages) : null;
  const maxCh = chainages.length > 0 ? Math.max(...chainages) : null;
  const direction = String(section.direction ?? "forward").toLowerCase();
  const isBackward = direction === "backward" || direction === "backwards";

  const currentCh = isBackward ? minCh : maxCh;

  const startCh = section.start_ch != null ? Number(section.start_ch) : null;
  const endCh = section.end_ch != null ? Number(section.end_ch) : null;

  let progressPercent = 0;
  if (startCh != null && endCh != null && currentCh != null) {
    const start = Math.min(startCh, endCh);
    const end = Math.max(startCh, endCh);
    const totalRange = end - start;
    if (totalRange > 0) {
      if (isBackward) {
        progressPercent = ((startCh - currentCh) / (startCh - endCh)) * 100;
      } else {
        progressPercent = ((currentCh - startCh) / (endCh - startCh)) * 100;
      }
      progressPercent = Math.min(100, Math.max(0, progressPercent));
      progressPercent = Math.round(progressPercent * 10) / 10;
    }
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
    endCh, // destination (where we're heading): always section.end_ch
    progressPercent,
    configured: startCh != null && endCh != null,
    hasRecords: chainages.length > 0,
  });
}
