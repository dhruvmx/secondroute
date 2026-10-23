import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  statSync,
  readdirSync,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const origin = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready() {
  try {
    const r = await fetch(origin + "/api/health", {
      signal: AbortSignal.timeout(2000),
    });
    const d = await r.json();
    return r.ok && d.ok && d.service === "SecondRoute";
  } catch {
    return false;
  }
}
function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port: 3000 });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
function latestSource(directory) {
  if (!existsSync(directory)) return 0;
  const info = statSync(directory);
  if (!info.isDirectory()) return info.mtimeMs;
  return Math.max(
    info.mtimeMs,
    ...readdirSync(directory).map((name) =>
      latestSource(path.join(directory, name)),
    ),
  );
}
function runNpm(args) {
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (r.status !== 0)
    throw Error("npm " + args.join(" ") + " failed. Check the output above.");
}
function showBrowser() {
  console.log("SecondRoute is ready: " + origin);
  if (process.platform === "win32" && !process.argv.includes("--no-browser"))
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", origin], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
}
async function main() {
  if (await ready()) {
    showBrowser();
    return;
  }
  if (await portInUse()) {
    for (let n = 0; n < 5; n++) {
      if (await ready()) {
        showBrowser();
        return;
      }
      await sleep(1000);
    }
    throw Error(
      "Port 3000 is already in use, but SecondRoute is not ready. Close the older server and run this launcher again.",
    );
  }
  if (!existsSync("node_modules/next")) runNpm(["ci"]);
  const built = existsSync(".next/BUILD_ID")
    ? statSync(".next/BUILD_ID").mtimeMs
    : 0;
  const latest = Math.max(
    ...[
      "app",
      "lib",
      "public",
      "migrations",
      "next.config.ts",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
    ].map(latestSource),
  );
  if (!built || latest > built) runNpm(["run", "build"]);
  mkdirSync(".data", { recursive: true });
  const out = openSync(".data/server.out.log", "a"),
    err = openSync(".data/server.err.log", "a");
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3000",
    ],
    {
      cwd: root,
      detached: true,
      stdio: ["ignore", out, err],
      windowsHide: true,
    },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.unref();
  closeSync(out);
  closeSync(err);
  writeFileSync(".data/server.pid", String(child.pid));
  console.log(
    "Starting SecondRoute and checking database and account readiness...",
  );
  for (let n = 0; n < 30; n++) {
    if (await ready()) {
      showBrowser();
      return;
    }
    await sleep(1000);
  }
  throw Error(
    "SecondRoute did not become ready. See .data/server.err.log. Your saved records have not been reset.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
