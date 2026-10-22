// Independent verifier. Obtain issuer keys separately from the issuer's /api/keys endpoint.
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
const [passportPath, keysPath] = process.argv.slice(2);
if (!passportPath || !keysPath)
  throw new Error(
    "Usage: node tests/verify-passport.mjs passport.json trusted-keys.json",
  );
const envelope = JSON.parse(await readFile(passportPath, "utf8"));
const registry = JSON.parse(await readFile(keysPath, "utf8"));
const trusted =
  (registry.keys || []).find((k) => k.key_id === envelope.key_id) ||
  (registry.current?.key_id === envelope.key_id ? registry.current : null);
if (!trusted)
  throw new Error(
    "Unverifiable: issuer key is not in the separately supplied trusted registry",
  );
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
      .join(",") +
    "}"
  );
}
const bytes = new TextEncoder().encode(canonical(envelope.payload));
const digest = Buffer.from(
  await webcrypto.subtle.digest("SHA-256", bytes),
).toString("hex");
const key = await webcrypto.subtle.importKey(
  "jwk",
  trusted.public_key,
  { name: "Ed25519" },
  false,
  ["verify"],
);
const valid =
  digest === envelope.hash &&
  (await webcrypto.subtle.verify(
    "Ed25519",
    key,
    Buffer.from(envelope.signature, "base64"),
    bytes,
  ));
console.log(
  JSON.stringify(
    {
      valid,
      hash_matches: digest === envelope.hash,
      key_id: envelope.key_id,
      note: "Checks content and issuer signature. Check the live issuer for revocation and supersession. Does not establish physical truth.",
    },
    null,
    2,
  ),
);
if (!valid) process.exitCode = 1;
