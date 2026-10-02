# Video Factory Status

## Last Fresh Audit
2026-10-02

## Repository
- Connected repository: `abudoxali/Video_Factory`
- Branch: `main`
- Audited baseline commit: `6cfcb38fbf6af0ab6d0aac6dd6716134a2b42a0f`

## Overall Completion
- Historical feature/code-completion estimate: **95%**.
- This number must **not** be interpreted as production release readiness.
- Production Golden Path status: **NOT VERIFIED**.
- Release status: **BLOCKED** pending the production-integrity fixes below and a real live Golden Path execution.

## Verified Repository Surface
- Arabic-first RTL Next.js web application is implemented.
- PostgreSQL schema is organized into 18 canonical schema modules/tables and migrations `0000` through `0004` are present.
- Exactly 18 n8n workflow definitions exist: `VF-00` through `VF-17`.
- Provider packages exist for LLM planning, image/video generation, ElevenLabs voice, Cloudflare R2, publishing, and analytics.
- Social publishing provider implementations exist for YouTube, Instagram, and TikTok.
- Remotion composition/components exist under `apps/render-worker`.
- Production Docker definitions exist for web, render-worker, and PostgreSQL.
- Automated test suites exist across contracts, database, providers, render worker, and web.

## Critical Fresh-Audit Findings

### 1. n8n workflow family is not a real end-to-end production orchestrator yet
- `VF-01`, `VF-02`, and `VF-03` build deterministic/hard-coded brief, narration, and scene payloads in n8n Code nodes instead of invoking the real `PlanningEngine` / configured LLM provider.
- `VF-04` coordinates counters/events but does not invoke media-generation providers.
- `VF-05`, `VF-06`, and `VF-07` emit generation progress and then persist `READY` media state without performing image/video/voice generation themselves.
- `VF-08` reports R2 validation without executing an R2 integrity check.
- `VF-09` and `VF-10` report render/upload progress without invoking the render engine.
- `VF-11` reports QA success and persists a supplied render payload without performing media QA.
- `VF-12` routes/records distribution progress but does not dispatch real platform publishing.
- `VF-13`, `VF-14`, and `VF-15` report platform publishing progress but do not call the platform APIs.
- `VF-16` and `VF-17` are scheduled HTTP triggers for reconciliation/analytics.
- Audited workflow files are committed with `active: false`; production activation/import has not been verified.

### 2. Render output is currently simulated
- `RenderService.generateVideoFile()` does not invoke Remotion/Chromium/FFmpeg. It returns a small synthetic MP4-like header/payload buffer.
- Therefore the current render test does not prove real video rendering.
- The web render route directly instantiates `RenderService` from the render-worker package instead of calling a deployed render-worker service.
- The render-worker Docker entrypoint runs `dist/index.js`, but `src/index.ts` only exports modules and starts no server/queue/worker loop.

### 3. Production container packaging is inconsistent
- `apps/web/Dockerfile` expects `.next/standalone`.
- `apps/web/next.config.mjs` does not currently enable `output: 'standalone'`.
- The web container is Alpine and does not install the Chromium/FFmpeg runtime expected for real Remotion rendering, while the separate render-worker container that has those dependencies is not wired into the web render route.

### 4. Production environment handling is fail-open
- `docker-compose.production.yml` does not pass all required runtime variables, including the n8n outbound webhook URL/secret and AI/voice provider variables required by the current code path.
- `apps/web/src/lib/env.ts` supplies localhost/development defaults and falls back to them even in production instead of failing fast.
- R2 provider construction also has dummy endpoint/credential fallbacks instead of a production configuration gate.

### 5. Real Google video generation is not complete
- `GoogleVideoProvider` defaults to `gemini-omni-flash`, while the current Gemini model catalog uses a different current Omni model identifier.
- The provider uses a video request flow that does not match the current documented Gemini/Veo long-running video generation flow.
- `MediaCoordinator` checks async video status only once; if no video buffer is returned immediately it substitutes `Buffer.from('mock-mp4-video-stream')` and can persist that as a READY video asset.

### 6. Gemini image provider requires current-API validation/fix
- The configured `gemini-3.1-flash-image` model identifier is current, but the implementation uses a legacy-style `models/{model}:predict` request shape rather than the current documented native-image interaction flow. No live call has verified this adapter.

### 7. Production authentication/session boundary is not secure enough for release
- `vf_session_user_id` is trusted directly as the authenticated user ID without a signed/encrypted server-side session proof.
- The fallback Authorization path accepts an arbitrary `Bearer usr_*` identifier as authentication.
- OAuth `state` is base64url JSON containing `userId`; comments describe HMAC protection, but the state is neither signed nor persisted/verified against a server-side nonce in the audited implementation.

### 8. Publishing can silently become mock behavior
- `createPublishingProvider()` returns `MockPublishingProvider` in non-test environments when the corresponding OAuth client/app environment variable is missing.
- This can produce a false-positive publishing path instead of failing closed in production.

### 9. Existing tests are code-level/offline evidence, not a live Golden Path
- The repository's Golden Path test explicitly uses `MockLlmProvider`, mock storage, `forceMock` publishing, and `forceMock` analytics.
- Database tests validate schema objects/IDs and do not prove a live PostgreSQL migration/transaction cycle.
- Render tests use mock storage and the simulated `RenderService` output described above.
- The previous `69/69`, lint, typecheck, build, and 36-route claims remain historical results from 2026-08-20; they were not independently rerun during this repository-only audit.
- No GitHub Actions workflow/check run was found for the audited commit.

## External Integration State

| Boundary | Implemented in code | Configured/live verified |
| --- | --- | --- |
| PostgreSQL | Yes | Not verified against a production instance in this audit |
| n8n | Workflow JSONs exist | Import/activation/live execution not verified |
| Gemini LLM | Adapter exists | Credentials/live request not verified |
| Gemini Image | Adapter exists | Current API compatibility/live request not verified |
| Google/Veo Video | Adapter exists but requires correction | Not live verified |
| ElevenLabs | Adapter exists | Credentials/live request not verified |
| Cloudflare R2 | Real S3-compatible adapter exists | Bucket/credentials/read-write not live verified |
| Remotion | Composition/component code exists | Real MP4 rendering not implemented by current RenderService |
| YouTube | Real provider code exists | OAuth/account/upload not live verified |
| Instagram | Real provider code exists | OAuth/account/publish not live verified |
| TikTok | Real provider code exists | OAuth/account/publish not live verified |
| Analytics | Provider code exists | Live post-publication reconciliation not verified |

## External Approval Boundaries
- YouTube public publishing may require the Google/YouTube API project audit/verification depending on project status; live project status is unknown from the repository.
- Instagram permissions/app review status is unknown from the repository.
- TikTok `video.publish` approval/audit status is unknown from the repository; unaudited Direct Post clients are restricted by TikTok.

## Documentation / Repository Notes
- The connected repository currently resolves as `abudoxali/Video_Factory`, not the requested lowercase-hyphen literal `abudoxali/video-factory`.
- No explicit stale GitHub URL/reference to `abudoxali/workflow` was found in the audited code search.
- `README.md` is stale in places: it still describes the render worker as a future-phase boundary and lists an `infrastructure/nginx` directory that is not present in the current tree.

## Current Release Gate
Do **not** deploy as a production release yet. The next execution should first remove the false-positive production paths so that missing integrations fail closed and the Golden Path can only report success when real planning, media generation, rendering, storage, and publishing have actually occurred.

## Next Execution
**Production Reality Gate — Part 1: make the production runtime fail-closed and make the real Golden Path executable rather than simulated.**

The first implementation pass should focus only on the minimum blockers required to reach a truthful production run; no new product features, redesigns, providers, platforms, or unrelated refactors.
