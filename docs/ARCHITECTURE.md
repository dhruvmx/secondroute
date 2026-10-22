# Architecture

Next.js App Router serves the desktop operations interface and Node route handlers. Client state is presentation state; persisted PostgreSQL records are authoritative. The credential-free demo uses PGlite, a PostgreSQL runtime with filesystem persistence. It is intended for one local application process, not a multi-instance production database.

The intended record flow is capture to compatible open batch, assignment to a compatible available partner, worker collection, partner measured receipt, coordinator review, signed passport, and report. Each transition is checked on the server. The accepted portion of a reviewed receipt is the recovery quantity. A capture or assignment alone is not recovery.

## Boundaries

| Boundary | Responsibility |
| --- | --- |
| Browser | Capture form, offline queue, filters, role selection in demo |
| Node API | Input validation, access policy, transactions, lifecycle, export |
| PostgreSQL | Durable operational records and idempotency uniqueness |
| Signing service | Server-side private key and canonical passport signature |
| Public passport | Deliberate public projection with no private contacts |
| Desktop offline queue | Persisted pending captures and safe retry on reconnection |

The demo role header is a local demonstration mechanism. It must never be accepted as proof of identity in connected mode. A production deployment requires verified Supabase JWTs, organization membership checks, partner identity scoping, database row-level policies, private storage policies, and authenticated realtime subscriptions. Missing connected authentication must fail closed.

Offline operations use stable client UUIDs. The server must ingest an idempotency key transactionally with the resulting capture, so retry cannot double count material. An incompatible or sealed batch cannot be silently altered by a late scan. Sync events carry no private data on public ntfy topics; authenticated database-backed synchronization is the connected target.

Local data and signing keys must be excluded from source control and deployment bundles. Backups and key rotation require an operational procedure before real use. A valid signature means the signed payload has not changed and was signed by a recognized key. Physical truth still depends on evidence and participant review.

The implementation status and actual verification evidence are recorded separately in VERIFICATION.md and LIMITATIONS.md. This document describes the architectural boundaries and does not certify all production requirements.
