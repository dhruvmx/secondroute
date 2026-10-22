import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
const base = process.env.SECONDROUTE_TEST_URL || "http://127.0.0.1:3000";
const checks: string[] = [];
const check = (name: string) => {
  checks.push(name);
  console.log("PASS " + name);
};
async function request(route: string, role = "coordinator", body?: unknown) {
  return fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      "x-demo-role": role,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function action(
  body: Record<string, unknown>,
  role = "coordinator",
  expected = 200,
) {
  const response = await request("/api/action", role, body);
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
async function state(event: string) {
  const response = await request("/api/state?event=" + event);
  assert.equal(response.status, 200);
  return response.json();
}
const event = await action(
  {
    action: "createEvent",
    name: "HTTP verification " + new Date().toISOString(),
    location: "Fictional test grounds",
    date: "2026-10-22",
  },
  "admin",
);
const zone = await action(
  { action: "createZone", event_id: event.id, name: "Evidence test zone" },
  "admin",
);
const captured = {
  action: "capture",
  event_id: event.id,
  zone_id: zone.id,
  material: "Cardboard",
  weight: 100,
  quantity: 20,
  provenance: "measured",
  notes: "Fictional HTTP verification capture",
  idempotency_key: randomUUID(),
};
const capture = await action(captured, "worker");
check("Worker capture persisted into compatible batch");
const duplicate = await action(captured, "worker");
assert.equal(duplicate.duplicate, true);
assert.equal((await state(event.id)).metrics.captured, 100);
check("Duplicate capture does not increase quantities");
const sessionA = await state(event.id);
const sessionB = await state(event.id);
assert.equal(sessionA.batches[0].id, sessionB.batches[0].id);
check("Two independent sessions observe persisted capture");
await action(
  { action: "assign", batch_id: capture.batch_id, partner_id: "paper-loop" },
  "worker",
  403,
);
check("Unauthorized worker dispatch rejected");
await action(
  { action: "assign", batch_id: capture.batch_id, partner_id: "metalworks" },
  "coordinator",
  409,
);
check("Incompatible recipient rejected");
await action({
  action: "assign",
  batch_id: capture.batch_id,
  partner_id: "paper-loop",
});
await action({ action: "collect", batch_id: capture.batch_id }, "worker");
check("Compatible dispatch and worker collection completed");
const invalid = new FormData();
invalid.append(
  "file",
  new File(["This is not an image"], "bad.png", { type: "image/png" }),
);
const rejected = await fetch(base + "/api/upload", {
  method: "POST",
  headers: { "x-demo-role": "partner" },
  body: invalid,
});
assert.equal(rejected.status, 400);
check("Invalid image upload rejected");
const pdf = await PDFDocument.create();
const page = pdf.addPage();
page.drawText("Fictional SecondRoute receipt: accepted 82 kg, rejected 18 kg.");
const evidence = new FormData();
evidence.append(
  "file",
  new File([Buffer.from(await pdf.save())], "fictional-receipt.pdf", {
    type: "application/pdf",
  }),
);
const uploaded = await fetch(base + "/api/upload", {
  method: "POST",
  headers: { "x-demo-role": "partner" },
  body: evidence,
});
assert.equal(uploaded.status, 200);
const media = await uploaded.json();
assert.ok(media.id);
check("Valid PDF evidence uploaded durably");
await action(
  {
    action: "receive",
    batch_id: capture.batch_id,
    accepted: 82,
    rejected: 18,
    evidence: media.id,
    notes: "18 kg contaminated cardboard rejected",
  },
  "worker",
  403,
);
await action(
  {
    action: "receive",
    batch_id: capture.batch_id,
    accepted: 82,
    rejected: 18,
    evidence: media.id,
    notes: "18 kg contaminated cardboard rejected",
  },
  "partner",
);
let current = await state(event.id);
assert.equal(current.metrics.recovered, 0);
assert.equal(current.metrics.rejected, 18);
assert.equal(current.metrics.received, 82);
check("Recipient discrepancy persists without counting unverified recovery");
await action({ action: "verify", batch_id: capture.batch_id, reviewed: true });
current = await state(event.id);
assert.equal(current.metrics.recovered, 82);
assert.equal(current.metrics.captured, 100);
assert.equal(current.metrics.rejected, 18);
check("Coordinator verification counts only accepted 82 kg");
const passport = await action({
  action: "passport",
  batch_id: capture.batch_id,
});
const publicResponse = await fetch(base + "/api/passport/" + capture.batch_id);
assert.equal(publicResponse.status, 200);
const publicPassport = await publicResponse.json();
assert.equal(publicPassport.status, "valid");
assert.equal(publicPassport.payload.accepted_kg, 82);
assert.equal(publicPassport.id, undefined);
assert.equal(publicPassport.payload.id, passport.id);
check("Public batch link resolves persisted signed passport");
const verification = await request(
  "/api/verify",
  "coordinator",
  publicPassport,
);
assert.equal((await verification.json()).valid, true);
const tampered = structuredClone(publicPassport);
tampered.payload.accepted_kg = 999;
const bad = await request("/api/verify", "coordinator", tampered);
assert.equal((await bad.json()).valid, false);
check("Trusted-key verification succeeds and altered quantity fails");
const query =
  "?event=" +
  event.id +
  "&zone=" +
  zone.id +
  "&status=Verified&search=Cardboard";
const csv = await request("/api/export" + query + "&format=csv");
assert.equal(csv.status, 200);
const csvText = await csv.text();
assert.ok(csvText.includes('"100","Verified","82","18","82"'));
assert.equal(csvText.split("\r\n").length, 2);
check("Filtered CSV exactly matches capture and receipt database totals");
const report = await request("/api/export" + query + "&format=pdf");
assert.equal(report.status, 200);
const reportBytes = Buffer.from(await report.arrayBuffer());
assert.equal(reportBytes.subarray(0, 5).toString(), "%PDF-");
const parsedPdf = await PDFDocument.load(reportBytes);
assert.ok(parsedPdf.getPageCount() > 0);
check("Filtered PDF report is a parseable document");
const mediaResponse = await request(media.url, "partner");
assert.equal(mediaResponse.status, 200);
assert.equal(mediaResponse.headers.get("content-type"), "application/pdf");
check("Uploaded receipt evidence can be retrieved");
const evidencePath = process.env.SECONDROUTE_HTTP_EVIDENCE;
if (evidencePath) {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        executed_at: new Date().toISOString(),
        base,
        event_id: event.id,
        batch_id: capture.batch_id,
        passport_id: passport.id,
        checks,
        total: checks.length,
        metrics: current.metrics,
      },
      null,
      2,
    ),
  );
}
console.log(
  JSON.stringify(
    {
      result: "passed",
      checks: checks.length,
      event_id: event.id,
      batch_id: capture.batch_id,
      passport_id: passport.id,
      metrics: current.metrics,
    },
    null,
    2,
  ),
);
