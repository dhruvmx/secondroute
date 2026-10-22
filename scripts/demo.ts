import { db } from "../lib/db";
import { action } from "../lib/service";
if (process.env.SECONDROUTE_MODE === "connected")
  throw new Error("Demo seed/reset commands cannot run in connected mode");
const command = process.argv[2];
if (command !== "seed" && command !== "reset")
  throw new Error("Usage: tsx scripts/demo.ts seed|reset");
const base = process.env.SECONDROUTE_DEMO_URL || "http://127.0.0.1:3000";
let live: Response | undefined;
try {
  live = await fetch(base + "/api/state", {
    headers: { "x-demo-role": "admin" },
    signal: AbortSignal.timeout(3000),
  });
} catch (error) {
  const code = (error as { cause?: { code?: string } }).cause?.code;
  if (code !== "ECONNREFUSED")
    throw new Error(
      "Cannot safely determine whether the server owns the database. Stop it and check local access before retrying. " +
        String(error),
    );
}
if (live) {
  if (!live.ok)
    throw new Error(
      "Running server refused demo initialization: " + live.status,
    );
  if (command === "reset") {
    const response = await fetch(base + "/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-role": "admin" },
      body: JSON.stringify({ action: "reset" }),
    });
    if (!response.ok) throw new Error(await response.text());
  }
} else {
  const database = await db();
  if (command === "reset") await action({ action: "reset" }, "admin");
  await database.close();
}
console.log(
  command === "reset"
    ? "Fictional demo records reset. Existing uploaded files remain on disk; no external files were deleted."
    : "Database initialized with fictional seed data if empty.",
);
