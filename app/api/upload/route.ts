import { actorFor } from "@/lib/account-auth";
import { errorResponse, ApiError, allow } from "../../../lib/auth";
import { db, dataDir } from "../../../lib/db";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const actor = await actorFor(request, true);
    const role = actor.role;
    allow(role, ["admin", "coordinator", "worker", "partner"]);
    if (Number(request.headers.get("content-length")) > 6000000)
      throw new ApiError("File exceeds 5 MB limit", 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > 5 * 1024 * 1024)
      throw new ApiError("Upload a file between 1 byte and 5 MB");
    const bytes = Buffer.from(await file.arrayBuffer());
    let mime = "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      mime = "image/jpeg";
    if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      mime = "image/png";
    if (bytes.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
    if (!mime || file.type !== mime)
      throw new ApiError(
        "Only genuine JPEG, PNG, and PDF evidence files are allowed",
      );
    const id = randomUUID();
    await mkdir(path.join(dataDir(), "uploads"), { recursive: true });
    const filename = path.join(dataDir(), "uploads", id);
    await writeFile(filename, bytes, { flag: "wx" });
    const d = await db();
    await d.query(
      "INSERT INTO media(id,org_id,mime,path) VALUES($1,$2,$3,$4)",
      [id, actor.orgId, mime, filename],
    );
    return Response.json({ ok: true, id, url: "/api/media/" + id });
  } catch (e) {
    return errorResponse(e);
  }
}
