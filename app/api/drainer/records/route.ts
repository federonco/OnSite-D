import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { processCheckpointAlerts } from "@/lib/checkpoint-notify";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  if (!sectionId) {
    return NextResponse.json({ error: "Missing sectionId" }, { status: 400 });
  }

  const { token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .select("*")
    .eq("section_id", sectionId)
    .order("chainage", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    section_id,
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

  const supabase = getSupabaseServer({ accessToken: token });

  const record = {
    section_id,
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

  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .insert(record)
    .select("id,chainage,pipe_fitting_id,joint_type,date_installed")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const supabaseAdmin = getSupabaseServer({ useServiceRole: true });
  processCheckpointAlerts(supabaseAdmin).catch((err) =>
    console.error("Checkpoint alerts:", err)
  );

  return NextResponse.json({ record: data });
}
