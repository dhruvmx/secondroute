# Reference and event audit

Audit date: 2026-10-22. This is a source inspection, not a runtime test of MaterialOps.

## Repository evidence

The GitHub connector returned the complete recursive tree at commit `6ececdb3fa2277e26cfbea40cbf762f99c39e010`, with `truncated: false`. No license, licence, COPYING, or NOTICE path was present. The manifest has no license field. Source and assets therefore were not reused.

| Area | Observed evidence | Consequence for SecondRoute |
| --- | --- | --- |
| Web stack | [package.json](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/package.json) declares Next `^14.2.33`, React `^18.3.1`, TypeScript `^5.5.3`, Tailwind `^3.4.6`, Zustand `^4.5.4`, Recharts `^2.12.7`, and Mapbox GL `^3.24.0`. | These are reference versions, not a current-version recommendation. |
| Persistence | [Zustand store](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/src/store/useMaterialOpsStore.ts) uses browser persistence and storage-event rehydration. | Browser state is not an authoritative multi-user database. |
| Recovery API | [route.ts](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/src/app/api/recovery/route.ts) keeps a bounded queue and deduplication set on `globalThis`; POST accepts a kind and item; DELETE clears it. It polls a fixed public ntfy topic. | This route is not durable PostgreSQL ingestion, authenticated organization isolation, or transaction-backed recovery accounting. |
| Mobile bridge | [recovery_bridge.dart](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/mobile_flutter/lib/data/recovery_bridge.dart) posts to a fixed public relay with a timeout and returns false on network failure. | Do not send private operational data through that topic or mistake best-effort posting for a durable synchronization queue. |
| Native persistence | [passport_storage_io.dart](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/mobile_flutter/lib/state/passport_storage_io.dart) writes `passports.json`; read and write errors are swallowed. | Local passport persistence exists in source, but durable retry delivery is not established by that file. |
| AI assistant | [llm.ts](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/src/lib/llm.ts) selects tools with regular expressions and streams their output. The [README](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/README.md) explicitly labels agents deterministic and the assistant rule based. | No external model call was observed in the inspected assistant core. Do not claim genuine Gemini integration from the project story alone. |
| Classification | [material_classifier.dart](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/mobile_flutter/lib/cv/material_classifier.dart) includes a real inference path when a model loads, plus hardcoded scene detections and randomized simulated captures otherwise. The complete tree contains no `.tflite` file. | The committed default is mock classification, not a supplied trained model. |
| ML export | [build_material_model.py](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/ml/build_material_model.py) creates a MobileNetV2 ImageNet backbone with a new six-class head. Its default main path exports without calling the optional fine-tune function. Sanity checking uses random input; no held-out evaluation is supplied. | Correct tensor wiring does not demonstrate material-classification accuracy. No trained material model or dataset license can be inherited. |
| Passports | [passport.ts](https://github.com/stuti-thummala/materialops-coxhacks/blob/main/src/lib/passport.ts) implements deterministic serialization, SHA-256, and ECDSA P-256, but embeds a fixed demo private key in the module and synthesizes custody steps from batch fields. | Cryptographic operations exist, but the demo key and generated timeline cannot establish secure issuance or recipient-confirmed physical custody. Never reuse the embedded key. |
| Database and auth | The tree has no Supabase directory, migration, or schema path; the web manifest has no Supabase or PostgreSQL client dependency. Only the recovery route appears under `src/app/api`. | The broader Devpost architecture claims were not substantiated by these inspected artifacts. This is not proof that no external service ever existed. |

The [public project story](https://devpost.com/software/materialops) makes broader backend, AI, and classification claims than the inspected source establishes. SecondRoute must report its own executed results and must not inherit those claims.

## Hackathon checks

The [official overview](https://ieee-climatechain-hack.devpost.com/) includes Sustainable Supply Chains, with digital passports and recycling traceability as examples. It requests a track, project explanation, 3 to 5 minute video, public code repository, and prototype. It describes student eligibility, legal-age and territory restrictions. Its technology wording mentions blockchain, AI, and data approaches, but does not by itself resolve whether every project must deploy blockchain.

The [schedule](https://ieee-climatechain-hack.devpost.com/details/dates) lists submissions from October 5 at 07:00 UTC+03 through October 25 at 17:00 UTC+03, equivalent to October 25 at 14:00 UTC or 19:30 Asia/Calcutta for the deadline. Judging is October 26 through November 8, with results listed for November 20.

The [rules URL](https://ieee-climatechain-hack.devpost.com/rules) returned HTTP 403 on repeated web fetches. Search did not expose the complete rules. The policy for existing work, exact originality requirements, and mandatory blockchain status remain unverified. Do not certify eligibility or describe signatures as blockchain.

A [participant discussion](https://ieee-climatechain-hack.devpost.com/forum_topics/45102-session-1-recording-and-clarification-on-submission-window) asks about conflicting rule/schedule wording and blockchain requirements. It contains participant questions rather than an organizer ruling in the fetched content. It is evidence of unresolved questions, not an authoritative exemption.

## Access limitations

Shell HTTP access failed DNS resolution. The web fetcher returned cache misses for several GitHub file URLs. The GitHub connector successfully returned the repository tree and the inspected file contents, resolving the repository-access blocker. Full event rules remained blocked by HTTP 403. No reference application was run, and no reference runtime behavior, mobile build, model accuracy, or live database was independently verified.
