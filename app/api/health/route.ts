import { db } from "@/lib/db";
import { getAuth } from "@/lib/account-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getAuth();
    await (await db()).query("SELECT 1");
    return Response.json(
      { ok: true, service: "SecondRoute" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, service: "SecondRoute" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
