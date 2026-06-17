import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { resolvePipeRecordSectionRef } from "@/lib/drainer-section-resolve";
import { getSupabaseServer } from "@/lib/supabase/server";
import { processCheckpointAlerts } from "@/lib/checkpoint-notify";
import { detectRecordInconsistencies } from "@/lib/record-inconsistencies";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const recordFromId = searchParams.get("recordFromId");
  const recordToId = searchParams.get("recordToId");
  const context = Math.min(10, Math.max(0, parseInt(searchParams.get("context") ?? "2", 10)));
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : null;

  const { token } = await getUserFromRequest(request);
  const qrTokenParam = searchParams.get("qr_token")?.trim() ?? null;

  if (!token && qrTokenParam) {
    const verify = getSupabaseServer({ useServiceRole: true });
    const { data: secRow, error: verifyErr } = await verify
      .from("drainer_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("qr_token", qrTokenParam)
      .maybeSingle();
    if (verifyErr) {
      return NextResponse.json({ error: verifyErr.message }, { status: 500 });
    }
    if (!secRow) {
      return NextResponse.json({ error: "Invalid QR token" }, { status: 403 });
    }
  }

  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const useContext = !!(recordFromId && recordToId);

  let query = supabase
    .from("drainer_pipe_records")
    .select("*")
    .or(`section_id.eq.${sectionId},unified_section_id.eq.${sectionId}`);

  if (limit) {
    query = query
      .order("date_installed", { ascending: false })
      .order("chainage", { ascending: false })
      .limit(limit);
  } else {
    query = query.order("chainage", { ascending: useContext });
  }

  const { data: records, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = records ?? [];

  if (useContext) {
    const idxFrom = list.findIndex((r) => r.id === recordFromId);
    const idxTo = list.findIndex((r) => r.id === recordToId);
    if (idxFrom >= 0 && idxTo >= 0) {
      const i = Math.min(idxFrom, idxTo);
      const j = Math.max(idxFrom, idxTo);
      const start = Math.max(0, i - context);
      const end = Math.min(list.length, j + context + 1);
      const slice = list.slice(start, end);
      return NextResponse.json({ records: slice });
    }
  }

  return NextResponse.json({ records: list });
}

export async function POST(request: NextRequest) {
  const { token } = await getUserFromRequest(request);
  const supabaseForInsert = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const body = await request.json();
  const {
    section_id,
    subsection_id,
    date_installed,
    time_installed,
    chainage,
    pipe_fitting_id,
    joint_type,
    witness_mark,
    internal_seal,
    deflection_v_sign,
    deflection_v_mm,
    deflection_h_side,
    deflection_h_mm,
    cp_lugs,
    ovality_check,
    joint_air_test,
    cement_liner,
    spark_testing,
    inspector_name,
    signature_data,
    ai_insight,
  } = body;

  if (!section_id || chainage == null) {
    return NextResponse.json(
      { error: "Missing section_id or chainage" },
      { status: 400 }
    );
  }

  const { ref, error: resolveError } = await resolvePipeRecordSectionRef(
    supabaseForInsert,
    String(section_id)
  );
  if (resolveError || !ref) {
    return NextResponse.json(
      { error: resolveError ?? "Section not found" },
      { status: resolveError === "Section not found" ? 404 : 500 }
    );
  }

  const vMm = deflection_v_mm != null ? Math.abs(Number(deflection_v_mm)) : 0;
  const hMm = deflection_h_mm != null ? Math.abs(Number(deflection_h_mm)) : 0;
  if (vMm > 50) {
    return NextResponse.json(
      { error: "Vertical deflection out of tolerance (max 50mm)" },
      { status: 400 }
    );
  }
  if (hMm > 100) {
    return NextResponse.json(
      { error: "Horizontal deflection out of tolerance (max 100mm)" },
      { status: 400 }
    );
  }

  const record = {
    section_id: ref.section_id,
    unified_section_id: ref.unified_section_id,
    ...(subsection_id ? { subsection_id } : {}),
    date_installed: date_installed || null,
    time_installed: time_installed || null,
    chainage: Number(chainage),
    pipe_fitting_id: pipe_fitting_id || null,
    joint_type: joint_type || null,
    witness_mark: Boolean(witness_mark),
    internal_seal: Boolean(internal_seal),
    deflection_v_sign: deflection_v_sign || null,
    deflection_v_mm: deflection_v_mm != null ? Number(deflection_v_mm) : null,
    deflection_h_side: deflection_h_side || null,
    deflection_h_mm: deflection_h_mm != null ? Number(deflection_h_mm) : null,
    cp_lugs: cp_lugs != null ? Boolean(cp_lugs) : null,
    ovality_check: Boolean(ovality_check ?? false),
    joint_air_test: joint_air_test != null ? Boolean(joint_air_test) : null,
    cement_liner: Boolean(cement_liner ?? false),
    spark_testing: Boolean(spark_testing ?? false),
    inspector_name: inspector_name || null,
    signature_data: signature_data || null,
    ai_insight: ai_insight || null,
  };

  let counterQuery = supabaseForInsert.from("drainer_pipe_records").select("counter");

  if (ref.section_id) {
    counterQuery = counterQuery.eq("section_id", ref.section_id);
  } else {
    counterQuery = counterQuery
      .eq("unified_section_id", ref.unified_section_id!)
      .is("section_id", null);
  }

  const { data: maxCounterRow, error: maxCounterError } = await counterQuery
    .order("counter", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxCounterError) {
    return NextResponse.json({ error: maxCounterError.message }, { status: 500 });
  }

  const currentMaxCounter =
    maxCounterRow?.counter != null && Number.isFinite(Number(maxCounterRow.counter))
      ? Number(maxCounterRow.counter)
      : 0;
  const nextCounter = currentMaxCounter + 1;

  const { data, error } = await supabaseForInsert
    .from("drainer_pipe_records")
    .insert({
      ...record,
      counter: nextCounter,
    })
    .select("id,chainage,pipe_fitting_id,joint_type,date_installed")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseServer({ useServiceRole: true });
  if (ref.section_id) {
    processCheckpointAlerts(supabaseAdmin, ref.section_id).catch((err) =>
      console.error("Checkpoint alerts:", err)
    );
  }
  detectRecordInconsistencies(supabaseAdmin).catch((err) =>
    console.error("Record inconsistencies:", err)
  );

  return NextResponse.json({ record: data });
}
