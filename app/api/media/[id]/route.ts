import { db } from "../../../../lib/db";
import { roleFor, errorResponse, ApiError } from "../../../../lib/auth";
import { readFile } from "node:fs/promises";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    roleFor(request);
    const { id } = await params;
    const d = await db();
    const q = await d.query<{ mime: string; path: string }>(
      "SELECT mime,path FROM media WHERE id=$1 AND org_id=$2",
      [id, "demo-org"],
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
