import { actorFor } from "@/lib/account-auth";
import { db } from "../../../../lib/db";
import { errorResponse, ApiError } from "../../../../lib/auth";
import { readFile } from "node:fs/promises";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await actorFor(request);
    const { id } = await params;
    const d = await db();
    const q = await d.query<{ mime: string; path: string }>(
      "SELECT mime,path FROM media WHERE id=$1 AND org_id=$2",
      [id, actor.orgId],
    );
    if (!q.rows[0]) throw new ApiError("Evidence unavailable", 404);
    return new Response(await readFile(q.rows[0].path), {
      headers: {
        "Content-Type": q.rows[0].mime,
        "Content-Disposition": 'attachment; filename="evidence"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
