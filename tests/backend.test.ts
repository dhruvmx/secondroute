import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { action, state } from "../lib/service";
import { db } from "../lib/db";
import { verifyPassport, canonical } from "../lib/passport";
import { roleFor } from "../lib/auth";
import { spawnSync } from "node:child_process";
test("transactional recovery lifecycle, duplicates, permissions and passport tampering", async () => {
  // Workspace paths remain accessible to the restart subprocess in restricted Windows sandboxes.
  process.env.SECONDROUTE_DATA_DIR = await mkdtemp(
    path.join(process.cwd(), ".test-data-"),
  );
  const before = await state("riverlight");
  const capture = {
    action: "capture",
    event_id: "riverlight",
    zone_id: "north",
    material: "Cardboard",
    weight: 20,
    quantity: 4,
    provenance: "measured",
    idempotency_key: "test-stable-id",
  };
  const result = await action(capture, "worker");
  const again = await action(capture, "worker");
  assert.equal(again.duplicate, true);
  assert.equal(result.batch_id, again.batch_id);
  assert.equal(
    (await state("riverlight")).metrics.captured,
    before.metrics.captured + 20,
  );
  await assert.rejects(
    action({ ...capture, weight: 21 }, "worker"),
    /different capture/,
  );
  await assert.rejects(
    action(
      { action: "assign", batch_id: result.batch_id, partner_id: "paper-loop" },
      "worker",
    ),
    /role/,
  );
  await assert.rejects(
    action(
      { action: "assign", batch_id: result.batch_id, partner_id: "metalworks" },
      "coordinator",
    ),
    /incompatible/,
  );
  await action(
    { action: "assign", batch_id: result.batch_id, partner_id: "paper-loop" },
    "coordinator",
  );
  await assert.rejects(
    action(
      { action: "assign", batch_id: result.batch_id, partner_id: "paper-loop" },
      "coordinator",
    ),
    /Only ready/,
  );
  await action({ action: "collect", batch_id: result.batch_id }, "worker");
  const late = await action(
    { ...capture, idempotency_key: "late-capture" },
    "worker",
  );
  assert.notEqual(late.batch_id, result.batch_id);
  const d = await db();
  const evidence = "test-evidence";
  await d.query("INSERT INTO media(id,org_id,mime,path) VALUES($1,$2,$3,$4)", [
    evidence,
    "demo-org",
    "image/png",
    "test-only",
  ]);
  await assert.rejects(
    action(
      {
        action: "receive",
        batch_id: result.batch_id,
        accepted: 140,
        rejected: 8,
        evidence,
        notes: "Wet cardboard rejected",
      },
      "worker",
    ),
    /role/,
  );
  await action(
    {
      action: "receive",
      batch_id: result.batch_id,
      accepted: 140,
      rejected: 8,
      evidence,
      notes: "Wet cardboard rejected",
    },
    "partner",
  );
  const received = await state("riverlight");
  assert.equal(received.metrics.recovered, before.metrics.recovered);
  await assert.rejects(
    action({ action: "verify", batch_id: result.batch_id }, "coordinator"),
    /Explicit receipt/,
  );
  await action(
    {
      action: "dispute",
      batch_id: result.batch_id,
      notes: "Private discrepancy notes",
    },
    "coordinator",
  );
  await assert.rejects(
    action(
      {
        action: "resolveDispute",
        batch_id: result.batch_id,
        notes: "Reviewed",
      },
      "worker",
    ),
    /role/,
  );
  await action(
    {
      action: "resolveDispute",
      batch_id: result.batch_id,
      notes: "Private recipient conversation confirms rejected quantity",
    },
    "coordinator",
  );
  await action(
    { action: "verify", batch_id: result.batch_id, reviewed: true },
    "coordinator",
  );
  assert.equal(
    (await state("riverlight")).metrics.recovered,
    before.metrics.recovered + 140,
  );
  await assert.rejects(
    action({ action: "verify", batch_id: result.batch_id }, "coordinator"),
    /requires a recipient receipt/,
  );
  const passport = await action(
    { action: "passport", batch_id: result.batch_id },
    "coordinator",
  );
  assert.equal(verifyPassport(passport as never), true);
  const publicText = JSON.stringify(passport.payload);
  assert.equal(publicText.includes("Private"), false);
  assert.equal(publicText.includes("Wet cardboard rejected"), false);
  assert.equal(publicText.includes("capture_id"), false);
  assert.equal(publicText.includes('"notes"'), false);
  assert.equal(
    verifyPassport(JSON.parse(JSON.stringify(passport))),
    true,
    "Passport must remain valid after JSON serialization and database storage",
  );
  const tampered = structuredClone(passport);
  (tampered.payload as Record<string, unknown>).accepted_kg = 999;
  assert.equal(verifyPassport(tampered as never), false);
  const unknown = await action(
    { ...capture, material: "Unknown", idempotency_key: "unknown" },
    "worker",
  );
  assert.equal(unknown.review_required, true);
  assert.equal(unknown.batch_id, null);
  const beforeReview = (await state("riverlight")).metrics.captured;
  await assert.rejects(
    action(
      {
        action: "reviewCapture",
        captureId: unknown.capture_id,
        material: "Cardboard",
        notes: "Confirmed clean cardboard",
      },
      "worker",
    ),
    /role/,
  );
  await assert.rejects(
    action(
      {
        action: "reviewCapture",
        captureId: unknown.capture_id,
        material: "Unknown",
        notes: "Still uncertain",
      },
      "coordinator",
    ),
    /known material/,
  );
  await assert.rejects(
    action(
      {
        action: "reviewCapture",
        captureId: unknown.capture_id,
        material: "Cardboard",
      },
      "coordinator",
    ),
    /Explain/,
  );
  const reviewedCapture = await action(
    {
      action: "reviewCapture",
      captureId: unknown.capture_id,
      material: "Cardboard",
      notes: "Confirmed clean cardboard; contamination inspected and excluded",
    },
    "coordinator",
  );
  assert.ok(reviewedCapture.batch_id);
  assert.equal((await state("riverlight")).metrics.captured, beforeReview);
  await assert.rejects(
    action(
      {
        action: "reviewCapture",
        captureId: unknown.capture_id,
        material: "Cardboard",
        notes: "Repeat review",
      },
      "coordinator",
    ),
    /already been reviewed/,
  );
  await assert.rejects(
    action(
      { ...capture, zone_id: "hall", idempotency_key: "cross-event" },
      "worker",
    ),
    /Zone does not belong/,
  );
  await assert.rejects(
    action(
      { action: "cancel", batch_id: result.batch_id, notes: "cancel" },
      "coordinator",
    ),
    /Final batch/,
  );
  const concurrent = await Promise.all([
    action({ ...capture, idempotency_key: "concurrent" }, "worker"),
    action({ ...capture, idempotency_key: "concurrent" }, "worker"),
  ]);
  assert.equal(concurrent.filter((x) => x.duplicate).length, 1);
  const oversized = await action(
    {
      ...capture,
      weight: 601,
      zone_id: "food",
      idempotency_key: "capacity-case",
    },
    "worker",
  );
  await assert.rejects(
    action(
      {
        action: "assign",
        batch_id: oversized.batch_id,
        partner_id: "paper-loop",
      },
      "coordinator",
    ),
    /capacity/,
  );
  const filtered = await state("riverlight", {
    zone: "north",
    status: "Verified",
  });
  assert.equal(filtered.batches.length, 1);
  assert.equal(filtered.metrics.recovered, 140);
  assert.equal(filtered.metrics.rejected, 8);
  await assert.rejects(
    d.query("UPDATE custody_events SET action=$1 WHERE batch_id=$2", [
      "tamper",
      result.batch_id,
    ]),
    /append-only/,
  );
  const revision = await action(
    { action: "passport", batch_id: result.batch_id },
    "coordinator",
  );
  assert.equal((revision.payload as Record<string, unknown>).revision, 2);
  await action(
    {
      action: "revokePassport",
      batch_id: result.batch_id,
      passport_id: revision.id,
      notes: "Test revocation",
    },
    "coordinator",
  );
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
  await action(
    {
      ...capture,
      material: "Unknown",
      weight: 7.5,
      idempotency_key: "export-review-quantity",
    },
    "worker",
  );
  const { GET: exportReport } = await import("../app/api/report/route");
  const csvResponse = await exportReport(
    new Request("http://localhost/api/report?event=riverlight&format=csv"),
  );
  const exported = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.match(exported, /"Unknown"/);
  assert.match(exported, /"Review required"/);
  const exportedWeight = exported
    .split("\r\n")
    .slice(1)
    .reduce(
      (total, line) => total + Number([...line.matchAll(/"([^"]*)"/g)][3][1]),
      0,
    );
  assert.equal(
    exportedWeight,
    (await state("riverlight")).metrics.captured,
    "CSV includes unbatched review captures in captured quantity",
  );
  await action(
    {
      action: "setLocation",
      event_id: "riverlight",
      latitude: 12.9812,
      longitude: 77.6015,
    },
    "admin",
  );
  await action(
    {
      action: "setLocation",
      zone_id: "north",
      latitude: 12.9815,
      longitude: 77.6019,
    },
    "admin",
  );
  const updatedState = await state("riverlight");
  const updatedEvent = updatedState.events.find((e) => e.id === "riverlight");
  assert.equal(updatedEvent?.latitude, 12.9812);
  assert.equal(updatedEvent?.longitude, 77.6015);
  const updatedNorth = updatedState.zones.find((z) => z.id === "north");
  assert.equal(updatedNorth?.latitude, 12.9815);
  assert.equal(updatedNorth?.longitude, 77.6019);
  process.env.SECONDROUTE_MODE = "connected";
  assert.throws(
    () =>
      roleFor(
        new Request("http://localhost/api/state", {
          headers: { "x-demo-role": "admin" },
        }),
      ),
    /disabled/,
  );
  delete process.env.SECONDROUTE_MODE;
  await d.close();
  const reopened = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {PGlite} from '@electric-sql/pglite';const d=new PGlite(process.env.SECONDROUTE_DATA_DIR+'/postgres');const r=await d.query('SELECT weight FROM batches WHERE id=$1',[process.env.TEST_BATCH_ID]);console.log(r.rows[0].weight);await d.close();`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, TEST_BATCH_ID: String(result.batch_id) },
      encoding: "utf8",
    },
  );
  assert.equal(reopened.status, 0, reopened.stderr);
  assert.equal(Number(reopened.stdout.trim()), 148);
});
