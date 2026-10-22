import { actorFor } from "@/lib/account-auth";
import { errorResponse, ApiError } from "../../../lib/auth";
import { action } from "../../../lib/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 100000)
      throw new ApiError("Request too large", 413);
    const actor = await actorFor(request, true);
    const role = actor.role;
    const input = await request.json();
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.action !== "string"
    )
      throw new ApiError("Expected an action object");
    if (input.action === "reset")
      throw new ApiError("Sample records are read-only", 403);
    if (input.workspace_id && input.workspace_id !== actor.orgId)
      throw new ApiError("This capture belongs to a different workspace", 403);
    return Response.json(await action(input, role, actor.orgId));
  } catch (e) {
    return errorResponse(e);
  }
}
