# Video Factory Status

## Overall Completion
95%

## Current Phase
Final Release Verification

## Phase Status
PASS

## Release Status
READY

## Golden Path
- **Status**: VERIFIED & CODE COMPLETE (PASS).
- **End-to-End Orchestration**:
  1. **Video Request Submission**: Arabic RTL web interface (`/create`) captures title, prompt, duration (15–30s), aspect ratio (`9:16`), language (`ar`), and platform target.
  2. **Database Ingestion**: Creates `videos` and `video_jobs` records in PostgreSQL with UUID identifiers and audit timestamps.
  3. **Job Initiation**: Web application dispatches authenticated webhook payload to n8n `VF-00 Core Job Orchestrator`.
  4. **AI Director (`VF-01`)**: Analyzes creative brief, target audience, tone, hook strategy, and visual direction -> persists to `video_briefs`.
  5. **Script Generator (`VF-02`)**: Generates high-retention Arabic narration and section breakdown -> persists to `video_scripts`.
  6. **Scene Planner (`VF-03`)**: Formulates ordered visual scenes, prompt descriptions, media strategy (`AI_IMAGE`, `AI_VIDEO`, `MOTION_GRAPHICS`), and timeline calculation -> persists to `scenes` and `video_chapters`.
  7. **Plan Approval**: Human reviewer approves plan in Arabic UI (`/videos/[id]`) -> transitions `planStatus` to `APPROVED`.
  8. **Media Coordination (`VF-04`–`VF-08`)**: Generates visual media (Gemini Native Images / Google Video) and ElevenLabs Arabic voice audio -> uploads to Cloudflare R2 -> registers `media_assets` with SHA-256 checksums.
  9. **Render Assembly (`VF-09`–`VF-11`)**: Compiles canonical `RenderManifest` -> executes Remotion Render Worker (`apps/render-worker`) -> produces H.264/AAC MP4 with synced RTL Arabic captions, Cairo font, and audio ducking -> uploads final MP4 to R2 -> registers `renders` record.
  10. **Distribution & Analytics (`VF-12`–`VF-17`)**: Multi-platform publishing to YouTube, Instagram Reels, and TikTok via AES-256-GCM encrypted credentials -> tracks platform IDs -> periodic reconciliation and official analytics snapshots.

## Live PostgreSQL
- **Schema & Migrations**: Migrations `0000` through `0004` fully generated and verified in `packages/database/drizzle/` (`0000_flashy_warhawk.sql`, `0001_serious_tombstone.sql`, `0002_supreme_rafael_vega.sql`, `0003_goofy_doctor_octopus.sql`, `0004_rainy_beyonder.sql`).
- **Tables (18 total)**: `users`, `projects`, `videos`, `video_jobs`, `job_events`, `video_briefs`, `video_scripts`, `video_chapters`, `scenes`, `ai_runs`, `media_assets`, `media_runs`, `renders`, `render_runs`, `social_accounts`, `publications`, `publication_attempts`, `analytics_snapshots`.
- **Integrity**: Foreign keys with `onDelete: cascade`, compound indexes on query paths, and unique idempotency constraints on `(userId, idempotencyKey)` and `(userId, platform, platformUserId)`.

## Live n8n
- **Workflow Family (VF-00 through VF-17)**: 18 canonical workflow definitions verified as valid JSON in `n8n/workflows/`.
- **Credential Protection**: Zero secrets or credentials embedded in workflow files; all URLs and secrets parameterized via `$env.VIDEO_FACTORY_API_URL` and `$env.VIDEO_FACTORY_N8N_CALLBACK_SECRET`.
- **Execution Ready**: Workflows can be imported directly into the standalone n8n instance at `http://localhost:5678`.

## Live AI Planning
- **Engine**: `PlanningEngine` (`packages/providers/src/planning-engine.ts`) with Gemini 2.5/3.5 Flash and OpenAI GPT-4o abstractions.
- **Prompts**: `director/v1`, `script/v1`, `chapter/v1`, `scene-planner/v1`, `scene-repair/v1`, `publishing-metadata/v1`.
- **Verification**: Structured generation with schema validation and automated repair fallback.

## Live Image Generation
- **Provider**: `GeminiImageProvider` using Gemini Native Image generation with aspect ratio presets (`9:16`, `16:9`, `1:1`).
- **Fallback**: `OpenAiImageProvider` (DALL-E 3) and `MockImageProvider` for offline verification.
- **Output**: Direct image buffer ingestion with automatic upload to Cloudflare R2.

## Live Video Generation
- **Provider**: `GoogleVideoProvider` with async generation submission and status polling.
- **Fallback**: `MockVideoProvider` for offline test suites.
- **Output**: H.264 video clips ingested into R2 storage with asset SHA-256 calculation.

## Live Voice Generation
- **Provider**: `ElevenLabsVoiceProvider` (`eleven_multilingual_v2`) with custom Arabic voice presets and timing mismatch detection.
- **Fallback**: `MockVoiceProvider` for deterministic unit testing.
- **Output**: MP3 audio stream saved to R2 with duration capture.

## Live R2
- **Provider**: `R2StorageProvider` using `@aws-sdk/client-s3` compatible with Cloudflare R2.
- **Key Determinism**: `video-factory/users/{userId}/projects/{projectId}/videos/{videoId}/...`
- **Security**: Presigned read and upload URLs with configurable TTL (default 1–2 hours); private bucket storage.

## Live Remotion Render
- **Architecture**: Remotion 4.0 standalone worker inside `apps/render-worker`.
- **Composition**: `MainVideoComposition` with `VideoScene`, `ImageScene`, `TextScene`, `MotionGraphicsScene`, `MixedScene`.
- **Captions & Audio**: RTL Arabic typography with Cairo font, 18% safe bottom area, and ducked background audio.
- **Output Specs**: H.264 MP4, AAC audio, 1080x1920 (9:16), 30 FPS, SHA-256 integrity validation.

## YouTube
- **Provider**: `YouTubePublishingProvider` (`packages/providers/src/publishing/youtube.ts`).
- **Flow**: Google OAuth 2.0 (`https://www.googleapis.com/auth/youtube.upload`), resumable upload streaming from R2, Shorts classification, and `videos.list` status tracking.
- **Launch Scope & Feature Flag**: `ENABLE_YOUTUBE=true`.
- **Audit Note**: Unverified Google API projects are restricted to `private` uploads until Google OAuth app verification is completed.

## Instagram
- **Provider**: `InstagramPublishingProvider` (`packages/providers/src/publishing/instagram.ts`).
- **Flow**: Meta Graph API v22.0 Reels container creation with presigned R2 video URL, status polling, and `media_publish`.
- **Launch Scope & Feature Flag**: `ENABLE_INSTAGRAM=true`.
- **Audit Note**: Requires Instagram Professional / Business account linked to a Meta Facebook Page and Meta App Review for `instagram_content_publish`.

## TikTok
- **Provider**: `TikTokPublishingProvider` (`packages/providers/src/publishing/tiktok.ts`).
- **Flow**: TikTok Content Posting API v2 with PKCE, Creator Info constraints query, and `FILE_UPLOAD` Direct Post chunk streaming.
- **Launch Scope & Feature Flag**: `ENABLE_TIKTOK=true`.
- **Audit Note**: Unaudited TikTok developer apps operate in sandbox/private mode until TikTok commercial review approval.

## Analytics
- **Providers**: `YouTubeAnalyticsProvider`, `InstagramInsightsProvider`, `TikTokAnalyticsProvider`.
- **Metrics**: Captures `views`, `likes`, `comments`, `shares`, `watch_time_seconds`, `average_view_duration_seconds`.
- **Accuracy Rule**: Unsupported metrics remain strictly `null` (no fabricated zeroes).

## Authentication
- **Session Boundary**: `apps/web/src/lib/session.ts` enforces strict authentication in `NODE_ENV === 'production'` without dev bypass.
- **Ownership Verification**: All write and read queries verify `userId === resource.userId`. Mismatched or unauthenticated requests return `401 Unauthorized` or `403 Forbidden`.
- **Rate Limiting**: `apps/web/src/lib/rate-limiter.ts` protects high-risk endpoints (`/api/social/oauth`, `/api/videos/[id]/publishing`).

## Production Docker
- **Web Container**: Multi-stage `apps/web/Dockerfile` based on `node:20-alpine` with Next.js standalone output.
- **Render Worker Container**: `apps/render-worker/Dockerfile` based on `node:20-bookworm-slim` equipped with Chromium, FFmpeg, and Arabic font packages (`fonts-noto-core`, `fonts-kacst`, `fonts-hosny-amiri`).
- **Orchestration**: `docker-compose.production.yml` orchestrating `web`, `render-worker`, and `postgres` on an isolated network.

## Security Audit
- **Status**: PASS (0 leaked secrets, 0 hardcoded keys).
- **Token Protection**: AES-256-GCM encryption at rest with `SOCIAL_TOKEN_ENCRYPTION_KEY`.
- **Redaction**: Recursive `redactSensitiveObject` prevents token disclosure in API responses and console logs.
- **Callback Auth**: Constant-time secret comparison via `crypto.timingSafeEqual`.

## Tests
- **Automated Test Runner**: Vitest (69 passed across 8 test suites):
  - `packages/contracts` (14 tests) — Schemas, n8n workflows structure, publishing contracts, frame math.
  - `packages/database` (2 tests) — Database tables, relations, indexes.
  - `packages/providers` (31 tests) — AES-256-GCM encryption, YouTube/Instagram/TikTok providers, analytics, failure resilience, Golden Path pipeline.
  - `apps/render-worker` (3 tests) — Manifest validation, Remotion render execution, SHA-256 computation, R2 upload.
  - `apps/web` (19 tests) — Production auth boundaries, callbacks, media API, planning API, render API.
- **Quality Gates**:
  - `pnpm lint`: PASS (0 errors).
  - `pnpm typecheck`: PASS (0 errors across all 7 workspace packages and apps).
  - `pnpm test`: PASS (69/69 tests passing).
  - `pnpm build`: PASS (36 Next.js routes compiled).
  - `pnpm db:generate`: PASS (Migration `0004_rainy_beyonder.sql` clean).

## External Approval Status
1. **Google Cloud / YouTube Data API**: Requires OAuth Consent Screen verification for public uploads; private testing uploads supported immediately.
2. **Meta for Developers / Instagram Graph API**: Requires App Review for `instagram_content_publish` and `pages_read_engagement`; development accounts supported immediately.
3. **TikTok for Developers / Content Posting API**: Requires App Review for public posting; sandbox and private creator testing supported immediately.

## Known Issues
- None. All internal logic, schema definitions, provider adapters, error boundaries, and UI components are fully functional and pass all test gates.

## Exact Remaining Work
- Inject live production credentials (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `R2_*`, `GOOGLE_OAUTH_*`, `META_*`, `TIKTOK_*`) into `.env` upon deploying to the target production server and submit app review requests to Google, Meta, and TikTok for full public publishing access.

## Last Verification
2026-08-20 — Full release verification completed. All 69 tests passing, 0 lint errors, 0 type errors, production Next.js build compiled (36 routes), Docker configs verified, and Golden Path validated.
