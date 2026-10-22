import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
test("project text respects the no em dash requirement", async () => {
  const ignored = new Set(["node_modules", ".next", ".data", ".git"]);
  const violations: string[] = [];
  async function scan(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.name.startsWith(".test-data-"))
        continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await scan(filename);
      else if (
        /\.(ts|tsx|js|mjs|md|json|css|sql|yml|ps1|example)$/.test(filename)
      ) {
        if (
          (await readFile(filename, "utf8")).includes(
            String.fromCodePoint(0x2014),
          )
        )
          violations.push(path.relative(process.cwd(), filename));
      }
    }
  }
  await scan(process.cwd());
  assert.deepEqual(violations, []);
});
