# Limitations and capability boundaries

The local demonstration is not certified for production operations. See VERIFICATION.md for executed checks. Unexecuted tests and source-only integrations must not be represented as passing.

| Capability | Status and boundary |
| --- | --- |
| Local PostgreSQL | PGlite provides filesystem persistence; one application process, no production availability claim |
| Demo roles | Explicit role header for fictional local data; not real authentication |
| Connected Supabase | Credentials and end-to-end auth, RLS, Storage, Realtime verification required |
| Product scope | Desktop browser application |
| Material classification | Manual; no trained classifier or inference claim |
| Maps | Local zone diagram is not a road map; Mapbox requires token and integration verification |
| Routing | Compatibility/capacity matching is not optimized road routing |
| Gemini | Optional credentials required; deterministic assistance must retain its label |
| Emissions | Unavailable without sourced geography/year/pathway/baseline factors and transport assumptions |
| Blockchain | No tested testnet contract or anchoring; signatures are not blockchain |
| Carbon credits | Not implemented and not claimed |
| Physical delivery | Participant attestations and evidence can be false; a signature cannot establish physical truth |
| Crew and task management | Active tasks are derived from batch states; no full crew administration or task scheduler |
| Collection quantity | Full batch collection is supported; partial recipient acceptance and rejection are supported; partial collection planning is incomplete |
| Key rotation | Key identifiers, persisted public keys, revisions and revocation exist; no complete operator rotation workflow |
| Partner identity | Demo partner role is not authenticated to one specific partner |
| Offline evidence | Quantity records queue offline; photo upload requires a connection |
| Public deployment | Not implied by local success; hosting/runtime compatibility and credential access must be verified |

Desktop offline capture relies on browser storage and foreground synchronization. Clearing browser storage can discard pending records. First offline use requires loading the application and its event data while connected. See VERIFICATION.md for the actual reconnection and reload checks performed.

The reference audit and hackathon eligibility review have their own access limitations. Do not claim eligibility where current rules could not be read. The submission draft must be updated after final verification, real deployment, classifier completion, or production auth changes.
