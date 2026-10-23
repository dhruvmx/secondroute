# SecondRoute

Giving discarded materials another destination.

Repository: [dhruvmx/secondroute](https://github.com/dhruvmx/secondroute).

SecondRoute coordinates event material recovery: capture, confirm, group, assign, collect, receive, verify, and report. Recipient acceptance is distinct from a worker's collection claim. Rejected material is excluded from recovery totals. Visitors can explore clearly identified sample records. Signed-in accounts operate separate workspaces with their own events, zones, partners and material records.

This project targets desktop browsers. Field capture and offline retry are part of the desktop web application.

The header provides Open, Closed, and Hover sidebar modes. Open keeps the full menu visible. Closed keeps an icon rail and gives the page more space. Hover expands the rail when the pointer or keyboard focus enters it, then collapses it when they leave. The mode is saved on this browser. The left menu has its own vertical scrollbar, so settings and profile controls remain reachable in short windows.

## Start the desktop site

`http://127.0.0.1:3000` is a local address on your own computer. It is not a hosted website, and uploading source to GitHub does not keep that server running. There is currently no public hosted app URL.

On Windows, install Node.js 22 or later, download or clone this repository, and double-click **Start-SecondRoute.cmd** in the project folder. The launcher installs dependencies when missing, builds when needed, starts a background server, checks database and sign-in readiness, and opens your browser. Keep your computer on. After restarting the computer, open the launcher again. You can close the launcher window after it reports ready.

The address will load records and complete sign-in only while that server is available. If you see a cached page but records or sign-in fail, run the launcher again. Previously loaded sample records and account drafts can remain visible offline, but signing in needs the running server. Do not reset or delete your data to fix a stopped server.

Accounts and records belong to the installation's data directory. Keep `.env.local` and its `SECONDROUTE_DATA_DIR` setting consistent when restarting. Copying only the source does not copy accounts or uploaded evidence.

## Run from a terminal

Requires Node.js 22 or later and npm. From this directory:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Local email and password accounts use Better Auth and durable PGlite PostgreSQL on disk. No hosted authentication subscription, external database, map token or billing account is needed for the local core workflow. Use the configured origin consistently for sign-in. See [account setup](docs/ACCOUNTS.md) for optional Google sign-in and SMTP email.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

For the production desktop build, run `npm run build` followed by `npm start`. On Windows, `Start-SecondRoute.cmd` or `Start-SecondRoute.ps1` runs the background launcher and checks readiness before opening the browser. After changing source code, rebuild before restarting.

`npm run test:http` exercises a running server at `http://127.0.0.1:3001` by default. Set `SECONDROUTE_TEST_URL` to its origin and match the server's `BETTER_AUTH_URL`. Run it against a disposable `SECONDROUTE_DATA_DIR`: it creates test accounts and recovery records. The server refuses account-free writes, including sample reset requests. The local reset script refuses to reset a database containing account memberships.

## Accounts and maps

Visitors see read-only sample data. Email/password registration creates an empty workspace, and session-backed server checks scope operational reads, writes, evidence, exports and assistant context to its membership. Browser role headers do not grant permissions. Each account is the owner of one workspace in this version. Workspace owners record recipient receipt evidence and review it; this is not an independent third-party identity verification system.

Both profile buttons offer settings and appearance, plus logout for signed-in users. Light, dark and device appearance settings persist in the browser. The notification bell opens recent handoffs in a dismissible popup.

The map uses OpenStreetMap's embedded interactive map with attribution, without a paid API or key. Select Load interactive map to connect to OpenStreetMap. Event and zone coordinates set its focus. Sample locations are explicitly identified. Map availability is subject to the provider's [usage policy](https://operations.osmfoundation.org/policies/tiles/); road routing, geocoding and offline tile downloads are not implemented.

Google OAuth and SMTP adapters are implemented but require the operator's credentials. Unconfigured providers are shown as such in Settings. Email/password accounts work without them; email ownership remains unverified until mail verification or Google sign-in succeeds. No messages are read from users' inboxes.

See [verification](docs/VERIFICATION.md) for executed checks and [limitations](docs/LIMITATIONS.md) for deployment boundaries. Source publication and public website hosting are separate.

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
