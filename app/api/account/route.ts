import { actorFor, googleConfigured, mailConfigured } from "@/lib/account-auth";
import { errorResponse } from "@/lib/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await actorFor(request);
    return Response.json(
      { ...actor, google: googleConfigured(), mail: mailConfigured() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
