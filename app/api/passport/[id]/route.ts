import { db } from "../../../../lib/db";
import type { webcrypto } from "node:crypto";
type JsonWebKey = webcrypto.JsonWebKey;
import { errorResponse, ApiError } from "../../../../lib/auth";
import { verifyPassport } from "../../../../lib/passport";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const d = await db();
    const q = await d.query<{
      id: string;
      batch_id: string;
      revision: number;
      payload: unknown;
      hash: string;
      signature: string;
      key_id: string;
      revoked: boolean;
      public_key: JsonWebKey;
    }>(
      "SELECT p.*,k.public_key FROM passports p JOIN signing_keys k ON p.key_id=k.id WHERE p.id=$1 OR p.batch_id=$1 ORDER BY p.revision DESC LIMIT 1",
      [id],
    );
    const p = q.rows[0];
    if (!p) throw new ApiError("Public passport not found", 404);
    if (
      (p.payload as { public_schema_version?: string })
        ?.public_schema_version !== "secondroute.public.v1"
    )
      throw new ApiError(
        "This passport predates the public disclosure policy. Ask a coordinator to issue a replacement revision.",
        409,
      );
    const latest = await d.query<{ revision: number }>(
      "SELECT max(revision) AS revision FROM passports WHERE batch_id=$1",
      [p.batch_id],
    );
    const envelope = {
      payload: p.payload,
      hash: p.hash,
      signature: p.signature,
      key_id: p.key_id,
      algorithm: "Ed25519",
      public_key: p.public_key,
    };
    return Response.json(
      {
        ...envelope,
        status: p.revoked
          ? "revoked"
          : latest.rows[0].revision > p.revision
            ? "superseded"
            : verifyPassport(envelope)
              ? "valid"
              : "modified",
      },
      {
        headers: new URL(request.url).searchParams.has("download")
          ? {
              "Content-Disposition": `attachment; filename="secondroute-passport-${p.batch_id}.json"`,
            }
          : {},
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
