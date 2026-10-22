"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  CheckCircle2,
  Route,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import QRCode from "qrcode";
type Envelope = {
  payload: Record<string, unknown>;
  signature: string;
  hash: string;
  key_id: string;
  status: string;
  algorithm: string;
};
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(obj[k]))
      .join(",") +
    "}"
  );
}
export default function Verifier({ id }: { id: string }) {
  const [record, setRecord] = useState<Envelope | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [qr, setQr] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    fetch("/api/passport/" + encodeURIComponent(id))
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw Error(data.error || "Passport unavailable");
        setRecord(data);
        setText(JSON.stringify(data, null, 2));
        setResult(data.status);
      })
      .catch((e) => setError(String(e)));
    void QRCode.toDataURL(window.location.href, {
      width: 130,
      margin: 1,
      color: { dark: "#294d38", light: "#fffefa" },
    }).then(setQr);
  }, [id]);
  async function verify() {
    setChecking(true);
    setError("");
    try {
      const envelope = JSON.parse(text) as Envelope;
      const response = await fetch("/api/keys");
      if (!response.ok) throw Error("Trusted key registry unavailable");
      const registry = await response.json();
      const keys = Array.isArray(registry) ? registry : registry.keys;
      const entry = keys.find(
        (k: { id?: string; key_id?: string }) =>
          (k.id || k.key_id) === envelope.key_id,
      );
      if (!entry) {
        setResult("unverifiable");
        return;
      }
      const key = await crypto.subtle.importKey(
        "jwk",
        entry.public_key,
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      const bytes = new TextEncoder().encode(canonical(envelope.payload));
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const signature = Uint8Array.from(
        atob(envelope.signature.replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      );
      const valid =
        digest === envelope.hash &&
        (await crypto.subtle.verify("Ed25519", key, signature, bytes));
      if (!valid) {
        setResult("modified");
        return;
      }
      const publication = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const status = await publication.json();
      setResult(status.status || "unverifiable");
    } catch (e) {
      setError(String(e));
      setResult("unverifiable");
    } finally {
      setChecking(false);
    }
  }
  return (
    <main className="verify-shell" style={{ width: "auto" }}>
      <Link className="brand" href="/">
        <span className="brand-mark">
          <Route size={27} />
        </span>
        SecondRoute<span className="brand-dot">.</span>
      </Link>
      <section className="panel">
        <span className="eyebrow">PUBLIC MATERIAL PASSPORT</span>
        <h1>A destination you can check.</h1>
        <p className="muted">
          Verify a published attestation independently in your browser.
        </p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {record && (
          <>
            <div className="info-strip">
              {result === "valid" ? (
                <CheckCircle2 size={24} />
              ) : (
                <XCircle size={24} />
              )}
              <div>
                <strong>Verification status: {result}</strong>
                <p>
                  {result === "valid"
                    ? "Published content matches its hash and Ed25519 signature."
                    : "Modified, superseded, revoked, and unverifiable records should not be treated as current valid attestations."}
                </p>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 25,
              }}
            >
              <dl>
                <dt>Batch</dt>
                <dd>{String(record.payload.batch_id)}</dd>
                <dt>Material</dt>
                <dd>{String(record.payload.material)}</dd>
                <dt>Event</dt>
                <dd>{String(record.payload.event)}</dd>
                <dt>Destination</dt>
                <dd>{String(record.payload.destination)}</dd>
                <dt>Accepted</dt>
                <dd>{String(record.payload.accepted_kg)} kg</dd>
                <dt>Rejected</dt>
                <dd>{String(record.payload.rejected_kg)} kg</dd>
                <dt>Revision</dt>
                <dd>{String(record.payload.revision)}</dd>
                <dt>Key ID</dt>
                <dd>{record.key_id}</dd>
              </dl>
              {qr && (
                <Image
                  unoptimized
                  src={qr}
                  width={130}
                  height={130}
                  alt="QR link to this public passport"
                  style={{ alignSelf: "center" }}
                />
              )}
            </div>
            <p className="form-hint">
              Edit an accepted quantity below and run verification. A changed
              quantity must fail. The verification key comes from the published
              registry, never from the submitted document.
            </p>
            <label htmlFor="passport-json" className="eyebrow">
              MACHINE-READABLE SIGNED RECORD
            </label>
            <textarea
              id="passport-json"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
            <button
              className="primary"
              onClick={() => void verify()}
              disabled={checking}
            >
              <ShieldCheck size={17} />
              {checking ? "Checking signature..." : "Verify hash & signature"}
            </button>
            <a className="secondary" href={`/api/passport/${id}?download=1`}>
              <ArrowDownToLine size={16} />
              Download JSON
            </a>
            <p style={{ marginTop: 24, fontSize: 11, color: "#93a085" }}>
              Signatures detect changes and prove an attestation. They do not
              establish physical truth or validate environmental methodology.
              Only deliberately public fields are included.
            </p>
          </>
        )}
      </section>
      <Link className="text-button" href="/" style={{ marginTop: 20 }}>
        <ArrowLeft size={15} />
        Back to operations
      </Link>
    </main>
  );
}
