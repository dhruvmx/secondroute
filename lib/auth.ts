import type { Role } from "./types";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function roleFor(request: Request): Role {
  if (process.env.SECONDROUTE_MODE === "connected")
    throw new ApiError(
      "Connected authentication is not configured. Demo role headers are disabled in connected mode.",
      503,
    );
  const role = request.headers.get("x-demo-role") || "coordinator";
  if (!["admin", "coordinator", "worker", "partner"].includes(role))
    throw new ApiError("Invalid demo role", 403);
  return role as Role;
}
export function allow(role: Role, roles: Role[]) {
  if (!roles.includes(role))
    throw new ApiError("This role cannot perform this action", 403);
}
export function errorResponse(error: unknown) {
  return Response.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    },
    { status: error instanceof ApiError ? error.status : 500 },
  );
}
