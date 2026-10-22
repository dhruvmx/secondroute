# SecondRoute

Giving discarded materials another destination.

Repository: [dhruvmx/secondroute](https://github.com/dhruvmx/secondroute). This repository is private.

SecondRoute coordinates event material recovery: capture, confirm, group, assign, collect, receive, verify, and report. Recipient acceptance is distinct from a worker's collection claim. Rejected material is excluded from recovery totals. Fictional records are demonstration data, not real partnerships or measured customer outcomes.

This project targets desktop browsers. Field capture and offline retry are part of the desktop web application.

## Run locally

Requires Node.js 22 or later and npm. From this directory:

```sh
npm install
npm run dev
```

Open http://localhost:3000. The local demo uses durable PGlite PostgreSQL on disk. A Docker daemon, paid service account, wallet, or external API key is not required for its core workflow. Keep the server running while trying separate browser sessions. Demo roles are explicitly selected in the interface and enforced by the demo server policy.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

For the verified production desktop experience, run `npm run build` followed by `npm start`. On Windows, `Start-SecondRoute.ps1` installs missing dependencies, builds when needed, and starts the server. `npm run demo:reset` restores fictional seed records. `npm run test:http` exercises the running server and adds an isolated fictional verification event.

The exact executed commands and outcomes belong in [verification](docs/VERIFICATION.md). The presence of a command or test source does not mean it has passed.

## Operating modes

Local demo: fictional event records, local PostgreSQL persistence, explicit role switching, manual classification, and local evidence storage. Reset through the demo settings control. Reset discards demonstration records and must not be used against real operations.

Connected: Supabase Auth, organization memberships, Storage policies, Realtime, hosted PostgreSQL, maps, and Gemini require configuration and separate verification. Environment variable names in `.env.example` are configuration references, not a statement that every connected integration is complete. Never enable demo role bypasses on a public connected deployment. Review [limitations](docs/LIMITATIONS.md) before deploying.

## Project map

| Location | Purpose |
| --- | --- |
| `app/` | Next.js App Router interface and Node route handlers |
| `lib/` | Shared types, persistence, lifecycle and signing logic |
| `migrations/` | Database schema |
| `tests/` | Business-rule and integration verification |
| `docs/` | Architecture, verification, provenance and submission drafts |

## Integrity boundaries

Passports attest to participant records and detect subsequent alteration. They do not prove physical delivery or validate an environmental methodology. Carbon estimates are unavailable unless defensible factors and complete assumptions are supplied. There is no blockchain anchoring or carbon-credit issuance claim.

MaterialOps influenced the workflow concept. SecondRoute is an independent implementation. See [attribution](docs/ATTRIBUTION.md) and [reference audit](docs/REFERENCE_AUDIT.md) for the source audit and reuse policy. No MaterialOps awards, users, authorship, or results are claimed.

Submission material is a draft. Nothing has been submitted to Devpost. Eligibility requires review of the event's current rules and any requirements not accessible during the audit.
