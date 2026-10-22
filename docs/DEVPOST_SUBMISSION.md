# SecondRoute submission draft

Project name: SecondRoute

Tagline: Giving discarded materials another destination.

Track: Sustainable Supply Chains

Status: Draft, not submitted. Reconcile this draft with final verification before publishing. Repository: https://github.com/dhruvmx/secondroute (private). A public hosted demo is not available. Change repository visibility only after an explicit publication decision before submission.

## Inspiration

When an event ends, useful cardboard, bottles, fixtures and signage can remain without a clear destination. The challenge is coordination among workers, dispatchers and recovery partners. MaterialOps inspired the broad field-to-operations workflow. SecondRoute is an independent implementation focused on the distinction between material recorded, material collected, and material accepted by a recipient.

## What it does

SecondRoute's local desktop demonstration follows material from capture to grouping, partner assignment, collection, recipient receipt, coordinator review and a material passport. The design separates estimated capture weights from recipient acceptance and rejects duplicate ingestion using stable submission identifiers. Rejected material is not counted as recovered. Fictional seed records make the workflow repeatable without representing real partners or customer outcomes.

The passport uses a signed record to make alteration detectable. It is an attestation, not proof of physical truth. Emissions estimates are unavailable without suitable sourced factors. There are no tokenized carbon credits or blockchain claims.

## How we built it

The desktop browser application uses Next.js, React and TypeScript, with Node route handlers and durable local PostgreSQL through PGlite. Server business rules govern lifecycle transitions and quantities. Desktop capture includes manual classification, evidence upload and an offline retry queue. No trained material classifier is bundled.

Review the final verification report for exactly which browser, API, persistence and cryptographic checks passed. Connected authentication, external integrations and platform builds must be described separately from local-demo behavior.

## Challenges

Recovery accounting needs careful boundaries: an assignment is not a receipt, and an estimated weight is not a measurement. Offline retries must preserve identity without counting material twice. Signatures must protect canonical records while keeping private signing keys outside browser storage. The local environment lacks Docker and PostgreSQL binaries, so embedded PostgreSQL supports the desktop workflow.

## Accomplishments

The implementation centers recipient acceptance and visible rejection rather than a scan-based recovery counter. Its demo architecture keeps authoritative records on the server and makes the trust and environmental assumptions explicit. The desktop browser completed capture, assignment, collection, receipt, review and passport verification. A fictional API test recorded 100 kg captured, 82 kg accepted, and 18 kg rejected, with matching CSV and PDF exports. All 15 HTTP checks and three automated test cases passed. A production outage capture survived browser reload and synchronized after the server restarted. These are test results, not real environmental or customer outcomes.

## What we learned

Material recovery is a chain of distinct observations and attestations. Each transition needs an actor, a quantity and evidence. A reliable product should expose uncertainty and missing integrations rather than manufacture confidence or environmental numbers.

## What's next

Complete and verify connected Supabase authentication, RLS, Storage and authenticated Realtime. Evaluate appropriately licensed classification for desktop capture. Add defensible regional environmental factors and transport accounting. Expand independent verifier and key-rotation operational testing.

## Built With

Next.js, React, TypeScript, Node.js, PostgreSQL/PGlite, Web Crypto-compatible Ed25519 signatures, and the actual installed UI dependencies listed in package.json. Optional SDK presence is not evidence that a connected service was tested.

## Provenance and eligibility

See ATTRIBUTION.md and REFERENCE_AUDIT.md. No source, branded assets, awards, users, deployment history or results of MaterialOps are claimed as SecondRoute's. Check the current event rules for existing-work disclosure and any required AI or blockchain components before submitting. This draft does not establish eligibility.
