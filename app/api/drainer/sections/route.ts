import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { sendSectionQREmail } from "@/lib/section-qr-email";

export async function GET(request: NextRequest) {
  const { token } = await getUserFromRequest(request);
  const supabase = token
    ? getSupabaseServer({ accessToken: token })
    : getSupabaseServer({ useServiceRole: true });

  const { data, error } = await supabase
    .from("drainer_sections")
    .select("id,name,start_ch,end_ch,direction,project_name,project_number,itp_number")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, start_ch, end_ch, direction, project_name, project_number, itp_number } = body;

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
      project_name: project_name || null,
      project_number: project_number || null,
      itp_number: itp_number || null,
    })
    .select("id,name,start_ch,end_ch,direction,project_name,project_number,itp_number")
    .single();

  if (error) {
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

  return NextResponse.json({ section: data });
}
