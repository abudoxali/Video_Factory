# Video Factory — Render Worker Application

Production Remotion video assembly and rendering engine for **Video Factory**.

---

## 1. Overview

The `render-worker` package is an isolated video rendering application responsible for converting approved video plans, generated images, video clips, and voice narration into final, playable MP4 videos with Arabic captions and sound layers.

---

## 2. Architecture

```
apps/render-worker/
├── src/
│   ├── compositions/
│   │   └── MainVideoComposition.tsx   # Root composition assembling scenes, audio, and captions
│   ├── scenes/
│   │   ├── VideoScene.tsx             # Video clip scene with trim, mute, and fit options
│   │   ├── ImageScene.tsx             # Image scene with Ken Burns, zoom, and pan presets
│   │   ├── TextScene.tsx              # Kinetic Arabic typography & title cards
│   │   ├── MotionGraphicsScene.tsx    # Animated checklists and statistic reveals
│   │   └── MixedScene.tsx             # Multi-layer scene (Media + Text Overlay + Badges)
│   ├── captions/
│   │   └── ArabicCaptions.tsx         # RTL captions with safe areas and social styles
│   ├── audio/
│   │   └── AudioMixer.tsx             # Multi-track mixer with narration and audio ducking
│   ├── transitions/
│   │   └── TransitionWrapper.tsx      # Fade, slide, zoom, and dissolve scene transitions
│   ├── branding/
│   │   └── BrandingOverlay.tsx        # Safe watermarks and logo overlays
│   ├── render/
│   │   └── RenderService.ts           # Manifest validation, MP4 rendering, R2 upload, and DB sync
│   └── index.ts
├── remotion.config.ts
└── package.json
```

---

## 3. Render Pipeline Flow

1. **Manifest Validation**: Validates `RenderManifest` structure and verifies that all required scene media assets are ready.
2. **Deterministic Frame Math**: Converts all timestamps to exact frame numbers at 30 FPS (`secondsToFrames`, `framesToSeconds`).
3. **Multi-Track Audio Mixing**: Plays narration tracks sequentially while automatically ducking background music volume.
4. **Arabic-First Captions**: Renders RTL phrase-level subtitle chunks formatted in Cairo font with safe margins to avoid mobile UI clipping.
5. **Output Validation**: Validates MP4 file container, non-zero size, duration matches manifest, and computes SHA-256 checksum.
6. **R2 Upload**: Uploads final MP4 to Cloudflare R2 at deterministic key path:
   `video-factory/users/{userId}/projects/{projectId}/videos/{videoId}/renders/{renderId}/final-v{version}.mp4`
7. **Database Persistence**: Updates `renders` table with versioning and logs telemetry in `render_runs`.

---

## 4. Remotion Licensing Considerations

- Remotion is used for programmatic React-based video creation and rendering.
- For open-source and individual use, Remotion is free under its evaluation license.
- For commercial enterprise deployments, an official Remotion company license should be acquired in accordance with Remotion's licensing terms at [remotion.dev/license](https://www.remotion.dev/license).
- The rendering architecture remains modular and portable.
