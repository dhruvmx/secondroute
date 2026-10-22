# Executed verification

Executed on Windows on 22 October 2026. Scope is the desktop browser application. All operational examples are fictional.

## Final checks

| Check | Actual result |
| --- | --- |
| `npm run build` | Passed with Next.js 16.4.2 using Webpack; routes and static pages generated |
| `npm run typecheck` | Passed after the production build completed |
| `npm run lint` | Passed with zero errors and zero warnings |
| `npm test` | 3 tests passed, zero failures: transactional integration, offline queue, and no em dash scan |
| `npm run test:http` | All 15 checks passed against the final production server |
| Persistence | PostgreSQL database closed and reopened by a fresh process; saved material remained |
| Independent verification | Standalone Web Crypto verifier accepted a signed passport and rejected changed accepted weight |
| Production dependency audit | Zero reported production vulnerabilities |
| Full development dependency audit | Five high-severity findings in the ESLint glob dependency chain; unresolved because the suggested fix downgrades to an incompatible Next configuration |

Turbopack production compilation failed while starting its CSS worker on this Windows host. The supported Webpack build succeeded, and the build script records that choice. An earlier type check overlapped build-generated type-file replacement and failed on missing generated files; sequential final build and type checking passed. The final checked commands do not run concurrently.

## Real desktop browser journey

The in-app browser loaded the local desktop product and exercised actual server operations:

1. A worker captured 20 kg of cardboard in North entrance. Existing open batch SR-1041 changed from 128 to 148 kg.
2. The coordinator saw the persisted 148 kg batch. Incompatible partner options were disabled. Paper Loop Collective was assigned.
3. A worker confirmed physical collection.
4. A recovery partner uploaded a fictional test receipt fixture and recorded 140 kg accepted and 8 kg rejected, with an explicit fictional discrepancy note.
5. The coordinator saw the discrepancy and verified the accepted amount. Rejected weight stayed excluded from recovery.
6. A signed passport opened at `/verify/SR-1041`. Browser-side Web Crypto checked the SHA-256 hash and Ed25519 signature against a separately fetched public key registry.
7. Changing accepted weight from 140 to 999 in the editable JSON changed the verification state to modified.
8. After the public disclosure allowlist was hardened, a replacement revision was issued. The current passport is revision 2 and has a valid signature. Private freeform notes and capture identifiers are absent from its public custody projection.

Screenshots are saved under `docs/evidence/`. The desktop layout was visually inspected at 1440 pixels wide and in the normal narrower app panel. The public JSON evidence is `desktop-passport.json`. It is an attestation over fictional test records, not a real recovery claim.

## Outage, reload, and reconnection

The server was actually stopped. A 3 kg desktop capture was saved to the browser queue. A reload exposed an initial cache bug: shell HTML alone was insufficient to guarantee JavaScript availability. The service worker was corrected to pre-cache the shell's static JavaScript and stylesheet URLs.

The production test then stopped the server again, reloaded the application successfully from cache, captured 2 kg, and reloaded once more while the server was still stopped. The queued record remained visible as failed and awaiting retry. After restarting the production server, synchronization removed the queue item and persisted exactly 2 kg. The open cardboard batch progressed from 3 to 5 kg. Overall Riverlight captured quantity progressed from 595 to 597 kg.

This checks service unavailability and reconnection, not operating-system airplane mode or every browser's background behavior. Synchronization is foreground polling and online-event retry. Offline photo upload is unavailable; manual quantity records can be queued. Clearing browser storage removes pending device records. An initial online load is required.

## Transactional and HTTP coverage

The integration tests check grouping, sealed-batch behavior, unknown-material review, review without double counting, unbatched review quantities included in CSV captured totals, incompatible destinations, partner capacity, invalid quantities, explicit coordinator review, receipt disputes and resolution, unauthorized roles, cross-event zone denial, immutable final states, append-only custody, duplicate/concurrent ingestion, passport round-trip persistence, private-field exclusion, revisions, revocation, and tampering.

The final HTTP run created event `f6542f2f-59d4-463a-aa20-b6372860fd85`, batch `SR-D2F9B4CE`, and passport `7906f1e5-f952-4ddc-a5f3-cd11e1a2f5a7`. Actual totals were 100 kg captured, 82 kg recipient-confirmed recovery, and 18 kg rejected. CSV matched the filtered source record. The PDF parsed successfully. Invalid uploads were rejected and a PDF evidence upload was retrieved successfully. Two independent HTTP sessions observed the same persisted capture; this is not a claim of authenticated Supabase Realtime.

The Riverlight PDF was additionally rendered with bundled PDFium and visually inspected: one page, legible text, no clipping or overlap, with 597 kg captured, 208 kg confirmed recovery, and 30 kg rejected. These are aggregate fictional seed plus browser-test quantities.

## Remaining limits

Connected Supabase Auth, RLS, hosted database, Storage and Realtime are not implemented or verified. Connected mode fails closed with HTTP 503. Partner users in local demo are role simulations rather than authenticated, partner-specific accounts. Mapbox SDK presence does not mean a geographic integration is complete. The venue diagram is illustrative. Gemini has a real optional server adapter, but no credentialed call was executed. Classification is manual. No trained classifier, blockchain contract, emissions methodology, complete key-rotation operation, or production multi-tenant security claim is made.

There is no public hosted deployment. The desktop source has been uploaded to the private repository https://github.com/dhruvmx/secondroute. Sites Worker hosting cannot directly run this Node filesystem architecture. The app is deliberately delivered as a working local desktop application with source and setup instructions. No Devpost submission was published.
