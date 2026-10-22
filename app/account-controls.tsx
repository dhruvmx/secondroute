"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useId,
  useState,
  type ReactNode,
} from "react";
import { Bell, LogOut, Moon, Settings2, UserRound, X } from "lucide-react";
import type { State, Role } from "@/lib/types";

type Account = {
  role?: Role;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  } | null;
  workspace?: string;
  orgId?: string;
  google: boolean;
  mail: boolean;
};
const Context = createContext<{
  account: Account;
  ready: boolean;
  refresh: () => Promise<void>;
  signIn: () => void;
}>({
  account: { user: null, google: false, mail: false },
  ready: false,
  refresh: async () => {},
  signIn: () => {},
});
export const useAccount = () => useContext(Context);
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`account-dialog ${className}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="account-dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>({
    user: null,
    google: false,
    mail: false,
  });
  const [ready, setReady] = useState(false),
    [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/account", { cache: "no-store" });
      if (!r.ok) throw Error("Account service unavailable");
      const data = await r.json();
      setAccount(data);
      localStorage.setItem("secondroute.account.v1", JSON.stringify(data));
    } catch (error) {
      // Cached identity only unlocks local drafts. Every server operation still checks its cookie session.
      try {
        const cached = JSON.parse(
          localStorage.getItem("secondroute.account.v1") || "null",
        );
        if (cached?.user?.id && cached.orgId) setAccount(cached);
      } catch {}
      throw error;
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh().catch(() => {}), 0);
    return () => clearTimeout(initial);
  }, [refresh]);
  return (
    <Context value={{ account, ready, refresh, signIn: () => setOpen(true) }}>
      {children}
      {open && <SignIn onClose={() => setOpen(false)} />}
    </Context>
  );
}
async function authRequest(path: string, body: Record<string, unknown>) {
  const r = await fetch("/api/auth/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw Error(data.message || data.error || "Unable to complete request");
  return data;
}
function SignIn({ onClose }: { onClose: () => void }) {
  const { account, refresh } = useAccount();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signup");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <Modal
      title={
        mode === "signup"
          ? "Your materials. Your workspace."
          : mode === "reset"
            ? "Reset your password"
            : "Welcome back"
      }
      onClose={onClose}
    >
      <p className="form-hint">
        Create a free account with your email address, including Gmail. Your
        workspace starts empty and stays separate from sample records.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            if (mode === "reset") {
              if (!account.mail)
                throw Error(
                  "Password reset email is not configured on this installation. Contact the workspace operator.",
                );
              await authRequest("request-password-reset", {
                email: f.get("email"),
                redirectTo: location.origin + "/reset-password",
              });
              setNotice(
                "If this email has an account, a reset link has been sent.",
              );
            } else {
              await authRequest(
                mode === "signup" ? "sign-up/email" : "sign-in/email",
                {
                  email: f.get("email"),
                  password: f.get("password"),
                  name: f.get("name"),
                  callbackURL: "/",
                },
              );
              await refresh();
              onClose();
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to sign in");
          } finally {
            setBusy(false);
          }
        }}
      >
        {mode === "signup" && (
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={80} required />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={12}
              maxLength={128}
              required
            />
            <small>At least 12 characters</small>
          </label>
        )}
        {error && (
          <p role="alert" className="error-copy">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button disabled={busy} className="primary">
          {busy
            ? "Please wait..."
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>
      {account.google && (
        <button
          className="google-signin"
          onClick={async () => {
            try {
              const d = await authRequest("sign-in/social", {
                provider: "google",
                callbackURL: location.origin + "/",
              });
              if (d.url) location.assign(d.url);
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Continue with Google
        </button>
      )}
      <div className="account-links">
        <button
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError("");
            setNotice("");
          }}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "Create an account"}
        </button>
        {mode === "signin" && (
          <button onClick={() => setMode("reset")}>Forgot password?</button>
        )}
      </div>
    </Modal>
  );
}
export function ProfileButton({
  sidebar = false,
  onSettings,
  onAppearance,
}: {
  sidebar?: boolean;
  onSettings: () => void;
  onAppearance: () => void;
}) {
  const { account, signIn } = useAccount();
  const [open, setOpen] = useState(false);
  const user = account.user;
  const initials = user
    ? user.name
        .split(" ")
        .map((x) => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "SR";
  return (
    <>
      <button
        className={
          sidebar ? "profile profile-button" : "small-avatar profile-button"
        }
        aria-label={sidebar ? "Workspace profile menu" : "Profile menu"}
        onClick={() => setOpen(true)}
      >
        <span className={sidebar ? "avatar" : ""}>{initials}</span>
        {sidebar && (
          <div>
            <strong>{user?.name || "Your workspace awaits"}</strong>
            <small>{user?.email || "Create your free account"}</small>
          </div>
        )}
      </button>
      {open && (
        <Modal
          className="profile-popover"
          title={user?.name || "Make it your workspace"}
          onClose={() => setOpen(false)}
        >
          <p className="form-hint">
            {user?.email ||
              "Save your own recovery records with a free account."}
          </p>
          <div className="profile-options">
            {!user && (
              <button
                onClick={() => {
                  setOpen(false);
                  signIn();
                }}
              >
                <UserRound size={18} />
                Create account / Sign in
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
            >
              <Settings2 size={18} />
              Settings
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onAppearance();
              }}
            >
              <Moon size={18} />
              Appearance
            </button>
            {user && (
              <button
                onClick={async () => {
                  await authRequest("sign-out", {});
                  localStorage.removeItem("secondroute.state." + user.id);
                  localStorage.removeItem("secondroute.account.v1");
                  location.reload();
                }}
              >
                <LogOut size={18} />
                Log out
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export function Notifications({
  custody,
  onBatch,
}: {
  custody: State["custody"];
  onBatch: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} />
        {custody.length > 0 && <span className="notification-dot" />}
      </button>
      {open && (
        <Modal
          className="notification-popover"
          title="Latest handoffs"
          onClose={() => setOpen(false)}
        >
          <p className="form-hint">Recent activity in this event</p>
          <div className="notification-list">
            {custody.length === 0 ? (
              <p>You are all caught up. New handoffs will appear here.</p>
            ) : (
              custody.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setOpen(false);
                    onBatch(c.batch_id);
                  }}
                >
                  <strong>
                    {c.action.replace(
                      /Seeded demonstration record/gi,
                      "Sample record",
                    )}
                  </strong>
                  <span>
                    {c.batch_id} · {c.role}
                  </span>
                  <small>{new Date(c.created_at).toLocaleString()}</small>
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
type Theme = "light" | "dark" | "system";
export function Appearance({ onClose }: { onClose: () => void }) {
  const [theme, setTheme] = useState<Theme>(
    () =>
      ((typeof window !== "undefined"
        ? localStorage.getItem("secondroute.theme")
        : null) as Theme) || "system",
  );
  return (
    <Modal title="Appearance" onClose={onClose}>
      <p className="form-hint">
        Choose the look that feels right. Your preference is saved on this
        browser.
      </p>
      <div className="theme-options">
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            aria-pressed={theme === t}
            className={theme === t ? "selected" : ""}
            onClick={() => {
              setTheme(t);
              localStorage.setItem("secondroute.theme", t);
              window.dispatchEvent(new Event("themechange"));
            }}
          >
            <span className={"theme-swatch " + t} />
            {t === "dark"
              ? "Dark mode"
              : t === "light"
                ? "Light mode"
                : "Use device setting"}
          </button>
        ))}
      </div>
    </Modal>
  );
}
export function ThemeEffect() {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const pref = localStorage.getItem("secondroute.theme") || "system";
      document.documentElement.dataset.theme =
        pref === "system" ? (media.matches ? "dark" : "light") : pref;
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("themechange", apply);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("themechange", apply);
    };
  }, []);
  return null;
}
export function AccountSettings({
  onAppearance,
}: {
  onAppearance: () => void;
}) {
  const { account, signIn, refresh } = useAccount();
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <>
      <h2>Account & workspace</h2>
      {account.user ? (
        <>
          <p>
            {account.user.email} ·{" "}
            {account.user.emailVerified
              ? "Email verified"
              : "Email not yet verified"}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const f = new FormData(e.currentTarget);
                await authRequest("update-user", { name: f.get("name") });
                await refresh();
                setNotice("Profile updated");
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <label>
              Display name
              <input
                name="name"
                defaultValue={account.user.name}
                maxLength={80}
                required
              />
            </label>
            <button className="primary">Save profile</button>
          </form>
          {!account.user.emailVerified && account.mail && (
            <button
              onClick={async () => {
                try {
                  await authRequest("send-verification-email", {
                    email: account.user!.email,
                    callbackURL: "/",
                  });
                  setNotice("Verification email sent");
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Verify email address
            </button>
          )}
        </>
      ) : (
        <div className="info-strip">
          <UserRound />
          <div>
            <strong>Start your own recovery workspace</strong>
            <p>
              Browse sample records or create an account to record real
              materials.
            </p>
            <button className="primary" onClick={signIn}>
              Create account / Sign in
            </button>
          </div>
        </div>
      )}
      <div className="setting-row">
        <div>
          <strong>Appearance</strong>
          <p>Light, dark or your device setting.</p>
        </div>
        <button onClick={onAppearance}>Change appearance</button>
      </div>
      {[
        ["Maps", "OpenStreetMap. No API key or billing account.", "Available"],
        [
          "Email accounts",
          "Email and password sign-in stored on this installation.",
          "Available",
        ],
        [
          "Google sign-in",
          account.google
            ? "Google OAuth configured."
            : "Operator must configure Google OAuth credentials.",
          account.google ? "Configured" : "Not configured",
        ],
        [
          "Outgoing email",
          account.mail
            ? "SMTP delivery configured."
            : "Connect an SMTP sender for verification and password reset mail.",
          account.mail ? "Configured" : "Not configured",
        ],
      ].map(([name, detail, status]) => (
        <div className="setting-row" key={name}>
          <div>
            <strong>{name}</strong>
            <p>{detail}</p>
          </div>
          <span className="badge">{status}</span>
        </div>
      ))}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="error-copy">
          {error}
        </p>
      )}
    </>
  );
}
