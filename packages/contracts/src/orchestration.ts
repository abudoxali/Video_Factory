import { z } from 'zod';
import { MediaAssetTypeEnum, type SceneMediaState } from './media';
import { SocialPlatformEnum } from './social';
import { PublicationMetadataSchema } from './publishing';

/**
 * Internal Orchestration Contracts (Part 4 — Real n8n Orchestration)
 *
 * These schemas define the authenticated internal "execute" boundaries that n8n
 * calls. Every endpoint behind them invokes the real application
 * services/providers and persists actual database results. n8n transports and
 * routes only — it never fabricates business output.
 */

export const ORCHESTRATION_VERSION = '1.0' as const;

/**
 * POST /api/internal/planning/execute
 * Runs the provider-backed PlanningEngine. Without `stage` it executes the full
 * brief → script → scenes pipeline; with `stage` it runs a single real stage.
 */
export const PlanningExecuteStageEnum = z.enum([
  'AI_DIRECTOR',
  'SCRIPT_GENERATION',
  'SCENE_PLANNING',
]);
export type PlanningExecuteStage = z.infer<typeof PlanningExecuteStageEnum>;

export const PlanningExecuteRequestSchema = z.object({
  version: z.literal(ORCHESTRATION_VERSION).default(ORCHESTRATION_VERSION),
  job_id: z.string().min(1).optional(),
  video_id: z.string().min(1, 'video_id is required'),
  stage: PlanningExecuteStageEnum.optional(),
});
export type PlanningExecuteRequest = z.infer<typeof PlanningExecuteRequestSchema>;

/**
 * POST /api/internal/media/execute
 * Runs MediaCoordinator against real image/video/voice providers + storage.
 * Optional scoping lets stage workflows (VF-05/06/07) drive a single scene or
 * a single asset leg through the same truthful path.
 */
export const MediaExecuteRequestSchema = z.object({
  version: z.literal(ORCHESTRATION_VERSION).default(ORCHESTRATION_VERSION),
  video_id: z.string().min(1, 'video_id is required'),
  job_id: z.string().optional(),
  scene_id: z.string().optional(),
  asset_types: z.array(MediaAssetTypeEnum).optional(),
});
export type MediaExecuteRequest = z.infer<typeof MediaExecuteRequestSchema>;

/**
 * POST /api/internal/render/execute
 * Runs RenderCoordinator.buildRenderManifest + RenderService.renderVideo —
 * the real Remotion/R2 path verified in Parts 2 & 3. READY requires a real
 * persisted MP4. `force` bypasses reuse of an existing READY render.
 */
export const RenderExecuteRequestSchema = z.object({
  version: z.literal(ORCHESTRATION_VERSION).default(ORCHESTRATION_VERSION),
  video_id: z.string().min(1, 'video_id is required'),
  job_id: z.string().optional(),
  force: z.boolean().default(false),
});
export type RenderExecuteRequest = z.infer<typeof RenderExecuteRequestSchema>;

/**
 * POST /api/internal/publishing/execute
 * Two modes:
 *  - single publication drive (VF-13/14/15): { publication_id, expected_platform? }
 *  - batch dispatch (VF-12): { video_id, platforms, account_ids, metadata? }
 */
export const PublishExecuteSingleSchema = z.object({
  version: z.literal(ORCHESTRATION_VERSION).default(ORCHESTRATION_VERSION),
  publication_id: z.string().min(1),
  expected_platform: SocialPlatformEnum.optional(),
  job_id: z.string().optional(),
});

export const PublishExecuteBatchSchema = z.object({
  version: z.literal(ORCHESTRATION_VERSION).default(ORCHESTRATION_VERSION),
  video_id: z.string().min(1),
  job_id: z.string().optional(),
  /** When omitted, every launch-enabled platform is attempted. */
  platforms: z.array(SocialPlatformEnum).nullish(),
  /** Per-platform account override; absent entries resolve to the user's connected account. */
  account_ids: z.record(z.string()).nullish(),
  metadata: PublicationMetadataSchema.partial().nullish(),
  render_id: z.string().nullish(),
});

export const PublishExecuteRequestSchema = z.union([
  PublishExecuteSingleSchema,
  PublishExecuteBatchSchema,
]);
export type PublishExecuteRequest = z.infer<typeof PublishExecuteRequestSchema>;

/* ------------------------------------------------------------------ */
/* Pure orchestration decision helpers (testable without DB)           */
/* ------------------------------------------------------------------ */

/**
 * What an executor should do with an existing publication record.
 */
export type PublicationDriveAction =
  | 'skip_published'
  | 'skip_cancelled'
  | 'reconcile_status'
  | 'publish';

/**
 * Idempotent publication dispatch decision. An in-flight publication with a
 * provider-side id must be reconciled via getStatus — never re-submitted —
 * so retries cannot create duplicate social posts.
 */
export function decidePublicationAction(input: {
  status: string;
  platformPublicationId?: string | null;
}): PublicationDriveAction {
  switch (input.status) {
    case 'PUBLISHED':
      return 'skip_published';
    case 'CANCELLED':
      return 'skip_cancelled';
    case 'UPLOADING':
    case 'PROCESSING':
    case 'PUBLISHING':
      return input.platformPublicationId ? 'reconcile_status' : 'publish';
    default:
      // QUEUED / DRAFT / FAILED / REQUIRES_REAUTH / unknown → (re)drive publish.
      return 'publish';
  }
}

export interface SceneMediaSummary {
  totalScenes: number;
  ready: number;
  awaitingStock: number;
  generating: number;
  failed: number;
  timingReview: number;
  pending: number;
  /** No scene is still being generated and nothing failed. */
  allResolved: boolean;
  /** Every scene is usable for render (READY) or explicitly awaiting stock. */
  allReady: boolean;
}

/**
 * Truthful aggregation of scene media states. READY means an ACTIVE persisted
 * asset exists — this helper only counts what the database already recorded.
 */
export function summarizeSceneMediaStates(
  states: Array<{ mediaState: SceneMediaState | string }>
): SceneMediaSummary {
  const summary: SceneMediaSummary = {
    totalScenes: states.length,
    ready: 0,
    awaitingStock: 0,
    generating: 0,
    failed: 0,
    timingReview: 0,
    pending: 0,
    allResolved: false,
    allReady: false,
  };

  for (const s of states) {
    switch (s.mediaState) {
      case 'READY':
        summary.ready += 1;
        break;
      case 'AWAITING_STOCK':
        summary.awaitingStock += 1;
        break;
      case 'GENERATING':
      case 'QUEUED':
        summary.generating += 1;
        break;
      case 'FAILED':
        summary.failed += 1;
        break;
      case 'TIMING_REVIEW_REQUIRED':
        summary.timingReview += 1;
        break;
      default:
        summary.pending += 1;
    }
  }

  summary.allResolved = summary.generating === 0 && summary.pending === 0;
  summary.allReady =
    summary.allResolved &&
    summary.failed === 0 &&
    summary.ready + summary.awaitingStock === summary.totalScenes;

  return summary;
}
