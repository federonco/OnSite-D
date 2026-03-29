import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { sendSectionQREmail } from "@/lib/section-qr-email";
import {
  DRAINER_SECTION_BASE,
  listDrainerSectionsWithProjectFallback,
} from "@/lib/drainer-sections-read";

export async function GET(request: NextRequest) {
  const { token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const { data, error, projectEmbedOk } =
    await listDrainerSectionsWithProjectFallback(supabase);

  if (error || data == null) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load sections" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sections: data,
    sectionsMeta: { projectEmbedOk },
  });
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, start_ch, end_ch, direction, project_id, itp_number } = body;

  if (!name) {
    return NextResponse.json({ error: "Missing section name" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ accessToken: token });
  const { data, error } = await supabase
    .from("drainer_sections")
    .insert({
      name: String(name),
      start_ch: start_ch != null ? Number(start_ch) : null,
      end_ch: end_ch != null ? Number(end_ch) : null,
      direction: direction || null,
      project_id: project_id ?? null,
      itp_number: itp_number || null,
    })
    .select(DRAINER_SECTION_BASE)
    .single();

  if (error) {
    console.error("[drainer_sections POST] insert failed:", error.message, error.details, error.hint);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const adminEmail = user.email?.trim();
  if (adminEmail && data) {
    sendSectionQREmail({
      sectionId: data.id,
      sectionName: data.name,
      recipientEmail: adminEmail,
    }).catch((err) => console.error("Section QR email failed:", err));
  }

  return NextResponse.json({
    section: data ? { ...data, projects: null } : data,
  });
}
