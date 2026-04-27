import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set(["welded_at", "wrapped_at", "welded_steps"]);

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .select(
      "id,counter,chainage,pipe_fitting_id,joint_type,date_installed,welded_at,wrapped_at,welded_steps,section_id,drainer_sections(name)"
    )
    .in("joint_type", ["WR", "WB"])
    .order("chainage", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    field?: string;
    value?: string | null | Record<string, unknown>;
  };

  if (!body.id || !body.field || !ALLOWED_FIELDS.has(body.field)) {
    return NextResponse.json(
      { error: "Invalid payload. Expected id and field." },
      { status: 400 }
    );
  }

  if (body.field === "welded_steps") {
    if (
      body.value !== null &&
      (typeof body.value !== "object" || Array.isArray(body.value))
    ) {
      return NextResponse.json(
        { error: "Invalid welded_steps. Must be object or null." },
        { status: 400 }
      );
    }
  } else {
    if (body.value !== null && typeof body.value !== "string") {
      return NextResponse.json(
        { error: "Invalid value. Must be ISO string or null." },
        { status: 400 }
      );
    }

    if (typeof body.value === "string" && Number.isNaN(Date.parse(body.value))) {
      return NextResponse.json(
        { error: "Invalid timestamp format." },
        { status: 400 }
      );
    }
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const { data, error } = await supabase
    .from("drainer_pipe_records")
    .update({ [body.field]: body.value })
    .eq("id", body.id)
    .select("id,welded_at,wrapped_at,welded_steps")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}
