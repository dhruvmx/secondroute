# Deployment

The supported credential-free target is a desktop browser served by a local Node process with durable disk. Start with `npm install`, run the checks in VERIFICATION.md, then `npm run build` and `npm start`. Use the development server for the local demonstration where documented.

Do not deploy a demo role-switching instance with private real-world records. Demo headers are intentionally user-selectable and provide no identity assurance. A public URL is not implied by a successful local build.

## Connected production prerequisites

1. Provision PostgreSQL and apply reviewed migrations. Replace local PGlite with a supported multi-instance database adapter before scaling.
2. Provision Supabase Auth and require verified JWTs on server routes. Resolve organization and partner membership on the server. Deny demo-role headers in connected mode.
3. Enable and test row-level policies for every operational table. Use private Storage buckets and short-lived evidence access URLs. Never expose service-role credentials to browser bundles.
4. Configure authenticated Realtime subscriptions backed by database records. Test reconnect and multiple sessions. Do not publish operational data on public ntfy topics.
5. Keep signing keys in a deployment secret manager or protected persistent storage. Publish only public verification keys. Establish key rotation, backup, revocation and supersession procedures.
6. Configure optional Mapbox and Gemini credentials. Verify missing-key, timeout, malformed-output and rate-limit states. Mapbox tokens need appropriate scope restrictions.
7. Run integration and browser tests against the deployed target. Verify that reset and demo role switching are unavailable in connected production.

Cloudflare Worker hosting does not run an ordinary Next.js Node filesystem server unchanged. The local persistence and signing implementation must not be uploaded as if it were a compatible durable Worker backend. Sites hosting requires a deliberate runtime/storage adaptation or a separately secured backend. Record any actual deployment URL and status in VERIFICATION.md.

The hackathon submission is a separate action. No Devpost publication is authorized by creating this draft package.
