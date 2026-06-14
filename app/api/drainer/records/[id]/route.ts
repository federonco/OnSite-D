import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin, isSuperAdmin } from "@/lib/admin";
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
  const supabase = getSupabaseServer({ accessToken: token });
  if (!await isAdmin(supabase)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const superAdmin = await isSuperAdmin(supabase);

  const { data: existingRecord, error: existingError } = await supabase
    .from("drainer_pipe_records")
    .select("section_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existingRecord) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

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

  if ("section_id" in body) {
    if (!superAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const nextSectionId =
      typeof body.section_id === "string" ? body.section_id.trim() : "";
    if (!nextSectionId) {
      return NextResponse.json({ error: "Invalid section_id" }, { status: 400 });
    }
    if (nextSectionId !== existingRecord.section_id) {
      const serviceSb = getSupabaseServer({ useServiceRole: true });
      const { data: section, error: sectionError } = await serviceSb
        .from("drainer_sections")
        .select("id")
        .eq("id", nextSectionId)
        .maybeSingle();
      if (sectionError) {
        return NextResponse.json({ error: sectionError.message }, { status: 500 });
      }
      if (!section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
      }
      updates.section_id = nextSectionId;
      updates.subsection_id = null;
    }
  }

  const recordSelect =
    "id,section_id,subsection_id,counter,date_installed,time_installed,lodged_at,updated_at,chainage,pipe_fitting_id,joint_type,witness_mark,internal_seal,deflection_v_sign,deflection_v_mm,deflection_h_side,deflection_h_mm,cp_lugs,ovality_check,joint_air_test,cement_liner,spark_testing,inspector_name,signature_data,ai_insight";

  if (Object.keys(updates).length === 0) {
    const { data, error } = await supabase
      .from("drainer_pipe_records")
      .select(recordSelect)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ record: data });
  }

  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .update(updates)
    .eq("id", id)
    .select(recordSelect)
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
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
