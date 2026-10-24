import { randomUUID } from "node:crypto";
import { db, seed } from "./db";
import { ApiError, allow } from "./auth";
import { hash, signPassport } from "./passport";
import type {
  Role,
  Batch,
  State,
  Event,
  Zone,
  Partner,
  Capture,
  Custody,
} from "./types";
const materials = [
  "Cardboard",
  "Paper",
  "PET bottles",
  "Aluminum",
  "Reusable fixtures",
  "Signage",
  "Unknown",
];
const number = (x: unknown) => {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0 || n > 100000)
    throw new ApiError("Enter a positive weight below 100,000 kg");
  return n;
};
async function saveCoordinates(
  tx: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  table: "events" | "zones",
  id: string,
  input: Record<string, unknown>,
) {
  if (
    (input.latitude == null || input.latitude === "") &&
    (input.longitude == null || input.longitude === "")
  )
    return;
  const lat = Number(input.latitude),
    lon = Number(input.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    input.latitude === "" ||
    input.latitude == null ||
    input.longitude === "" ||
    input.longitude == null
  )
    throw new ApiError("Enter valid latitude and longitude coordinates");
  await tx.query(`UPDATE ${table} SET latitude=$1,longitude=$2 WHERE id=$3`, [
    lat,
    lon,
    id,
  ]);
}
const text = (x: unknown, max = 2000) =>
  String(x ?? "")
    .trim()
    .slice(0, max);
export async function state(
  event?: string | null,
  filters?: {
    zone?: string | null;
    status?: string | null;
    search?: string | null;
  },
  org = "demo-org",
): Promise<State> {
  const d = await db();
  const filter = event ? " AND event_id=$2" : "";
  const params = event ? [org, event] : [org];
  const [events, zones, partners, batches, captures, custody, passports] =
    await Promise.all([
      d.query<Event>(
        "SELECT id,name,location,date,status,latitude,longitude FROM events WHERE org_id=$1 ORDER BY date",
        [org],
      ),
      d.query<Zone>(
        "SELECT id,event_id,name,x,y,latitude,longitude FROM zones WHERE org_id=$1" +
          filter,
        params,
      ),
      d.query<Partner>(
        "SELECT id,name,materials,capacity,available,distance FROM partners WHERE org_id=$1 ORDER BY distance",
        [org],
      ),
      d.query<Batch>(
        "SELECT * FROM batches WHERE org_id=$1" +
          filter +
          " ORDER BY created_at DESC,id DESC",
        params,
      ),
      d.query<Capture>(
        "SELECT * FROM captures WHERE org_id=$1" +
          filter +
          " ORDER BY created_at DESC",
        params,
      ),
      d.query<Custody>(
        "SELECT c.* FROM custody_events c JOIN batches b ON c.batch_id=b.id WHERE c.org_id=$1" +
          (event ? " AND b.event_id=$2" : "") +
          " ORDER BY c.created_at DESC",
        params,
      ),
      d.query<{
        id: string;
        batch_id: string;
        revision: number;
        created_at: string;
        revoked: boolean;
      }>(
        "SELECT p.id,p.batch_id,p.revision,p.created_at,p.revoked FROM passports p JOIN batches b ON p.batch_id=b.id WHERE p.org_id=$1" +
          (event ? " AND b.event_id=$2" : "") +
          " ORDER BY p.created_at DESC",
        params,
      ),
    ]);
  const search = filters?.search?.trim().toLowerCase();
  const b = batches.rows.filter(
    (b) =>
      (!filters?.zone ||
        filters.zone === "all" ||
        b.zone_id === filters.zone) &&
      (!filters?.status ||
        filters.status === "all" ||
        b.status.toLowerCase() === filters.status.toLowerCase()) &&
      (!search ||
        [
          b.id,
          b.material,
          b.notes,
          zones.rows.find((z) => z.id === b.zone_id)?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)),
  );
  const captureRows = captures.rows.filter(
    (c) =>
      (!filters?.zone ||
        filters.zone === "all" ||
        c.zone_id === filters.zone) &&
      (!filters?.status ||
        filters.status === "all" ||
        b.some((v) => v.id === c.batch_id)) &&
      (!search ||
        (c.batch_id
          ? b.some((v) => v.id === c.batch_id)
          : [
              c.id,
              c.material,
              c.notes,
              zones.rows.find((z) => z.id === c.zone_id)?.name,
            ]
              .join(" ")
              .toLowerCase()
              .includes(search))),
  );
  const sum = (
    arr: Batch[],
    key: "weight" | "accepted" | "rejected" = "weight",
  ) => arr.reduce((a, v) => a + Number(v[key]), 0);
  return {
    events: events.rows,
    zones: zones.rows,
    partners: partners.rows,
    batches: b,
    captures: captureRows,
    custody: custody.rows.filter((c) => b.some((v) => v.id === c.batch_id)),
    passports: passports.rows.filter((p) => b.some((v) => v.id === p.batch_id)),
    mode: org === "demo-org" ? "sample" : "workspace",
    metrics: {
      captured: captureRows.reduce((a, v) => a + Number(v.weight), 0),
      awaiting: sum(b.filter((v) => ["Ready", "Assigned"].includes(v.status))),
      collected: sum(
        b.filter((v) =>
          ["Collected", "Received", "Verified", "Disputed"].includes(v.status),
        ),
      ),
      received: sum(
        b.filter((v) =>
          ["Received", "Verified", "Disputed"].includes(v.status),
        ),
        "accepted",
      ),
      recovered: sum(
        b.filter((v) => v.status === "Verified"),
        "accepted",
      ),
      rejected: sum(b, "rejected"),
      tasks: b.filter((v) =>
        ["Assigned", "Collected", "Received", "Disputed"].includes(v.status),
      ).length,
    },
  };
}
export async function action(
  input: Record<string, unknown>,
  role: Role,
  org = "demo-org",
): Promise<Record<string, unknown>> {
  const d = await db();
  const action = text(input.action);
  const id = text(input.batch_id || input.batchId || input.id);
  if (action === "reset") {
    allow(role, ["admin"]);
    if (
      org !== "demo-org" ||
      (await d.query("SELECT id FROM memberships LIMIT 1")).rows.length
    )
      throw new ApiError(
        "Sample reset is disabled when account workspaces exist",
        403,
      );
    await d.exec(
      "TRUNCATE audit_events,media,idempotency_records,passports,signing_keys,receipts,custody_events,captures,batches,partners,zones,events,memberships,organizations CASCADE",
    );
    await seed(d);
    return { ok: true };
  }
  return d.transaction(async (tx) => {
    const audit = async (
      batchId: string,
      verb: string,
      details: Record<string, unknown>,
    ) => {
      await tx.query(
        "INSERT INTO custody_events(id,org_id,batch_id,action,role,details) VALUES($1,$2,$3,$4,$5,$6)",
        [randomUUID(), org, batchId, verb, role, JSON.stringify(details)],
      );
      await tx.query(
        "INSERT INTO audit_events(id,org_id,role,action,details) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          org,
          role,
          verb,
          JSON.stringify({ batch_id: batchId, ...details }),
        ],
      );
    };
    if (action === "capture") {
      allow(role, ["admin", "coordinator", "worker"]);
      const key = text(
        input.idempotency_key ||
          input.idempotencyKey ||
          input.client_id ||
          input.clientId,
        120,
      );
      if (!key) throw new ApiError("An idempotency key is required");
      const requestHash = hash(input);
      const prev = await tx.query<{
        response: Record<string, unknown>;
        request_hash: string;
      }>("SELECT * FROM idempotency_records WHERE org_id=$1 AND key=$2", [
        org,
        key,
      ]);
      if (prev.rows[0]) {
        if (prev.rows[0].request_hash !== requestHash)
          throw new ApiError(
            "Idempotency key already used with a different capture",
            409,
          );
        return { ...prev.rows[0].response, duplicate: true };
      }
      const material = text(input.material, 80);
      if (!materials.includes(material))
        throw new ApiError("Select a supported material");
      const weight = number(input.weight);
      const eventId = text(input.event_id || input.eventId || "riverlight");
      const zoneId = text(input.zone_id || input.zoneId);
      const quantity = Number(input.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
        throw new ApiError("Quantity must be a positive whole number");
      const zone = await tx.query(
        "SELECT id FROM zones WHERE org_id=$1 AND event_id=$2 AND id=$3",
        [org, eventId, zoneId],
      );
      if (!zone.rows.length)
        throw new ApiError("Zone does not belong to this event", 403);
      const provenance = text(input.provenance || "estimated");
      if (!["estimated", "measured"].includes(provenance))
        throw new ApiError("Weight provenance must be estimated or measured");
      const evidence = text(input.evidence || input.media_id) || null;
      if (evidence) {
        const media = await tx.query(
          "SELECT id FROM media WHERE org_id=$1 AND id=$2",
          [org, evidence],
        );
        if (!media.rows.length)
          throw new ApiError("Evidence must be an uploaded file");
      }
      const contaminated = Boolean(input.contaminated);
      const notes = text(input.notes);
      let batchId: string | null = null;
      if (material !== "Unknown" && !contaminated) {
        const match = await tx.query<{ id: string }>(
          "SELECT id FROM batches WHERE org_id=$1 AND event_id=$2 AND zone_id=$3 AND material=$4 AND status=$5 ORDER BY created_at LIMIT 1 FOR UPDATE",
          [org, eventId, zoneId, material, "Ready"],
        );
        if (match.rows[0]) {
          batchId = match.rows[0].id;
          await tx.query(
            "UPDATE batches SET weight=weight+$1,updated_at=now(),revision=revision+1 WHERE id=$2",
            [weight, batchId],
          );
        } else {
          batchId = "SR-" + randomUUID().slice(0, 8).toUpperCase();
          await tx.query(
            "INSERT INTO batches(id,org_id,event_id,zone_id,material,weight,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
            [batchId, org, eventId, zoneId, material, weight, "Ready", notes],
          );
        }
      }
      const captureId = randomUUID();
      await tx.query(
        "INSERT INTO captures(id,org_id,event_id,zone_id,batch_id,material,weight,provenance,quantity,notes,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          captureId,
          org,
          eventId,
          zoneId,
          batchId,
          material,
          weight,
          provenance,
          quantity,
          notes,
          evidence,
        ],
      );
      if (batchId)
        await audit(batchId, "Captured", {
          capture_id: captureId,
          weight,
          provenance,
        });
      const response = {
        ok: true,
        capture_id: captureId,
        batch_id: batchId,
        review_required: !batchId,
        reason: batchId
          ? "Confirmed material and zone match an open compatible batch. Sealed batches are excluded."
          : "Unknown or contaminated material requires coordinator review.",
      };
      await tx.query(
        "INSERT INTO idempotency_records(org_id,key,request_hash,response) VALUES($1,$2,$3,$4)",
        [org, key, requestHash, JSON.stringify(response)],
      );
      return response;
    }
    if (action === "createEvent") {
      allow(role, ["admin"]);
      const eventId = randomUUID();
      if (!text(input.name)) throw new ApiError("Event name is required");
      await tx.query(
        "INSERT INTO events(id,org_id,name,location,date,status) VALUES($1,$2,$3,$4,$5,$6)",
        [
          eventId,
          org,
          text(input.name),
          text(input.location),
          text(input.date) || "2026-10-22",
          text(input.status) || "Planning",
        ],
      );
      await saveCoordinates(tx, "events", eventId, input);
      return { ok: true, id: eventId };
    }
    if (action === "updateEvent") {
      allow(role, ["admin"]);
      if (org === "demo-org")
        throw new ApiError("Sample events are read-only", 403);
      const eventId = text(input.id || input.eventId || input.event_id);
      if (!eventId) throw new ApiError("Event ID is required");
      const existing = await tx.query<Event>(
        "SELECT id,name,location,date,status FROM events WHERE org_id=$1 AND id=$2",
        [org, eventId],
      );
      if (!existing.rows.length) throw new ApiError("Event unavailable", 404);
      const name = text(input.name);
      if (!name) throw new ApiError("Event name is required");
      const location = text(input.location);
      const date = text(input.date) || existing.rows[0].date;
      const status = text(input.status) || existing.rows[0].status;
      await tx.query(
        "UPDATE events SET name=$1,location=$2,date=$3,status=$4 WHERE org_id=$5 AND id=$6",
        [name, location, date, status, org, eventId],
      );
      if (input.latitude !== undefined && input.longitude !== undefined) {
        if (
          (input.latitude === "" || input.latitude === null) &&
          (input.longitude === "" || input.longitude === null)
        ) {
          await tx.query(
            "UPDATE events SET latitude=NULL,longitude=NULL WHERE org_id=$1 AND id=$2",
            [org, eventId],
          );
        } else {
          await saveCoordinates(tx, "events", eventId, input);
        }
      }
      return { ok: true, id: eventId };
    }
    if (action === "deleteEvent") {
      allow(role, ["admin"]);
      if (org === "demo-org")
        throw new ApiError("Sample events are read-only", 403);
      const eventId = text(input.id || input.eventId || input.event_id);
      if (!eventId) throw new ApiError("Event ID is required");
      const existing = await tx.query<Event>(
        "SELECT id FROM events WHERE org_id=$1 AND id=$2",
        [org, eventId],
      );
      if (!existing.rows.length) throw new ApiError("Event unavailable", 404);

      const [batchCount, captureCount] = await Promise.all([
        tx.query<{ count: string }>(
          "SELECT COUNT(*) AS count FROM batches WHERE org_id=$1 AND event_id=$2",
          [org, eventId],
        ),
        tx.query<{ count: string }>(
          "SELECT COUNT(*) AS count FROM captures WHERE org_id=$1 AND event_id=$2",
          [org, eventId],
        ),
      ]);
      if (
        Number(batchCount.rows[0]?.count) > 0 ||
        Number(captureCount.rows[0]?.count) > 0
      ) {
        throw new ApiError(
          "Cannot delete event with existing batches or captures. Deletion is restricted to preserve recovery audit history.",
          409,
        );
      }

      await tx.query("DELETE FROM zones WHERE org_id=$1 AND event_id=$2", [
        org,
        eventId,
      ]);
      await tx.query("DELETE FROM events WHERE org_id=$1 AND id=$2", [
        org,
        eventId,
      ]);
      return { ok: true, id: eventId };
    }
    if (action === "createZone") {
      allow(role, ["admin"]);
      const eventId = text(input.event_id || input.eventId);
      const event = await tx.query(
        "SELECT id FROM events WHERE org_id=$1 AND id=$2",
        [org, eventId],
      );
      if (!event.rows.length) throw new ApiError("Event unavailable", 403);
      if (!text(input.name)) throw new ApiError("Zone name is required");
      const zoneId = randomUUID();
      await tx.query(
        "INSERT INTO zones(id,org_id,event_id,name,x,y) VALUES($1,$2,$3,$4,$5,$6)",
        [zoneId, org, eventId, text(input.name), 50, 50],
      );
      await saveCoordinates(tx, "zones", zoneId, input);
      return { ok: true, id: zoneId };
    }
    if (action === "setLocation") {
      allow(role, ["admin"]);
      if (input.zone_id && text(input.zone_id)) {
        const zoneId = text(input.zone_id);
        const z = await tx.query(
          "SELECT id FROM zones WHERE org_id=$1 AND id=$2",
          [org, zoneId],
        );
        if (!z.rows.length) throw new ApiError("Zone unavailable", 404);
        await saveCoordinates(tx, "zones", zoneId, input);
        return { ok: true };
      }
      const eventId = text(input.event_id);
      if (
        !(
          await tx.query("SELECT id FROM events WHERE org_id=$1 AND id=$2", [
            org,
            eventId,
          ])
        ).rows.length
      )
        throw new ApiError("Event unavailable", 404);
      await saveCoordinates(tx, "events", eventId, input);
      return { ok: true };
    }
    if (action === "createPartner") {
      allow(role, ["admin"]);
      const name = text(input.name, 100);
      const acceptedMaterials = Array.isArray(input.materials)
        ? input.materials.filter(
            (m) => materials.includes(String(m)) && m !== "Unknown",
          )
        : [];
      if (!name || !acceptedMaterials.length)
        throw new ApiError("Enter a partner name and accepted materials");
      const partnerId = randomUUID();
      await tx.query("INSERT INTO partners VALUES($1,$2,$3,$4,$5,true,0)", [
        partnerId,
        org,
        name,
        JSON.stringify(acceptedMaterials),
        number(input.capacity),
      ]);
      return { ok: true, id: partnerId };
    }
    if (action === "reviewCapture") {
      allow(role, ["admin", "coordinator"]);
      const captureId = text(input.capture_id || input.captureId);
      const material = text(input.material, 80);
      const notes = text(input.notes);
      if (!materials.includes(material) || material === "Unknown")
        throw new ApiError("Review requires a supported known material");
      if (!notes)
        throw new ApiError(
          "Explain material confirmation and contamination handling",
        );
      const captures = await tx.query<Capture>(
        "SELECT * FROM captures WHERE org_id=$1 AND id=$2 FOR UPDATE",
        [org, captureId],
      );
      const capture = captures.rows[0];
      if (!capture) throw new ApiError("Capture not found", 404);
      if (capture.batch_id)
        throw new ApiError(
          "Capture has already been reviewed and batched",
          409,
        );
      const match = await tx.query<{ id: string }>(
        "SELECT id FROM batches WHERE org_id=$1 AND event_id=$2 AND zone_id=$3 AND material=$4 AND status=$5 ORDER BY created_at LIMIT 1 FOR UPDATE",
        [org, capture.event_id, capture.zone_id, material, "Ready"],
      );
      let batchId = match.rows[0]?.id;
      if (batchId)
        await tx.query(
          "UPDATE batches SET weight=weight+$1,updated_at=now(),revision=revision+1 WHERE id=$2",
          [capture.weight, batchId],
        );
      else {
        batchId = "SR-" + randomUUID().slice(0, 8).toUpperCase();
        await tx.query(
          "INSERT INTO batches(id,org_id,event_id,zone_id,material,weight,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            batchId,
            org,
            capture.event_id,
            capture.zone_id,
            material,
            capture.weight,
            "Ready",
            "Created following coordinator capture review",
          ],
        );
      }
      await tx.query(
        "UPDATE captures SET material=$1,batch_id=$2 WHERE org_id=$3 AND id=$4",
        [material, batchId, org, captureId],
      );
      await audit(batchId, "Capture reviewed", {
        capture_id: captureId,
        original_material: capture.material,
        confirmed_material: material,
        weight: Number(capture.weight),
        notes,
      });
      return {
        ok: true,
        capture_id: captureId,
        batch_id: batchId,
        reason:
          "Existing capture confirmed and grouped once. Captured quantity is unchanged.",
      };
    }
    const rows = await tx.query<Batch>(
      "SELECT * FROM batches WHERE org_id=$1 AND id=$2 FOR UPDATE",
      [org, id],
    );
    const b = rows.rows[0];
    if (!b) throw new ApiError("Batch not found", 404);
    let next = b.status;
    if (action === "assign") {
      allow(role, ["admin", "coordinator"]);
      if (!["Ready", "Failed"].includes(b.status))
        throw new ApiError("Only ready or failed batches can be assigned", 409);
      const partnerId = text(input.partner_id || input.partnerId);
      const partners = await tx.query<Partner>(
        "SELECT * FROM partners WHERE id=$1 AND org_id=$2 FOR UPDATE",
        [partnerId, org],
      );
      const p = partners.rows[0];
      if (!p || !p.available || !p.materials.includes(b.material))
        throw new ApiError(
          "Partner unavailable or incompatible with this material",
          409,
        );
      const used = await tx.query<{ weight: number }>(
        "SELECT COALESCE(sum(weight),0) AS weight FROM batches WHERE org_id=$1 AND partner_id=$2 AND status IN ('Assigned','Collected')",
        [org, partnerId],
      );
      if (Number(used.rows[0].weight) + Number(b.weight) > Number(p.capacity))
        throw new ApiError("Partner capacity exceeded", 409);
      await tx.query("UPDATE batches SET partner_id=$1 WHERE id=$2", [
        partnerId,
        id,
      ]);
      next = "Assigned";
      await audit(id, "Assigned", {
        partner_id: partnerId,
        reason:
          "Material compatibility and remaining capacity checked. Any recorded distance is a reference, not road routing.",
        distance_km: p.distance,
      });
    } else if (action === "collect") {
      allow(role, ["admin", "coordinator", "worker"]);
      if (b.status !== "Assigned")
        throw new ApiError("Collection requires an assigned batch", 409);
      next = "Collected";
      await audit(id, "Collected", {
        notes: text(input.notes),
        claimed_weight: b.weight,
      });
    } else if (action === "receive") {
      allow(role, ["partner", "admin"]);
      if (b.status !== "Collected")
        throw new ApiError("Receipt requires a collected batch", 409);
      const accepted = Number(input.accepted ?? input.accepted_weight);
      const rejected = Number(input.rejected ?? input.rejected_weight);
      if (
        !Number.isFinite(accepted) ||
        !Number.isFinite(rejected) ||
        accepted < 0 ||
        rejected < 0 ||
        accepted + rejected <= 0 ||
        accepted + rejected > Number(b.weight)
      )
        throw new ApiError(
          "Accepted and rejected weights must be nonnegative and total no more than collected weight",
        );
      const evidence = text(input.evidence || input.media_id);
      const media = await tx.query(
        "SELECT id FROM media WHERE org_id=$1 AND id=$2",
        [org, evidence],
      );
      if (!media.rows.length)
        throw new ApiError("Upload receipt evidence before receiving");
      const notes = text(input.notes);
      if ((rejected > 0 || accepted + rejected < Number(b.weight)) && !notes)
        throw new ApiError("Explain rejection or missing quantity");
      await tx.query(
        "INSERT INTO receipts(id,org_id,batch_id,accepted,rejected,evidence,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [randomUUID(), org, id, accepted, rejected, evidence, notes],
      );
      await tx.query(
        "UPDATE batches SET accepted=$1,rejected=$2,evidence=$3,notes=$4 WHERE id=$5",
        [accepted, rejected, evidence, notes, id],
      );
      next = "Received";
      await audit(id, "Received", {
        accepted,
        rejected,
        missing: Number(b.weight) - accepted - rejected,
        evidence,
        notes,
      });
    } else if (action === "verify") {
      allow(role, ["admin", "coordinator"]);
      if (b.status !== "Received")
        throw new ApiError("Verification requires a recipient receipt", 409);
      if (!b.evidence) throw new ApiError("Receipt evidence is missing", 409);
      if (input.reviewed !== true)
        throw new ApiError(
          "Explicit receipt and discrepancy review is required before verification",
        );
      const receipt = await tx.query(
        "SELECT id FROM receipts WHERE org_id=$1 AND batch_id=$2",
        [org, id],
      );
      if (!receipt.rows.length)
        throw new ApiError("Recipient receipt is missing", 409);
      next = "Verified";
      await audit(id, "Verified", {
        accepted: b.accepted,
        rejected: b.rejected,
        reviewer_attestation:
          "Receipt and discrepancy reviewed; signature does not establish physical truth.",
      });
    } else if (action === "resolveDispute") {
      allow(role, ["admin", "coordinator"]);
      if (b.status !== "Disputed")
        throw new ApiError("Only disputed batches can be resolved", 409);
      if (!text(input.notes))
        throw new ApiError("Document how the dispute was resolved");
      const receipt = await tx.query(
        "SELECT id FROM receipts WHERE org_id=$1 AND batch_id=$2",
        [org, id],
      );
      if (!receipt.rows.length || !b.evidence)
        throw new ApiError(
          "Resolving to received requires a recipient receipt and evidence",
          409,
        );
      next = "Received";
      await audit(id, "Dispute resolved", {
        notes: text(input.notes),
        resolution: "Returned to received for explicit coordinator review",
      });
    } else if (
      action === "cancel" ||
      action === "fail" ||
      action === "dispute"
    ) {
      allow(role, ["admin", "coordinator"]);
      if (b.status === "Verified" || b.status === "Cancelled")
        throw new ApiError("Final batch cannot transition", 409);
      if (!text(input.notes)) throw new ApiError("A reason is required");
      next =
        action === "cancel"
          ? "Cancelled"
          : action === "fail"
            ? "Failed"
            : "Disputed";
      await audit(id, next, { notes: text(input.notes) });
    } else if (action === "revokePassport") {
      allow(role, ["admin", "coordinator"]);
      const passportId = text(input.passport_id);
      if (!text(input.notes))
        throw new ApiError("A revocation reason is required");
      const revoked = await tx.query(
        "UPDATE passports SET revoked=true WHERE org_id=$1 AND batch_id=$2 AND id=$3 RETURNING id",
        [org, id, passportId],
      );
      if (!revoked.rows.length) throw new ApiError("Passport not found", 404);
      await audit(id, "Passport revoked", {
        passport_id: passportId,
        reason: text(input.notes),
      });
      return { ok: true, id: passportId, status: "revoked" };
    } else if (action === "passport") {
      allow(role, ["admin", "coordinator"]);
      if (b.status !== "Verified")
        throw new ApiError(
          "Passport requires verified recipient recovery",
          409,
        );
      const timeline = await tx.query<{
        action: string;
        role: string;
        details: Record<string, unknown>;
        created_at: string;
      }>(
        "SELECT action,role,details,created_at FROM custody_events WHERE org_id=$1 AND batch_id=$2 ORDER BY created_at",
        [org, id],
      );
      const publicTimeline = timeline.rows.map((entry) => {
        const details: Record<string, unknown> = {};
        for (const field of [
          "weight",
          "claimed_weight",
          "accepted",
          "rejected",
          "missing",
        ])
          if (typeof entry.details[field] === "number")
            details[field] = entry.details[field];
        if (entry.action === "Verified")
          details.attestation =
            "Coordinator reviewed the recipient receipt and discrepancy. This is an attestation, not proof of physical truth.";
        return {
          action: entry.action,
          role: entry.role,
          details,
          created_at: entry.created_at,
        };
      });
      const zone = await tx.query<{ name: string }>(
        "SELECT name FROM zones WHERE id=$1",
        [b.zone_id],
      );
      const event = await tx.query<{ name: string }>(
        "SELECT name FROM events WHERE id=$1",
        [b.event_id],
      );
      const partner = await tx.query<{ name: string }>(
        "SELECT name FROM partners WHERE id=$1",
        [b.partner_id],
      );
      const passportId = randomUUID();
      const existing = await tx.query<{ revision: number }>(
        "SELECT revision FROM passports WHERE batch_id=$1 ORDER BY revision DESC LIMIT 1",
        [id],
      );
      const revision = (existing.rows[0]?.revision || 0) + 1;
      const capture = await tx.query(
        "SELECT weight,provenance FROM captures WHERE org_id=$1 AND batch_id=$2",
        [org, id],
      );
      const payload = {
        public_schema_version: "secondroute.public.v1",
        id: passportId,
        batch_id: id,
        event: event.rows[0].name,
        material: b.material,
        claimed_kg: Number(b.weight),
        accepted_kg: Number(b.accepted),
        rejected_kg: Number(b.rejected),
        missing_kg: Number(b.weight) - Number(b.accepted) - Number(b.rejected),
        weight_provenance: capture.rows,
        source_zone: zone.rows[0].name,
        destination: partner.rows[0]?.name,
        receipt_evidence: b.evidence,
        custody: publicTimeline,
        revision,
        created_at: new Date().toISOString(),
        method:
          "Recipient measured accepted weight; coordinator attestation. No emissions estimate.",
        statement:
          "Signatures detect changes and prove an attestation, not physical truth.",
      };
      const envelope = await signPassport(payload);
      await tx.query(
        "INSERT INTO signing_keys(id,public_key) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [envelope.key_id, JSON.stringify(envelope.public_key)],
      );
      await tx.query(
        "INSERT INTO passports(id,org_id,batch_id,revision,payload,hash,signature,key_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          passportId,
          org,
          id,
          revision,
          JSON.stringify(payload),
          envelope.hash,
          envelope.signature,
          envelope.key_id,
        ],
      );
      return {
        ok: true,
        id: passportId,
        ...envelope,
        url: "/verify/" + passportId,
      };
    } else throw new ApiError("Unknown action");
    await tx.query(
      "UPDATE batches SET status=$1,updated_at=now(),revision=revision+1 WHERE id=$2",
      [next, id],
    );
    return { ok: true, batch_id: id, status: next };
  });
}
