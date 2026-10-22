import { roleFor, errorResponse } from "../../../lib/auth";
import { state } from "../../../lib/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    roleFor(request);
    const q = new URL(request.url).searchParams;
    return Response.json(
      await state(q.get("event"), {
        zone: q.get("zone"),
        status: q.get("status"),
        search: q.get("search"),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
