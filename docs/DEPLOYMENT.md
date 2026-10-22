# Running and deployment

The supported review target is a desktop browser connected to one Node.js server with persistent local PGlite storage. Run `npm run build` and then `npm start`. The normal origin is `http://127.0.0.1:3000`, matching `BETTER_AUTH_URL`. No hosting subscription, paid maps API or hosted authentication service was provisioned.

For optional Google sign-in and outgoing mail, follow ACCOUNTS.md. Neither requires placing secrets in client code. Provider credentials, sender limits and live delivery must be verified by the operator. No provider credentials were supplied during this review.

Before an internet deployment, configure HTTPS and the exact public `BETTER_AUTH_URL`, keep the auth secret stable, persist the database, uploads and signing key, and use one application process per PGlite directory. Back up private data separately from source. A scale-out deployment needs a shared production database and deliberate storage adaptation. Public source publication does not deploy the server or publish its private runtime files.

The public APIs do not accept role headers as authority. Visitors see read-only sample data; private operations resolve cookie sessions and membership. Published passports are public only after owner issuance. Review the current account ownership, email verification and recipient identity boundaries in LIMITATIONS.md before accepting real operations.

OpenStreetMap is loaded directly by the browser with attribution. It needs no map API key and follows the provider's availability and usage policies. There are no offline map downloads, geocoding or route optimization claims.

Cloudflare Worker hosting cannot run this Node filesystem server unchanged. Sites hosting requires a compatible backend and storage adaptation. No public hosted deployment or Devpost submission was made. The current changes are held locally until the user's GitHub publication approval.
