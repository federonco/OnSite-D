import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";

const ALLOWED_FIELDS = new Set(["welded_at", "wrapped_at", "welded_steps", "comments"]);

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServer({ useServiceRole: true });
  const withCommentsSelect =
    "id,counter,chainage,pipe_fitting_id,joint_type,date_installed,welded_at,wrapped_at,welded_steps,comments,section_id,drainer_sections(name)";
  const baseSelect =
    "id,counter,chainage,pipe_fitting_id,joint_type,date_installed,welded_at,wrapped_at,welded_steps,section_id,drainer_sections(name)";

  let { data, error } = await supabase
    .from("drainer_pipe_records")
    .select(withCommentsSelect)
    .in("joint_type", ["WR", "WB", "Transition"])
    .order("chainage", { ascending: true });

  if (error?.message?.includes("comments")) {
    const fallback = await supabase
      .from("drainer_pipe_records")
      .select(baseSelect)
      .in("joint_type", ["WR", "WB", "Transition"])
      .order("chainage", { ascending: true });
    data = fallback.data?.map((row) => ({ ...row, comments: null })) ?? null;
    error = fallback.error;
  }

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
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  } else if (body.field === "comments") {
    if (body.value !== null && typeof body.value !== "string") {
      return NextResponse.json(
        { error: "Invalid comments. Must be string or null." },
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

  const updateValue =
    body.field === "comments"
      ? typeof body.value === "string" && body.value.trim() === ""
        ? null
        : (body.value ?? null)
      : body.value;

  const supabase = getSupabaseServer({ useServiceRole: true });
  const selectFields =
    body.field === "comments"
      ? "id,welded_at,wrapped_at,welded_steps,comments"
      : "id,welded_at,wrapped_at,welded_steps";

  let { data, error } = await supabase
    .from("drainer_pipe_records")
    .update({ [body.field]: updateValue })
    .eq("id", body.id)
    .select(selectFields)
    .single();

  if (error?.message?.includes("comments") && body.field === "comments") {
    return NextResponse.json(
      {
        error:
          "Comments column not available. Apply migration 20260531120000_add_comments_to_drainer_pipe_records.sql",
      },
      { status: 503 }
    );
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}
