"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function ResetPassword() {
  const [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("token");
    const timer = setTimeout(() => setToken(t || ""), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main className="verify-shell">
      <section className="panel">
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <p>Your password has been updated.</p>
            <Link className="primary" href="/">
              Return to sign in
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              if (f.get("password") !== f.get("confirm")) {
                setError("Passwords must match");
                setBusy(false);
                return;
              }
              try {
                const r = await fetch("/api/auth/reset-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token,
                    newPassword: f.get("password"),
                  }),
                });
                const d = await r.json();
                if (!r.ok)
                  throw Error(
                    d.message || "This reset link is invalid or has expired",
                  );
                setDone(true);
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Open the link from your password reset email. Links expire after
              use or after one hour.
            </p>
            <label>
              New password
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            {error && (
              <p className="error-copy" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !token}>
              Update password
            </button>
            <Link href="/">Return to workspace</Link>
          </form>
        )}
      </section>
    </main>
  );
}
