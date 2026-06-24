import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdmin } from "@/lib/admin";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchSectionById, fetchUnifiedSectionByCatalogId } from "@/lib/section-catalog";

const ALLOWED_FIELDS = new Set(["welded_at", "wrapped_at", "welded_steps", "comments"]);

async function enrichWeldTrackingRecords(
  supabase: ReturnType<typeof getSupabaseServer>,
  records: Array<{
    section_id?: string | null;
    unified_section_id?: string | null;
    [key: string]: unknown;
  }>
) {
  const rawIds = new Set<string>();
  for (const record of records) {
    const raw = record.unified_section_id ?? record.section_id;
    if (raw) rawIds.add(raw);
  }

  const canonicalByRaw = new Map<string, string>();
  const nameByCanonical = new Map<string, string>();
  await Promise.all(
    Array.from(rawIds).map(async (rawId) => {
      const unified = await fetchUnifiedSectionByCatalogId(supabase, rawId);
      const canonical = unified?.id ?? rawId;
      canonicalByRaw.set(rawId, canonical);
      if (unified?.name) {
        nameByCanonical.set(canonical, unified.name);
        return;
      }
      const section = await fetchSectionById(supabase, rawId);
      if (section?.name) nameByCanonical.set(canonical, section.name);
    })
  );

  return records.map((record) => {
    const rawId = record.unified_section_id ?? record.section_id ?? null;
    const catalog_section_id = rawId ? (canonicalByRaw.get(rawId) ?? rawId) : null;
    return {
      ...record,
      catalog_section_id,
      drainer_sections: catalog_section_id
        ? { name: nameByCanonical.get(catalog_section_id) ?? null }
        : null,
    };
  });
}

export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!await isAdmin(getSupabaseServer({ accessToken: token }))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const withCommentsSelect =
    "id,counter,chainage,pipe_fitting_id,joint_type,date_installed,welded_at,wrapped_at,welded_steps,comments,section_id,unified_section_id";
  const baseSelect =
    "id,counter,chainage,pipe_fitting_id,joint_type,date_installed,welded_at,wrapped_at,welded_steps,section_id,unified_section_id";

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

  const records = await enrichWeldTrackingRecords(supabase, data ?? []);
  return NextResponse.json({ records });
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
