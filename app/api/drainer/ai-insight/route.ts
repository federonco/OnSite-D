import { NextRequest, NextResponse } from "next/server";
import { getPipeInstallationInsight } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { chainage, pipeId, vSign, vMm, hSide, hMm, jointType } = body;

  if (
    chainage == null ||
    !pipeId ||
    vSign == null ||
    vMm == null ||
    hSide == null ||
    hMm == null ||
    !jointType
  ) {
    return NextResponse.json(
      { error: "Missing required params: chainage, pipeId, vSign, vMm, hSide, hMm, jointType" },
      { status: 400 }
    );
  }

  try {
    const insight = await getPipeInstallationInsight({
      chainage: Number(chainage),
      pipeId: String(pipeId),
      vSign: String(vSign),
      vMm: Number(vMm),
      hSide: String(hSide),
      hMm: Number(hMm),
      jointType: String(jointType),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI insight failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
