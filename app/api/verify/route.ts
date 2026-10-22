import { verifyPassport } from "../../../lib/passport";
import type { webcrypto } from "node:crypto";
type JsonWebKey = webcrypto.JsonWebKey;
import { db } from "../../../lib/db";
import { errorResponse, ApiError } from "../../../lib/auth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.key_id) throw new ApiError("Missing key identifier");
    const d = await db();
    const keys = await d.query<{ public_key: JsonWebKey }>(
      "SELECT public_key FROM signing_keys WHERE id=$1",
      [body.key_id],
    );
    if (!keys.rows[0])
      return Response.json({ valid: false, status: "unverifiable" });
    const valid = verifyPassport({
      ...body,
      public_key: keys.rows[0].public_key,
    });
    if (!valid) return Response.json({ valid: false, status: "modified" });
    const record = await d.query<{
      revoked: boolean;
      revision: number;
      batch_id: string;
    }>("SELECT revoked,revision,batch_id FROM passports WHERE id=$1", [
      body.payload?.id,
    ]);
    if (!record.rows[0])
      return Response.json({
        valid: true,
        status: "unverifiable",
        message: "Signature is valid but no publication record exists",
      });
    const latest = await d.query<{ revision: number }>(
      "SELECT max(revision) AS revision FROM passports WHERE batch_id=$1",
      [record.rows[0].batch_id],
    );
    const status = record.rows[0].revoked
      ? "revoked"
      : latest.rows[0].revision > record.rows[0].revision
        ? "superseded"
        : "valid";
    return Response.json({ valid, status });
  } catch (e) {
    return errorResponse(e);
  }
}
