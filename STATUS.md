# Video Factory Status

## Overall Completion
Not quantified — release readiness is gated by the items under "Remaining Blockers". The previous "95% / READY" claim was inaccurate: production paths silently fell back to mocks, synthetic media, and dev secrets. Those paths now fail closed, and the render layer is now real.

## Current Phase
Production Reality Gate — Part 4: Real n8n Orchestration (verified live on local n8n; provider execution blocked by placeholder credentials)

## Release Status
NOT READY — do not deploy without completing the "Exact Next Execution" steps. The n8n layer now genuinely orchestrates the application's real planning/media/render/publishing services instead of fabricating output, and every n8n→app call is authenticated. A production deployment still requires:
1. Live production credentials injected into the environment (see `.env.example`).
2. Live-service Golden Path execution (never run).

## Golden Path
- **Status**: NOT VERIFIED against live services. The render stage is now proven real locally AND inside the production Docker container (see evidence below); media generation/publishing still depend on live credentials.
- **End-to-End Orchestration** (intended flow, unchanged):
  1. **Video Request Submission**: Arabic RTL web interface (`/create`).
  2. **Database Ingestion**: `videos` + `video_jobs` in PostgreSQL.
  3. **Job Initiation**: authenticated webhook to n8n `VF-00`.
  4. **AI Director (`VF-01`)** → `video_briefs`.
  5. **Script Generator (`VF-02`)** → `video_scripts`.
  6. **Scene Planner (`VF-03`)** → `scenes`, `video_chapters`.
  7. **Plan Approval**: human reviewer approves → `planStatus = APPROVED`.
  8. **Media Coordination (`VF-04`–`VF-08`)**: media → R2 → `media_assets`.
  9. **Render Assembly (`VF-09`–`VF-11`)**: `RenderManifest` → **real Remotion render** → H.264/AAC MP4 → R2 → `renders`.
  10. **Distribution & Analytics (`VF-12`–`VF-17`)**: YouTube / Instagram / TikTok.

## Production Reality Gate — Part 2: What Changed (this iteration)

### Real Remotion toolchain installed
- `apps/render-worker` dependencies added, all pinned to `4.0.513` (matching the existing `remotion@4.0.513`):
  - `@remotion/bundler@4.0.513`
  - `@remotion/renderer@4.0.513`
  - `@remotion/cli@4.0.513`
- `apps/web` dependencies added (`@remotion/bundler`, `@remotion/renderer` @ `4.0.513`) — the web process is the in-process render host, so it must own the runtime deps for standalone `require()` resolution.
- `@remotion/google-fonts` was evaluated and removed — Cairo is vendored locally instead (deterministic, no CDN dependency).

### Real Remotion entry point
- `apps/render-worker/src/remotion-entry.tsx` (new): registers `RemotionRoot` via `registerRoot()`; exposes `MAIN_VIDEO_COMPOSITION_ID = 'MainVideoComposition'`; `calculateMetadata` maps `RenderManifest` input props → width/height/fps/durationInFrames. Reuses all existing scene components, `ArabicCaptions`, `AudioMixer`, `TransitionWrapper`, `BrandingOverlay` — no composition logic duplicated.
- `apps/render-worker/src/fonts.ts` (new): loads the vendored Cairo variable font (weights 200–1000, arabic + latin unicode-range subsets) via `FontFace` + `delayRender`/`continueRender` inside the render browser context. Font load failures degrade to system fonts — they never break rendering.
- `apps/render-worker/public/fonts/cairo-{arabic,latin}.woff2` (new, ~31–34 KB each, OFL-licensed): vendored into every Remotion bundle via `publicDir`.

### Real RemotionRenderEngine
- `apps/render-worker/src/render/engine.ts`: `RemotionRenderEngine` now performs genuine rendering — `bundle()` (cached per engine instance) or `REMOTION_SERVE_URL` → `selectComposition` → `renderMedia` (h264/aac, crf from manifest) → artifact validation.
- Entry resolution order: explicit option / `REMOTION_ENTRY_POINT` → `src/remotion-entry.tsx` adjacent → `require.resolve('@video-factory/render-worker/package.json')` → cwd fallback → `RENDER_ENGINE_NOT_CONFIGURED`.
- Browser: auto headless-shell download by default; `REMOTION_BROWSER_EXECUTABLE` + `REMOTION_CHROME_MODE` (`chrome-for-testing`/`headless-shell`) for system Chrome/Chromium (used in Docker).
- Shared default engine (`getDefaultRenderEngine`) so the expensive bundle is built once per process.
- `RenderArtifactValidationError` (`RENDER_VALIDATION_ERROR`) surfaced through `RenderService`.

### Render artifact validation
- After `renderMedia`: file must exist, size > 0, MP4 `ftyp` box present at bytes 4–7; when `ffprobe` is on PATH: video stream exists, codec `h264`, duration > 0. Any failure → `RENDER_VALIDATION_ERROR`, never `READY`.

### Tests
- `test/render-worker.test.ts`: fast unit suite unchanged in spirit — explicit test `RenderEngine` doubles; fail-closed test now injects `RemotionRenderEngine` with a nonexistent entry point (deterministic `RENDER_ENGINE_NOT_CONFIGURED`, no browser launch).
- `test/real-render.test.ts` (new): env-gated (`VF_REAL_RENDER_E2E=1`) real-render integration — bundles the real entry, renders 60 frames of 540×960@30fps with Arabic text `مرحباً من Video Factory`, validates MP4 + ffprobe (h264, ~2.05s), and proves `RenderService` reaches `READY` only after real bytes exist. Skips cleanly when the flag is unset.
- `apps/render-worker/scripts/prebundle.mjs` (new): bundles the entry to a dir for Docker/pre-deployed serve URLs.

### Docker / packaging
- `apps/web/Dockerfile`: all stages switched to `node:20-bookworm-slim` (glibc — required by the Remotion compositor and headless Chromium). Runner now installs `chromium`, `ffmpeg`, `fontconfig`, Arabic fonts (`fonts-noto-core`, `fonts-noto-ui-core`, `fonts-kacst`, `fonts-hosny-amiri`, `fonts-liberation`); pre-bundles the composition at build time to `/app/render-bundle`; sets `REMOTION_SERVE_URL`, `REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium`, `REMOTION_CHROME_MODE=chrome-for-testing`; healthcheck uses `node fetch` (wget absent on slim). Rendering stays in-process in the web container — no fake worker service.
- `apps/web/next.config.mjs`: `serverExternalPackages: ['@remotion/bundler','@remotion/renderer','@remotion/cli']` + `outputFileTracingIncludes` for `@remotion+compositor*` platform binaries (spawned, not require()'d, so nft misses them).
- `apps/render-worker/package.json`: added `./package.json` export (fixes `require.resolve` tracing warning).
- `docker-compose.production.yml`: `REMOTION_SERVE_URL=/app/render-bundle`, `REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium`, `REMOTION_CHROME_MODE=chrome-for-testing` defaults.
- Verified: `apps/web/.next/standalone` contains `apps/web/node_modules/@remotion/{bundler,renderer}` symlinks + `.pnpm/@remotion+compositor-win32-x64-msvc` — the standalone render route resolves the real toolchain.

### Environment docs
- `.env.example`: `REMOTION_*` variables documented (serve URL, entry point, public dir, browser executable, chrome mode, frame timeout).

## Production Reality Gate — Part 3: Docker Runtime Verification (this iteration)

### What changed
- `.dockerignore` (new): excludes `node_modules`, `**/.next`, `**/dist`, `.env*`, `.git`, Docker artifacts — previously absent, which risked Windows host `node_modules` junctions and local build output corrupting the Linux image layers.
- `apps/web/next.config.mjs`: fixed `outputFileTracingIncludes` glob — include globs resolve relative to the app dir (`apps/web`), not `outputFileTracingRoot`; the pnpm store lives at the workspace root, so the pattern is now `../../node_modules/.pnpm/@remotion+compositor*/**`. Previously only `package.json`/`index.js` were traced — the spawned `remotion`/`ffmpeg`/`ffprobe` binaries and `libav*` shared libraries were silently dropped from standalone.
- `apps/web/Dockerfile`: creates `/home/nextjs` (writable) and sets `ENV HOME=/home/nextjs` — `--system` users default to `HOME=/nonexistent`, which made headless Chromium fail to create its user-data dir (`chrome_crashpad_handler: --database is required` → browser launch failure).
- `apps/render-worker/test/docker-render-gate.cjs` (new): deterministic in-container render verification — mirrors `RemotionRenderEngine.render()` (same `selectComposition`/`renderMedia` options against `REMOTION_SERVE_URL=/app/render-bundle` + system Chromium) with the schema-defaulted Arabic manifest, then runs the same artifact validation (exists, >0 bytes, `ftyp`, ffprobe h264/duration>0). Copied in via `docker cp` at verification time.

### Docker build result
- `docker build -f apps/web/Dockerfile -t video-factory-web:runtime-gate .` — **SUCCESS** (image `video-factory-web:runtime-gate`).
- Exercised: pnpm `--frozen-lockfile` workspace install (601 pkgs), workspace package builds, Next.js 15.5.23 standalone build (36 routes), Remotion `prebundle.mjs` → `/app/render-bundle` (21 MB), apt install of `chromium` 154.0.8037.92 + `ffmpeg`/`ffprobe` 5.1.9 + fontconfig + Noto/Kacst/Amiri/Liberation fonts.

### Image inspection
- `node --version` → v20.20.2; `chromium --version` → 154.0.8037.92 (Debian bookworm); `ffmpeg`/`ffprobe` → 5.1.9.
- `/app/apps/web/server.js` present; `/app/render-bundle` present (incl. `public/fonts/cairo-{arabic,latin}.woff2`).
- `require.resolve('@remotion/renderer')`/`('@remotion/bundler')` resolve to `/app/node_modules/.pnpm/@remotion+*@4.0.513/...`.
- `@remotion/compositor-linux-x64-gnu` package complete in image (`remotion` 1.3 MB binary, `ffmpeg`, `ffprobe`, `libavcodec.so`, etc. — verified after the tracing fix).
- `fc-list` → 325 font entries (Arabic-capable Noto/Kacst/Amiri included).
- `REMOTION_SERVE_URL=/app/render-bundle`, `REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium`, `REMOTION_CHROME_MODE=chrome-for-testing` baked into the image.

### Container boot + health
- `docker run` with safe non-secret test env (unique `rtgate-*` values that pass the production gate; `ENABLE_YOUTUBE/INSTAGRAM/TIKTOK=false`; no real credentials used).
- Boot: `Next.js 15.5.23 ✓ Ready in 95–137ms`; instrumentation `validateProductionEnvironment('web-startup')` passed — fail-closed gate intact, no weakening.
- `GET /api/health/live` → `200 {"status":"ok","service":"video-factory-web",...}`; Docker `HEALTHCHECK` reports `(healthy)`; no crash loop, no missing-module errors in logs.

### Real in-container Remotion render — VERIFIED
- `docker exec` → `node render-gate.cjs`: `selectComposition` resolved `MainVideoComposition` 540×960 @30fps, 60 frames; `renderMedia` produced `/tmp/render-gate.mp4`.
- In-container ffprobe validation passed; artifact copied out and re-probed on host ffprobe:
  - `codec_name=h264 (High)`, `540x960`, `r_frame_rate=30/1`, `nb_frames=60`
  - audio stream: `aac (LC)`, `nb_frames=96`
  - `duration=2.048s`, `size=134397 bytes`, `format_name=mov,mp4,...`
- Arabic scene text `مرحباً من Video Factory` + RTL caption `مرحباً من مصنع الفيديو` rendered through the real path (vendored Cairo font in the bundle).
- No synthetic/fake path involved; disposable MP4 deleted after verification; container removed.

### Compose validation
- `docker compose -f docker-compose.production.yml --env-file <temp-test-env> config` — PASS; all `${VAR:?}` required vars interpolate, Remotion defaults (`/app/render-bundle`, `/usr/bin/chromium`, `chrome-for-testing`) resolve; temp env file deleted after validation.

### Fixes required during Docker verification
1. Missing `.dockerignore` → added (context + layer hygiene).
2. `outputFileTracingIncludes` glob resolved relative to app dir → `../../node_modules/...` prefix (compositor binaries now actually traced; verified in both the image and local standalone).
3. `HOME=/nonexistent` for the `nextjs` user broke headless Chromium → created `/home/nextjs` + `ENV HOME`.

## Real Render Verification Evidence
- Executed `VF_REAL_RENDER_E2E=1` + `REMOTION_BROWSER_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe` (the Remotion headless-shell auto-download stalls in this network; system Chrome used — same code path).
- Output: `…\Temp\vf-real-render-test\real-render-out.mp4` — **133,865 bytes**, `ftyp` container verified.
- `ffprobe`: `codec=h264 (High)`, `540x960`, `30 fps`, `nb_frames=60`, `duration=2.048s`, `format=mov,mp4,...` — a genuine playable MP4 with the Arabic text scene and RTL captions rendered.
- RenderService end-to-end: `status=READY`, real SHA-256 checksum, `final-v1.mp4` object key, bytes uploaded — only after real render success.
- Disposable artifacts cleaned up; no MP4/binary fixtures committed (only the two small vendored font files).

## Production Reality Gate — Part 4: Real n8n Orchestration (this iteration)

### What changed
- New authenticated internal execution boundaries — n8n now calls real application services/providers instead of fabricating output:
  - `POST /api/internal/planning/execute` → `PlanningEngine` (full pipeline or `stage` = `AI_DIRECTOR` / `SCRIPT_GENERATION` / `SCENE_PLANNING`).
  - `POST /api/internal/media/execute` → `MediaCoordinator` against configured image/video/voice providers + storage; hard `APPROVED` gate preserved.
  - `GET /api/internal/media/status` → truthful per-scene media audit, optional `verify_storage=1` `head()` proof.
  - `POST /api/internal/render/execute` → `RenderCoordinator.buildRenderManifest` + `RenderService.renderVideo` (the real Remotion/R2 path from Parts 2–3); reuses an existing READY render unless `force`.
  - `GET /api/internal/render/status` → render record + optional storage verification.
  - `POST /api/internal/publishing/execute` → single-publication drive or batch dispatch through real publishing providers; launch-disabled platforms skipped explicitly; missing credentials fail closed.
- `apps/web/src/lib/orchestration.ts` (new): shared internal helpers — `emitPhaseEvent`, `resolvePhaseJob`, entity→contract mappers, `buildPublishIdempotencyKey` (deterministic SHA-256 of user/video/render/platform), and `drivePublication` (single real provider path: PUBLISHED → untouched, in-flight → `getStatus` reconcile, QUEUED/FAILED → `publish` with persisted idempotencyKey).
- `apps/web/src/lib/n8n.ts`: added `triggerN8nWorkflow(path, payload)` — fires downstream workflow webhooks with `x-webhook-secret` + `webhook_secret`, fail-logged never thrown.
- `apps/web/src/app/api/videos/[id]/plan/approve/route.ts`: human approval now triggers the VF-04 media pipeline webhook — `APPROVED → media generation` preserved.
- `packages/contracts/src/orchestration.ts` (new) + export: execute request schemas + `decidePublicationAction` + `summarizeSceneMediaStates`.
- `packages/database/src/queries/jobs.ts`: added `createPhaseJobTransaction` (mints a real job per internal phase so progress is never silently dropped) + `appendDiagnosticJobEvent`.
- `packages/database/src/queries/render.ts`: **bug fix** — render job updates/events wrote nonexistent `stage`/`event` columns; now write `currentStage`/`eventType` + `eventId` (latent bug, only fired when a `jobId` was passed).
- `packages/database/src/queries/media.ts`: added `getVideoMediaAssets`, `getSceneMediaAssets`, `getMediaAssetById`, `supersedeMediaAsset`, `getLatestMediaRunForScene`, `updateMediaRunStatus`.
- `packages/providers/src/media-coordinator.ts`: idempotent resume — scenes with existing ACTIVE assets are skipped; in-flight async video runs are resumed via persisted `providerRequestId` (stale >30min runs fail and resubmit); voice failure now fails truthfully instead of silent READY; test-injectable loaders added.

### Workflows changed (VF-00 .. VF-15 rewritten; VF-16/VF-17 preserved)
- **VF-00** Core Job Orchestrator: fabrication Code nodes (brief/script/scenes) deleted → calls `POST /api/internal/planning/execute`, branches on real success, emits truthful ready/failed job events.
- **VF-01/02/03**: now call `/api/internal/planning/execute` with their real stage; results persisted by `PlanningEngine`, not by n8n.
- **VF-04**: calls `/api/internal/media/execute`; `allResolved && allReady` → triggers VF-09 webhook; `generating > 0` → Wait 60s → resume via same execute call (idempotent); otherwise stops truthfully (execute endpoint already marked the job FAILED).
- **VF-05/06/07**: single `media/execute` call scoped by `asset_types` (`IMAGE`/`VIDEO`/`VOICE`) + optional `scene_id`.
- **VF-08**: `GET /api/internal/media/status?verify_storage=1` → trigger render only when `verified`.
- **VF-09**: `POST /api/internal/render/execute` → trigger VF-10 only on real `status=READY`.
- **VF-10**: `GET /api/internal/render/status?verify_storage=1` → trigger VF-11 only on `verified`.
- **VF-11**: same verified render gate → trigger VF-12.
- **VF-12**: `POST /api/internal/publishing/execute` batch dispatch (platforms/accounts optional → auto-resolved to launch-enabled platforms + connected accounts).
- **VF-13/14/15**: `POST /api/internal/publishing/execute` single-publication drive with `expected_platform` guard.
- Every webhook validates the shared `N8N_VIDEO_FACTORY_WEBHOOK_SECRET` (body `webhook_secret` or `x-webhook-secret` header) and fails closed when unset/mismatched; every app call sends `x-callback-secret`.
- **VF-16/VF-17**: unchanged — already called real `/api/internal/publishing/reconcile` + `/api/internal/analytics/sync`.

### Simulated paths removed
- Code nodes fabricating creative briefs, scripts, narration, scenes, visual prompts (VF-00..VF-03).
- READY/COMPLETED media states asserted with zero provider calls (VF-04..VF-08).
- Render progress reported without a Remotion execution (VF-09..VF-11).
- Publication success without provider confirmation (VF-12..VF-15).

### Not exercised yet
- The new workflows are validated as JSON + by contract tests, but no live n8n instance has executed them yet. Legacy ingest endpoints (`/api/internal/n8n/{planning,media,render}`) remain for compatibility but are no longer invoked by any workflow.

## Live PostgreSQL
- Schema & migrations `0000`–`0004` unchanged; 18-table domain model preserved.

## Live n8n
- 18 workflow JSON definitions: VF-00..VF-15 rewritten to orchestrate real internal APIs (see Part 4); VF-16/VF-17 unchanged. Production env still requires non-localhost webhook URL + real secrets (`N8N_VIDEO_FACTORY_WEBHOOK_SECRET`, `VIDEO_FACTORY_N8N_CALLBACK_SECRET`).

## Live AI / Media Providers
- Unchanged (Part 1 gates intact); mocks remain test/dev-only.

## Live R2
- `R2StorageProvider` fails closed without real config. Object-key conventions preserved.

## Remotion Render
- **Real.** `MainVideoComposition` rendered via `@remotion/renderer` programmatic pipeline. Cairo vendored for Arabic; Docker image carries system Chromium + ffmpeg + Arabic fonts + a pre-bundled composition.

## YouTube / Instagram / TikTok
- Providers unchanged; Part-1 fail-closed OAuth/config gates unchanged.

## Authentication
- Signed session cookie + HMAC OAuth state (Part 1) — unchanged.

## Production Docker
- `apps/web/Dockerfile`: `node:20-bookworm-slim` multi-stage → standalone + render-bundle + Chromium/ffmpeg/fonts + writable `HOME`. **Image build VERIFIED** — `video-factory-web:runtime-gate` builds, boots healthy, serves `/api/health/live`, and renders real MP4s in-container.
- `docker-compose.production.yml`: `web` + `postgres`; all secrets via env references; Remotion runtime defaults baked in; `config` validated with test env.

## Security Audit
- Changed-file sweep: no API keys, OAuth secrets, tokens, R2 credentials, DB passwords, `.env`, or private keys. Only hits were minified build artifacts in `.next/` (not committed source).

## Tests
- `pnpm install --frozen-lockfile`: PASS (workspace already up to date).
- `pnpm typecheck`: PASS (0 errors, 7 projects).
- `pnpm lint` (web): PASS (0 errors, 0 warnings).
- `pnpm test`: PASS — **142/142** unit tests + 2 env-gated real-render tests skipped by default:
  - `packages/contracts`: 30 (incl. 12 new orchestration-contract tests + 4 new workflow no-fabrication/auth/API assertions), `packages/database`: 2, `packages/providers`: 48 (incl. 6 new MediaCoordinator idempotency/truthfulness tests), `apps/web`: 57 (incl. 16 new internal-endpoint auth-gating tests), `apps/render-worker`: 5 (+2 real-render skipped without `VF_REAL_RENDER_E2E=1`).
- Real render integration (`VF_REAL_RENDER_E2E=1`): **PASS — 2/2** (real MP4 produced + verified; READY only after real bytes).
- `pnpm build`: PASS (Next.js 15.5.23, 36 routes, 0 warnings; standalone includes traced @remotion toolchain **including compositor binaries**).
- `docker compose -f docker-compose.production.yml config` (temp test env): PASS.
- `docker build -f apps/web/Dockerfile -t video-factory-web:runtime-gate .`: **PASS** — built, booted healthy, `/api/health/live` 200, real in-container MP4 render verified.

## Live Integration Preflight (2026-10-02)

### Canonical repository
- Repo: `abudoxali/Video_Factory` at `C:UsersAbudDesktopGitHubVideo_Factory` (real git checkout, remote verified).
- Parts 1–4 transferred from the ZIP export and committed: `c2acc43` — pushed to `main`.
- Live-verification workflow fixes committed: `0ae075c` — pushed to `main`.

### PostgreSQL — LIVE
- Native PostgreSQL 16 on `localhost:5432`; created `video_factory`; existing drizzle migrations applied: **18/18 tables present**.

### n8n — LIVE (existing install + existing image)
- Reused the existing `~/.n8n` install and local `n8nio/n8n:1.76.1` image; container `video-factory-n8n` healthy on `:5678`.
- Imported all 18 workflows (`VF-00`..`VF-17`); activated; all registered on restart.
- Runtime env configured: `N8N_VIDEO_FACTORY_WEBHOOK_SECRET`, `VIDEO_FACTORY_N8N_CALLBACK_SECRET`, `VIDEO_FACTORY_API_URL`/`VIDEO_FACTORY_BASE_URL` (`http://host.docker.internal:3000`), `N8N_WEBHOOK_BASE_URL` (`http://localhost:5678`).
- Webhook auth verified live: missing/wrong `x-webhook-secret` → execution rejected at the Validate node; correct secret → 202 accepted with real `job_id` echoed.
- VF-16 reconciler + VF-17 analytics execute successfully on schedule against the real authenticated internal endpoints (`GET /api/internal/publishing/reconcile` → 200).

### Web app — LIVE (dev runtime)
- `pnpm dev` on `:3000` with `apps/web/.env.local` (gitignored); `/api/health/live` → 200; reachable from the n8n container via `host.docker.internal:3000`.
- `POST /api/internal/planning/execute` without `x-callback-secret` → rejected (unauthorized).

### Real orchestration proof (fail-closed, as designed)
- `POST /api/videos` created `vid_SuwANFfNQ1ufi6iQ` + `job_hrCDXevZhPXJh_2S` → triggered n8n `vf-job-orchestrator` → VF-00 validated the secret → emitted an authenticated `job.progress` event → called `/api/internal/planning/execute` → real `PlanningEngine` issued a real HTTP call to Google Gemini → the placeholder key was rejected (`INVALID_ARGUMENT`, HTTP 400) → the route persisted `planning.failed` and marked the job `FAILED`/`ERROR` with the real provider error message. No fabrication; failure is truthful end-to-end.
- Fixes found by live verification (commit `0ae075c`): webhook `responseMode` moved top-level (VF-00); `process.env` → `$env` in 16 Code-node validators; `jsonBody` wrapped in `JSON.stringify` in 27 HTTP nodes (n8n 1.76 requires a JSON string).

### Provider verification results
- Gemini/Google AI: configured but placeholder (`your_gemini_api_key`); real API reached and rejected it — INVALID, blocked.
- ElevenLabs: placeholder — blocked.
- Cloudflare R2: placeholders (`your_cloudflare_account_id`, `your_r2_*`) — blocked; no bucket ops possible.
- YouTube/Meta/TikTok OAuth: placeholders; `social_accounts` empty (no connected accounts) — all publication paths blocked.
- OpenAI: placeholder.

## Remaining Blockers
1. **Real provider credentials** — every external credential in the available env is a `your_*` placeholder: Gemini, ElevenLabs, OpenAI, R2 account/keys, Google OAuth, Meta app, TikTok keys. Until real values are supplied, media/render/publish cannot run and the Golden Path cannot complete.
2. **Social account connection** — `social_accounts` empty; the OAuth account-linking flow has never run against a real platform app.
3. **External app reviews** — Meta/TikTok/Google app review + scope approvals outstanding (unknown until real apps exist).
4. **Production deployment** — verified in dev runtime on localhost; production Docker image proven in Part 3 but not deployed; VPS `167.99.157.6` unreachable via SSH from this environment (connection timed out).
5. **Standalone render-worker service** — intentionally none; rendering runs in-process in the web container (proven real).

## Exact Next Execution Required
1. Supply real credentials per `.env.example` (Gemini, ElevenLabs, R2, social OAuth) — runtime env only, never in the repo.
2. Connect at least one social account via the real OAuth flow (or pick the single available platform).
3. Re-run the Golden Path on the live local stack already proven here: `POST /api/videos` → VF-00 → planning → approval → media → render → publish; collect evidence; only then mark Golden Path VERIFIED.

## Last Verification
2026-10-02 — **Live local integration verified**: canonical repo `abudoxali/Video_Factory` `main` @ `0ae075c`; Postgres migrated (18 tables); existing n8n install running with all 18 workflows imported+active; webhook+callback auth verified (bad secrets rejected in-execution; good secrets accepted and reach real internal APIs); real `POST /api/videos` → n8n VF-00 → `/api/internal/planning/execute` → real Gemini HTTP call → truthful `planning.failed`/job `FAILED` persisted on the placeholder key. Unit suite green (142/142 + 2 env-gated skips; contracts re-verified 30/30 after workflow fixes). Golden Path **NOT VERIFIED** — blocked solely by placeholder external credentials. Release status: **NOT READY**.
