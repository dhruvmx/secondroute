import { roleFor, errorResponse, ApiError } from "../../../lib/auth";
import { action } from "../../../lib/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 100000)
      throw new ApiError("Request too large", 413);
    const role = roleFor(request);
    const input = await request.json();
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.action !== "string"
    )
      throw new ApiError("Expected an action object");
    return Response.json(await action(input, role));
  } catch (e) {
    return errorResponse(e);
  }
}
