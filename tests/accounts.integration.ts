import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SECONDROUTE_TEST_URL || "http://127.0.0.1:3001";
class Client {
  cookie = "";
  async request(
    path: string,
    body?: unknown,
    extra: Record<string, string> = {},
  ) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(this.cookie ? { cookie: this.cookie } : {}),
        origin: base,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length)
      this.cookie = cookies.map((c) => c.split(";")[0]).join("; ");
    return response;
  }
  async json(
    path: string,
    body?: unknown,
    status = 200,
    extra: Record<string, string> = {},
  ) {
    const r = await this.request(path, body, extra);
    const data = await r.json();
    assert.equal(r.status, status, JSON.stringify(data));
    return data;
  }
  action(body: Record<string, unknown>, status = 200) {
    return this.json("/api/action", body, status);
  }
}
const guest = new Client(),
  a = new Client(),
  b = new Client();
const id = randomUUID().slice(0, 8),
  password = randomUUID() + "!aZ";
await guest.json("/api/account");
await guest.action({ action: "createEvent", name: "Blocked guest" }, 401);
await guest.json("/api/action", { action: "reset" }, 401, {
  "x-demo-role": "admin",
});
console.log(
  "PASS visitors cannot mutate sample records or gain access using role headers",
);
for (const [client, name] of [
  [a, "A"],
  [b, "B"],
] as const) {
  await client.json("/api/auth/sign-up/email", {
    name: "Workspace " + name,
    email: `review-${name.toLowerCase()}-${id}@example.test`,
    password,
  });
  assert.ok(client.cookie.includes("session_token"));
}
const accountA = await a.json("/api/account"),
  accountB = await b.json("/api/account");
await a.json("/api/action", null, 400);
assert.notEqual(accountA.orgId, accountB.orgId);
await Promise.all(
  Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b).json("/api/state")),
);
assert.equal((await a.json("/api/state")).events.length, 0);
assert.equal((await b.json("/api/state")).metrics.captured, 0);
console.log(
  "PASS account creation starts with separate empty workspaces and session cookies",
);
const event = await a.action({
  action: "createEvent",
  name: "Review event",
  location: "Bengaluru",
  date: "2026-10-22",
  latitude: 12.9756,
  longitude: 77.5929,
});
const zone = await a.action({
  action: "createZone",
  event_id: event.id,
  name: "Recovery point",
  latitude: 12.9757,
  longitude: 77.5928,
});
const partner = await a.action({
  action: "createPartner",
  name: "Review partner",
  materials: ["Cardboard"],
  capacity: 500,
});
await a.action(
  {
    action: "createEvent",
    name: "Invalid coordinates",
    latitude: 95,
    longitude: 77,
  },
  400,
);
const capture = {
  action: "capture",
  event_id: event.id,
  zone_id: zone.id,
  material: "Cardboard",
  weight: 25,
  quantity: 2,
  provenance: "measured",
  idempotency_key: randomUUID(),
  workspace_id: accountA.orgId,
};
const batch = await a.action(capture);
assert.equal((await a.action(capture)).duplicate, true);
await a.action({
  action: "assign",
  batch_id: batch.batch_id,
  partner_id: partner.id,
});
await a.action({ action: "collect", batch_id: batch.batch_id });
assert.equal((await a.json("/api/state")).metrics.recovered, 0);
const form = new FormData();
form.set(
  "file",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJZkAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "receipt.png",
);
const upload = await fetch(base + "/api/upload", {
  method: "POST",
  headers: { cookie: a.cookie, origin: base },
  body: form,
});
assert.equal(upload.status, 200);
const media = await upload.json();
await a.action({
  action: "receive",
  batch_id: batch.batch_id,
  accepted: 23,
  rejected: 2,
  evidence: media.id,
  notes: "Recipient receipt records two kilograms rejected",
});
await a.action({ action: "verify", batch_id: batch.batch_id }, 400);
await a.action({ action: "verify", batch_id: batch.batch_id, reviewed: true });
assert.equal((await a.json("/api/state")).metrics.recovered, 23);
const passport = await a.action({
  action: "passport",
  batch_id: batch.batch_id,
});
assert.equal(passport.ok, true);
console.log(
  "PASS event, zone, partner, capture retry, pickup, evidence, receipt, review and signed passport",
);
assert.equal((await b.json("/api/state")).batches.length, 0);
assert.equal((await b.json("/api/state?event=" + event.id)).zones.length, 0);
await b.action({ action: "collect", batch_id: batch.batch_id }, 404);
await b.action({ ...capture, idempotency_key: randomUUID() }, 403);
assert.equal((await b.request("/api/media/" + media.id)).status, 404);
const report = await b.request("/api/report?format=csv");
assert.equal(report.status, 200);
assert.ok(!(await report.text()).includes(batch.batch_id));
await a.json(
  "/api/action",
  { action: "createEvent", name: "Cross-origin" },
  403,
  { origin: "https://invalid.example" },
);
await a.action({ action: "reset" }, 403);
console.log(
  "PASS account isolation across reads, writes, uploads, exports, offline replay, CSRF and sample reset",
);
await a.json("/api/auth/sign-out", {});
await a.action({ action: "createEvent", name: "Signed out" }, 401);
await a.json("/api/auth/sign-in/email", {
  email: `review-a-${id}@example.test`,
  password,
});
await guest.json(
  "/api/auth/sign-in/email",
  {
    email: `review-a-${id}@example.test`,
    password: "Incorrect-password-value",
  },
  401,
);
assert.equal((await a.json("/api/state")).metrics.recovered, 23);
await a.json("/api/auth/update-user", { name: "Updated profile" });
assert.equal((await a.json("/api/account")).user.name, "Updated profile");
console.log("PASS logout, login, persistent workspace and profile updates");
console.log("Account integration checks complete. No external email was sent.");
