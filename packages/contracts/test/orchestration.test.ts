import { describe, it, expect } from 'vitest';
import {
  PlanningExecuteRequestSchema,
  MediaExecuteRequestSchema,
  RenderExecuteRequestSchema,
  PublishExecuteRequestSchema,
  decidePublicationAction,
  summarizeSceneMediaStates,
} from '../src/index';

describe('Internal Orchestration Contracts (Part 4)', () => {
  it('accepts a full-pipeline planning execution request', () => {
    const res = PlanningExecuteRequestSchema.safeParse({
      job_id: 'job_1',
      video_id: 'vid_1',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.stage).toBeUndefined();
  });

  it('accepts per-stage planning execution and rejects unknown stages', () => {
    for (const stage of ['AI_DIRECTOR', 'SCRIPT_GENERATION', 'SCENE_PLANNING'] as const) {
      expect(
        PlanningExecuteRequestSchema.safeParse({ video_id: 'vid_1', stage }).success
      ).toBe(true);
    }
    expect(
      PlanningExecuteRequestSchema.safeParse({ video_id: 'vid_1', stage: 'RENDERING' }).success
    ).toBe(false);
  });

  it('requires video_id for media/render execution and tolerates empty job_id', () => {
    expect(MediaExecuteRequestSchema.safeParse({ video_id: 'v', job_id: '' }).success).toBe(true);
    expect(MediaExecuteRequestSchema.safeParse({}).success).toBe(false);
    expect(RenderExecuteRequestSchema.safeParse({ video_id: 'v', force: true }).success).toBe(true);
    expect(RenderExecuteRequestSchema.safeParse({ job_id: 'x' }).success).toBe(false);
  });

  it('accepts both publishing execution modes and tolerates n8n null payloads', () => {
    const single = PublishExecuteRequestSchema.safeParse({
      publication_id: 'pub_1',
      expected_platform: 'YOUTUBE',
    });
    expect(single.success).toBe(true);

    const batch = PublishExecuteRequestSchema.safeParse({
      video_id: 'vid_1',
      platforms: null,
      account_ids: null,
      metadata: null,
      render_id: '',
    });
    expect(batch.success).toBe(true);

    expect(
      PublishExecuteRequestSchema.safeParse({ publication_id: 'pub_1', expected_platform: 'MYSPACE' })
        .success
    ).toBe(false);
  });

  it('rejects invalid orchestration versions', () => {
    expect(
      MediaExecuteRequestSchema.safeParse({ version: '2.0', video_id: 'v' }).success
    ).toBe(false);
  });

  describe('decidePublicationAction — retry-safe publish decisions', () => {
    it('never re-publishes a PUBLISHED record (idempotent)', () => {
      expect(
        decidePublicationAction({ status: 'PUBLISHED', platformPublicationId: 'yt_1' })
      ).toBe('skip_published');
    });

    it('reconciles in-flight records instead of re-submitting them', () => {
      expect(
        decidePublicationAction({ status: 'UPLOADING', platformPublicationId: 'yt_1' })
      ).toBe('reconcile_status');
      expect(
        decidePublicationAction({ status: 'PROCESSING', platformPublicationId: 'ig_1' })
      ).toBe('reconcile_status');
    });

    it('re-drives QUEUED/FAILED records that never reached the provider', () => {
      expect(decidePublicationAction({ status: 'QUEUED' })).toBe('publish');
      expect(decidePublicationAction({ status: 'FAILED' })).toBe('publish');
      expect(decidePublicationAction({ status: 'UPLOADING', platformPublicationId: null })).toBe(
        'publish'
      );
    });

    it('skips cancelled publications', () => {
      expect(decidePublicationAction({ status: 'CANCELLED' })).toBe('skip_cancelled');
    });
  });

  describe('summarizeSceneMediaStates — truthful READY accounting', () => {
    it('counts real per-scene states and only reports allReady when fully resolved', () => {
      const s = summarizeSceneMediaStates([
        { mediaState: 'READY' },
        { mediaState: 'READY' },
        { mediaState: 'AWAITING_STOCK' },
      ]);
      expect(s).toMatchObject({
        totalScenes: 3,
        ready: 2,
        awaitingStock: 1,
        allResolved: true,
        allReady: true,
      });
    });

    it('never reports allReady while a provider is still generating', () => {
      const s = summarizeSceneMediaStates([
        { mediaState: 'READY' },
        { mediaState: 'GENERATING' },
      ]);
      expect(s.allResolved).toBe(false);
      expect(s.allReady).toBe(false);
      expect(s.generating).toBe(1);
    });

    it('never reports allReady when a scene failed', () => {
      const s = summarizeSceneMediaStates([
        { mediaState: 'READY' },
        { mediaState: 'FAILED' },
      ]);
      expect(s.allResolved).toBe(true);
      expect(s.allReady).toBe(false);
      expect(s.failed).toBe(1);
    });
  });
});
