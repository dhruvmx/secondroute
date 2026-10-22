import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueue,
  readQueue,
  syncQueue,
  type PendingCapture,
} from "../app/offline";

test("desktop queue survives reload, retries identical payload, and removes only acknowledged captures", async () => {
  const values = new Map<string, string>();
  const events = new EventTarget();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: events,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: false },
  });
  const payload: PendingCapture = {
    action: "capture",
    idempotencyKey: "desktop-restart-test",
    eventId: "riverlight",
    zoneId: "north",
    material: "Cardboard",
    weight: 9,
    quantity: 3,
    provenance: "estimated",
    notes: "Fictional offline test",
    state: "pending",
  };
  enqueue(payload);
  assert.equal(readQueue()[0].weight, 9);
  await syncQueue();
  assert.equal(readQueue()[0].state, "pending");
  // A new read reconstructs state entirely from persistent browser storage.
  assert.equal(
    JSON.parse(values.get("secondroute.capture-queue.v1")!)[0].idempotencyKey,
    payload.idempotencyKey,
  );
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  const original = globalThis.fetch;
  const submitted: string[] = [];
  try {
    globalThis.fetch = async (_url, init) => {
      submitted.push(String(init?.body));
      throw Error("Network interrupted after possible server commit");
    };
    await syncQueue();
    assert.equal(readQueue()[0].state, "failed");
    globalThis.fetch = async (_url, init) => {
      submitted.push(String(init?.body));
      return Response.json({ ok: true, duplicate: true });
    };
    await syncQueue();
    assert.deepEqual(readQueue(), []);
    assert.equal(
      submitted[0],
      submitted[1],
      "Retries preserve identical idempotency payload despite UI sync/error state changes",
    );
  } finally {
    globalThis.fetch = original;
  }
});
