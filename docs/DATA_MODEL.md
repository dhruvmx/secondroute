# Data model and lifecycle

All weights use kilograms. Weight provenance distinguishes field estimates from measured recipient weights. The shared TypeScript contract is `lib/types.ts`; the SQL migration is authoritative for implemented columns and constraints.

## Implemented contract

| Entity | Key fields |
| --- | --- |
| Event | ID, organization, name, location, date, status, optional latitude/longitude |
| Zone | ID, organization/event ID, name, optional geographic coordinates; legacy local coordinates retained |
| Partner | ID, name, accepted material streams, capacity, availability, distance |
| Capture | ID, event/zone/batch IDs, material, weight, provenance, count, notes, evidence, timestamp |
| Batch | ID, organization/event/zone IDs, material, weight, state, partner, accepted/rejected kg, evidence, revision, timestamps |
| Custody | ID, batch ID, action, actor role, details, timestamp |
| Passport | Signed public batch projection, hash, key ID, signature, revision |
| Idempotency | Stable operation key and original result |

Receipts must satisfy finite nonnegative accepted and rejected weights, an evidence reference, and the collection quantity policy. Rejected weight is excluded from recovered totals. Differences are visible for review. Do not infer receipt from assignment or worker collection.

## State policy

The normal path is Ready, Assigned, Collected, Received, Verified. The implementation also represents Cancelled, Failed, and Disputed exceptions. Assignment requires a compatible available partner with remaining capacity. Collection is a worker attestation. Receipt is a partner attestation. Final verification requires coordinator review of receipt evidence. Repeated transition requests must not increment totals.

Only open Ready batches are eligible for grouping. Grouping uses event, material, zone, and compatibility. Unknown material requires review. Late capture must create an appropriate new batch or await review rather than mutate sealed custody history.

## Production schema requirements

The requested production model additionally needs complete normalized organizations, memberships, material categories, partner capabilities, media, batch items, tasks, dispatch assignments, receipts, signing-key lifecycle, AI recommendations, impact-factor versions, and audit actors. Check the migration and limitations for what is actually present. This list is a production design requirement, not a claim that unused tables are functioning.

Production foreign keys and uniqueness must include organization scope where appropriate. RLS must derive organization membership from authenticated identity rather than client-provided organization IDs. Custody should be append-only to application roles. Passport revisions must preserve prior payloads and identify supersession or revocation.

## Account storage

Better Auth manages user, account, session, verification and rate-limit tables through its programmatic migration API. Membership maps an authenticated user to one owner workspace. Operational tables retain their organization scope. Auth transactions are serialized on PGlite's single connection; every private API resolves the cookie session and membership before accessing operational records. Sample workspace data remains read-only over public APIs.
