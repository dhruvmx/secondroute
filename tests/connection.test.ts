import test from "node:test";
import assert from "node:assert/strict";
import { connectionMessage, requestJSON } from "../lib/connection";
test("connection failures explain local startup while account errors keep their meaning", async () => {
  const original = globalThis.fetch;
  try {
    assert.match(connectionMessage("127.0.0.1"), /Start-SecondRoute.cmd/);
    assert.doesNotMatch(
      connectionMessage("secondroute.example"),
      /local server/,
    );
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await assert.rejects(requestJSON("/api/state"), /server is unavailable/);
    globalThis.fetch = async () =>
      Response.json({ message: "Invalid email or password" }, { status: 401 });
    await assert.rejects(
      requestJSON("/api/auth/sign-in/email"),
      /Invalid email or password/,
    );
    globalThis.fetch = async () =>
      new Response("<html>Unavailable</html>", { status: 502 });
    await assert.rejects(requestJSON("/api/state"), /unreadable response/);
    globalThis.fetch = async () =>
      Response.json({ events: [{ id: "riverlight" }] });
    assert.deepEqual(await requestJSON("/api/state"), {
      events: [{ id: "riverlight" }],
    });
  } finally {
    globalThis.fetch = original;
  }
});
