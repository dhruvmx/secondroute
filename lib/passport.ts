import {
  createHash,
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import type { webcrypto } from "node:crypto";
type JsonWebKey = webcrypto.JsonWebKey;
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db";
export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value as object)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonical((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
async function key() {
  await mkdir(dataDir(), { recursive: true });
  const filename = path.join(dataDir(), "signing-key.pem");
  let pem: string;
  try {
    pem = await readFile(filename, "utf8");
  } catch {
    const keys = generateKeyPairSync("ed25519");
    pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    try {
      await writeFile(filename, pem, { flag: "wx", mode: 0o600 });
    } catch {
      pem = await readFile(filename, "utf8");
    }
  }
  const privateKey = createPrivateKey(pem);
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" });
  const keyId = hash(jwk).slice(0, 20);
  return { privateKey, publicKey, jwk, keyId };
}
export async function signPassport(payload: unknown) {
  const k = await key();
  return {
    payload,
    hash: hash(payload),
    signature: sign(
      null,
      Buffer.from(canonical(payload)),
      k.privateKey,
    ).toString("base64"),
    key_id: k.keyId,
    algorithm: "Ed25519",
    public_key: k.jwk,
  };
}
export function verifyPassport(envelope: {
  payload: unknown;
  hash: string;
  signature: string;
  public_key: JsonWebKey;
}) {
  try {
    return (
      envelope.hash === hash(envelope.payload) &&
      verify(
        null,
        Buffer.from(canonical(envelope.payload)),
        createPublicKey({ key: envelope.public_key, format: "jwk" }),
        Buffer.from(envelope.signature, "base64"),
      )
    );
  } catch {
    return false;
  }
}
export async function publicKey() {
  const k = await key();
  return { key_id: k.keyId, algorithm: "Ed25519", public_key: k.jwk };
}
