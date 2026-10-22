import { actorFor } from "@/lib/account-auth";
import { errorResponse } from "../../../lib/auth";
import { state } from "../../../lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await actorFor(request);
    const q = new URL(request.url).searchParams;
    const snapshot = await state(
      q.get("event"),
      {
        zone: q.get("zone"),
        status: q.get("status"),
        search: q.get("search"),
      },
      actor.orgId,
    );
    if (!actor.user) {
      snapshot.events = snapshot.events.filter((e) =>
        ["riverlight", "design-week"].includes(e.id),
      );
      snapshot.batches = snapshot.batches.map((b) => ({
        ...b,
        notes: b.notes
          .replace(
            /Fictional demonstration receipt\./g,
            "Sample receipt record.",
          )
          .replace(
            /Fictional seed attestation reviewed for demo only/g,
            "Sample receipt reviewed for this workspace",
          ),
      }));
    }
    return Response.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
