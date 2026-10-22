import { publicKey } from "../../../lib/passport";
import { db } from "../../../lib/db";
export const runtime = "nodejs";
export async function GET() {
  const d = await db();
  const keys = await d.query(
    "SELECT id AS key_id,public_key,created_at FROM signing_keys ORDER BY created_at",
  );
  return Response.json({
    algorithm: "Ed25519",
    keys: keys.rows,
    current: await publicKey(),
  });
}
