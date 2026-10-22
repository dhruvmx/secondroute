"use client";
export interface PendingCapture {
  idempotencyKey: string;
  action: "capture";
  eventId: string;
  zoneId: string;
  material: string;
  weight: number;
  quantity: number;
  notes: string;
  provenance: string;
  evidence?: string;
  state: "pending" | "syncing" | "failed";
  error?: string;
}
const KEY = "secondroute.capture-queue.v1";
export function readQueue(): PendingCapture[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function writeQueue(queue: PendingCapture[]) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("queuechange"));
}
export function enqueue(record: PendingCapture) {
  writeQueue([...readQueue(), record]);
}
let syncing = false;
export async function syncQueue() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    for (const record of readQueue()) {
      writeQueue(
        readQueue().map((x) =>
          x.idempotencyKey === record.idempotencyKey
            ? { ...x, state: "syncing" }
            : x,
        ),
      );
      try {
        const response = await fetch("/api/action", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-demo-role": "worker",
          },
          body: JSON.stringify({
            ...record,
            state: undefined,
            error: undefined,
          }),
        });
        const body = await response.json();
        if (!response.ok) throw Error(body.error || "Sync failed");
        writeQueue(
          readQueue().filter((x) => x.idempotencyKey !== record.idempotencyKey),
        );
      } catch (error) {
        writeQueue(
          readQueue().map((x) =>
            x.idempotencyKey === record.idempotencyKey
              ? { ...x, state: "failed", error: String(error) }
              : x,
          ),
        );
      }
    }
  } finally {
    syncing = false;
  }
}
