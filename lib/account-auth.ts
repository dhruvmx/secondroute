import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { Kysely, PGliteDialect } from "kysely";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { db, dataDir } from "./db";
import { ApiError } from "./auth";
import type { Role } from "./types";

export const mailConfigured = () =>
  !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_FROM &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  );
export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
async function sendMail(to: string, subject: string, url: string) {
  if (!mailConfigured())
    throw new ApiError("Outgoing email has not been configured", 503);
  const smtp = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await smtp.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: `${subject}\n\nContinue securely: ${url}\n\nIf you did not request this, ignore this email.`,
  });
}
async function createAuth() {
  const database = await db();
  await mkdir(dataDir(), { recursive: true });
  let secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    const filename = path.join(dataDir(), "auth-secret");
    try {
      secret = await readFile(filename, "utf8");
    } catch {
      const generated = randomBytes(48).toString("base64url");
      try {
        await writeFile(filename, generated, { flag: "wx", mode: 0o600 });
        secret = generated;
      } catch {
        secret = await readFile(filename, "utf8");
      }
    }
  }
  const options: BetterAuthOptions = {
    appName: "SecondRoute",
    secret,
    baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
    database: {
      db: new Kysely({ dialect: new PGliteDialect({ pglite: database }) }),
      type: "postgres",
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      ...(mailConfigured()
        ? {
            sendResetPassword: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => sendMail(user.email, "Reset your SecondRoute password", url),
          }
        : {}),
    },
    emailVerification: mailConfigured()
      ? {
          sendOnSignUp: true,
          sendVerificationEmail: async ({ user, url }) =>
            sendMail(user.email, "Verify your SecondRoute email", url),
        }
      : undefined,
    socialProviders: googleConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  };
  const migration = await getMigrations(options);
  await migration.runMigrations();
  return betterAuth(options);
}
const globalAuth = globalThis as unknown as {
  secondrouteAuth?: ReturnType<typeof createAuth>;
  authTail?: Promise<void>;
};
export const getAuth = () => (globalAuth.secondrouteAuth ??= createAuth());
// PGlite has one connection. Keep concurrent auth transactions from sharing it.
export async function withAuth<T>(
  operation: (auth: Awaited<ReturnType<typeof getAuth>>) => Promise<T>,
): Promise<T> {
  const previous = globalAuth.authTail || Promise.resolve();
  let release!: () => void;
  globalAuth.authTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation(await getAuth());
  } finally {
    release();
  }
}
export async function actorFor(request: Request, write = false) {
  const session = await withAuth((auth) =>
    auth.api.getSession({ headers: request.headers }),
  );
  if (!session) {
    if (write)
      throw new ApiError(
        "Create an account or sign in to save your own records",
        401,
      );
    return {
      orgId: "demo-org",
      role: "coordinator" as const,
      user: null,
      workspace: "Sample workspace",
    };
  }
  if (write) {
    const origin = request.headers.get("origin");
    if (!origin) {
      throw new ApiError("Missing request origin", 400);
    }
    const allowedOrigins = [
      new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000").origin,
      "http://localhost:3000",
    ];
    if (!allowedOrigins.includes(origin)) {
      throw new ApiError("Request origin is not allowed", 403);
    }
  }
  const d = await db();
  const membership = await d.transaction(async (tx) => {
    const found = await tx.query<{ org_id: string; name: string; role: Role }>(
      "SELECT m.org_id,o.name,m.role FROM memberships m JOIN organizations o ON m.org_id=o.id WHERE m.user_id=$1",
      [session.user.id],
    );
    if (found.rows[0]) return found.rows[0];
    const orgId = "workspace-" + session.user.id,
      name = session.user.name + "'s workspace";
    await tx.query(
      "INSERT INTO organizations(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [orgId, name],
    );
    await tx.query(
      "INSERT INTO memberships(id,org_id,user_id,role) VALUES($1,$2,$3,'admin') ON CONFLICT(user_id) DO NOTHING",
      ["member-" + session.user.id, orgId, session.user.id],
    );
    return { org_id: orgId, name, role: "admin" as const };
  });
  return {
    orgId: membership.org_id,
    role: membership.role,
    user: session.user,
    workspace: membership.name,
  };
}
