# Accounts and free integrations

## Local setup

Run one Node.js application process with persistent storage. Local email/password registration, sign-in, sign-out, profile name changes and isolated owner workspaces use Better Auth and PGlite. Auth tables are migrated programmatically before the auth engine starts. Password hashing, cookie sessions, token expiry, OAuth state handling and authentication rate limiting are provided by Better Auth. API mutations additionally require the configured request origin. Auth transactions are serialized because PGlite has a single connection.

Copy `.env.example` to `.env.local` and set `BETTER_AUTH_URL` to the exact origin, normally `http://127.0.0.1:3000`. A random auth secret is generated under `.data/auth-secret` unless `BETTER_AUTH_SECRET` is set. Back up this file along with the database and signing key. Never commit these files. Use HTTPS and a fixed, high-entropy secret when exposing an installation. Do not use multiple server processes against one PGlite directory.

New accounts own separate empty workspaces. Sample data cannot be modified through public APIs, even with a forged role header. Cookies determine identity. All private evidence, state, report and assistant routes use the resolved membership's organization. Published signed passports remain intentionally public after the owner issues one.

The current account model provides one owner per workspace, not a team invitation system. Owners can record a receipt from their recipient evidence and explicitly review it. A receipt does not prove physical delivery, independent recipient authentication or environmental outcomes. Email/password accounts are allowed before email verification and show their verification status in Settings.

## Google sign-in

Create a Web application OAuth client in Google's console using the [official instructions](https://developers.google.com/identity/protocols/oauth2/web-server). Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server. Register the exact redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google`. Configure the consent screen and testing users as required by Google. Restart after setting credentials. Continue with Google appears only when both credentials exist. Basic sign-in requests identity information; it does not request Gmail inbox access.

No OAuth credentials were supplied for this review. The adapter is implemented but real Google authorization has not been verified. No billing account or paid Google Maps API was added.

## Verification and password reset email

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`. Port 465 normally uses `SMTP_SECURE=true`; port 587 uses `false` for STARTTLS. Use an existing sender whose limits permit your intended volume. No paid email service is provisioned automatically.

For an eligible Gmail account, use `smtp.gmail.com`, port 465 and an app password. Google's [app password requirements](https://support.google.com/accounts/answer/185833) include two-step verification, and some managed or protected accounts do not support them. Do not put the sender's ordinary mailbox password into the app. Keep all sender credentials server-side in `.env.local` or the deployment secret store.

When SMTP is configured, signup sends a verification link and the sign-in form offers password reset email. Reset links lead to `/reset-password`, are single-use and expire. Without SMTP, Settings reports Not configured and the interface explains that reset delivery is unavailable. The server never pretends to have sent a message. No real email delivery was tested or sent during this review because no sender credentials were supplied.

## Maps and appearance

OpenStreetMap is embedded directly, on demand. It needs no API key. The browser handles map tile caching and attribution is visible. Maps need connectivity and follow the provider's fair-use and availability policies. The app does not prefetch or offer offline map downloads. Coordinates are entered by the workspace owner and validated on the server. No geocoding or road-route optimization is claimed.

Appearance preferences persist per browser, including light, dark and device modes. Offline capture queues are scoped by workspace and include the workspace identifier so pending records cannot be replayed into another account. Logout removes the signed-in workspace's cached state. Pending queues remain scoped to their original workspace for later recovery on that browser.

Offline workspace state and last-known profile metadata are stored unencrypted in the browser on this device. They support local drafting while the server is unavailable, not proof of an active session. Every synchronized operation still requires a valid server session. Use a trusted browser for offline records. Logout clears cached workspace state and last-known identity; pending capture queues remain tied to their original workspace.
