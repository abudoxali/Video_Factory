# Video Factory — n8n Orchestrator Integration

This directory contains the canonical n8n workflows, payload schemas, examples, and activation guidelines for the **Video Factory** platform.

---

## 1. Complete Workflow Family (VF-00 through VF-17)

| Workflow ID | Workflow Name | Description | Export File |
|---|---|---|---|
| **VF-00** | `VF-00 Core Job Orchestrator` | Parent orchestrator coordinating the end-to-end planning, media, and render pipeline | [`workflows/VF-00-core-job-orchestrator.json`](./workflows/VF-00-core-job-orchestrator.json) |
| **VF-01** | `VF-01 AI Director` | Analyzes video request, establishes tone, audience, hook & creative brief | [`workflows/VF-01-ai-director.json`](./workflows/VF-01-ai-director.json) |
| **VF-02** | `VF-02 Script Generator` | Generates high-retention video narration & structured sections | [`workflows/VF-02-script-generator.json`](./workflows/VF-02-script-generator.json) |
| **VF-03** | `VF-03 Scene Planner` | Generates ordered visual scenes, prompts, media strategy & timeline | [`workflows/VF-03-scene-planner.json`](./workflows/VF-03-scene-planner.json) |
| **VF-04** | `VF-04 Media Generation Coordinator` | Coordinates media strategy routing, short/long-form batching and state tracking | [`workflows/VF-04-media-generation-coordinator.json`](./workflows/VF-04-media-generation-coordinator.json) |
| **VF-05** | `VF-05 Image Generator` | Ingests AI image assets generated via Gemini Native Images | [`workflows/VF-05-image-generator.json`](./workflows/VF-05-image-generator.json) |
| **VF-06** | `VF-06 Video Generator` | Coordinates async video clip generation and polling via Google Video APIs | [`workflows/VF-06-video-generator.json`](./workflows/VF-06-video-generator.json) |
| **VF-07** | `VF-07 Voice Generator` | Ingests ElevenLabs multilingual narration audio and captures actual duration | [`workflows/VF-07-voice-generator.json`](./workflows/VF-07-voice-generator.json) |
| **VF-08** | `VF-08 Asset Storage & Finalization` | Audits Cloudflare R2 object checksums and transitions job to `MEDIA_READY` | [`workflows/VF-08-asset-storage-finalization.json`](./workflows/VF-08-asset-storage-finalization.json) |
| **VF-09** | `VF-09 Render Coordinator` | Prepares render manifest, validates asset readiness, and initiates assembly | [`workflows/VF-09-render-coordinator.json`](./workflows/VF-09-render-coordinator.json) |
| **VF-10** | `VF-10 Final Render & Upload` | Manages Remotion output, validates MP4, and tracks Cloudflare R2 upload | [`workflows/VF-10-final-render-upload.json`](./workflows/VF-10-final-render-upload.json) |
| **VF-11** | `VF-11 Final Video QA` | Audits final MP4 dimensions, duration, and checksum before marking `RENDER_READY` | [`workflows/VF-11-final-video-qa.json`](./workflows/VF-11-final-video-qa.json) |
| **VF-12** | `VF-12 Distribution Coordinator` | Validates connected social accounts, media constraints, and dispatches publishing | [`workflows/VF-12-distribution-coordinator.json`](./workflows/VF-12-distribution-coordinator.json) |
| **VF-13** | `VF-13 YouTube Publisher` | Coordinates YouTube Data API v3 resumable video upload and privacy handling | [`workflows/VF-13-youtube-publisher.json`](./workflows/VF-13-youtube-publisher.json) |
| **VF-14** | `VF-14 Instagram Publisher` | Coordinates Meta / Instagram Professional Reels container creation and publish | [`workflows/VF-14-instagram-publisher.json`](./workflows/VF-14-instagram-publisher.json) |
| **VF-15** | `VF-15 TikTok Publisher` | Coordinates TikTok Direct Post API file upload, creator info, and post tracking | [`workflows/VF-15-tiktok-publisher.json`](./workflows/VF-15-tiktok-publisher.json) |
| **VF-16** | `VF-16 Publication Reconciler` | Periodic reconciliation for in-flight publications across all social providers | [`workflows/VF-16-publication-reconciler.json`](./workflows/VF-16-publication-reconciler.json) |
| **VF-17** | `VF-17 Analytics Sync` | Periodic telemetry synchronization for views, likes, comments, and shares | [`workflows/VF-17-analytics-sync.json`](./workflows/VF-17-analytics-sync.json) |

---

## 2. Environment Variables in n8n

Ensure the following environment variables are configured in your n8n Docker environment:

```env
# Web application endpoints
VIDEO_FACTORY_API_URL=http://localhost:3000
VIDEO_FACTORY_BASE_URL=http://localhost:3000

# Shared Secret for Authenticated Callback Endpoints
VIDEO_FACTORY_N8N_CALLBACK_SECRET=your_callback_shared_secret_here

# Provider Configuration
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Cloudflare R2 Media Storage
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_BUCKET_NAME=video-factory-media
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key

# Social Platform OAuth (Optional per platform)
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
```

---

## 3. How to Import and Activate

1. Open your running n8n instance at `http://localhost:5678`.
2. Go to **Workflows** -> **Import from File...**
3. Import all JSON files from `n8n/workflows/` (VF-00 through VF-17).
4. Toggle **Active** to `ON` for each workflow.
