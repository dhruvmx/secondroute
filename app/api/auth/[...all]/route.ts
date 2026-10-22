import { withAuth } from "@/lib/account-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withAuth((auth) => auth.handler(request));
}
export async function POST(request: Request) {
  return withAuth((auth) => auth.handler(request));
}
