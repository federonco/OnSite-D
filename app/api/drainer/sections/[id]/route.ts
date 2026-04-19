import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { sectionsWriteForbiddenResponse } from "@/lib/drainer-sections-policy";

export async function PUT(_request: NextRequest) {
  const { user, token } = await getUserFromRequest(_request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sectionsWriteForbiddenResponse();
}

export async function DELETE(_request: NextRequest) {
  const { user, token } = await getUserFromRequest(_request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return sectionsWriteForbiddenResponse();
}
