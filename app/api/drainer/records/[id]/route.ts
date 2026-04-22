import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({ record: data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const allowed = [
    "date_installed",
    "time_installed",
    "chainage",
    "pipe_fitting_id",
    "joint_type",
    "witness_mark",
    "internal_seal",
    "deflection_v_sign",
    "deflection_v_mm",
    "deflection_h_side",
    "deflection_h_mm",
    "cp_lugs",
    "ovality_check",
    "joint_air_test",
    "cement_liner",
    "spark_testing",
    "inspector_name",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const v = body[key];
      if (key === "chainage" || key === "deflection_v_mm" || key === "deflection_h_mm") {
        updates[key] = v != null ? Number(v) : null;
      } else if (
        key === "witness_mark" ||
        key === "internal_seal" ||
        key === "ovality_check" ||
        key === "cement_liner" ||
        key === "spark_testing"
      ) {
        updates[key] = Boolean(v ?? false);
      } else if (key === "cp_lugs" || key === "joint_air_test") {
        updates[key] = v != null ? Boolean(v) : null;
      } else {
        updates[key] = v ?? null;
      }
    }
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .update(updates)
    .eq("id", id)
    .select(
      "id,section_id,subsection_id,counter,date_installed,time_installed,lodged_at,updated_at,chainage,pipe_fitting_id,joint_type,witness_mark,internal_seal,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm,cp_lugs,ovality_check,joint_air_test,cement_liner,spark_testing,inspector_name,signature_data,ai_insight"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { error } = await supabase
    .from("drainer_pipe_records")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
