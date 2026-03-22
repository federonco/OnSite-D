import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/admin";

/** Returns total count of pending alerts (inconsistencies, duplicates, near-tolerance, deflection trends) */
export async function GET(request: NextRequest) {
  const { user, token } = await getUserFromRequest(request);
  if (!user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const origin =
    request.headers.get("x-forwarded-proto") && request.headers.get("x-forwarded-host")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl?.origin ?? "http://localhost:3000";

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const [incRes, dupRes, fittingsRes, nearRes, trendRes] = await Promise.all([
      fetch(`${origin}/api/drainer/records/inconsistencies`, { headers }),
      fetch(`${origin}/api/drainer/records/duplicates`, { headers }),
      fetch(`${origin}/api/drainer/records/fittings`, { headers }),
      fetch(`${origin}/api/drainer/records/near-tolerance`, { headers }),
      fetch(`${origin}/api/drainer/records/deflection-trend`, { headers }),
    ]);

    const incData = await incRes.json();
    const dupData = await dupRes.json();
    const fittingsData = await fittingsRes.json();
    const nearData = await nearRes.json();
    const trendData = await trendRes.json();

    const incCount = (incData.sections ?? (incData.section_id ? [incData] : [])).reduce(
      (s: number, sec: { inconsistencies?: unknown[] }) =>
        s + (sec.inconsistencies?.length ?? 0),
      0
    );
    const dupCount = (dupData.sections ?? (dupData.duplicates ? [{ duplicates: dupData.duplicates }] : [])).reduce(
      (s: number, sec: { duplicates?: unknown[] }) =>
        s + (sec.duplicates?.length ?? 0),
      0
    );
    const fittingsCount = (fittingsData.sections ?? (fittingsData.records ? [{ records: fittingsData.records }] : [])).reduce(
      (s: number, sec: { records?: unknown[] }) =>
        s + (sec.records?.length ?? 0),
      0
    );
    const nearCount = (nearData.sections ?? (nearData.records ? [{ records: nearData.records }] : [])).reduce(
      (s: number, sec: { records?: unknown[] }) =>
        s + (sec.records?.length ?? 0),
      0
    );
    const trendCount = (trendData.sections ?? (trendData.trends ? [{ trends: trendData.trends }] : [])).reduce(
      (s: number, sec: { trends?: unknown[] }) =>
        s + (sec.trends?.length ?? 0),
      0
    );

    const count = incCount + dupCount + fittingsCount + nearCount + trendCount;
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
