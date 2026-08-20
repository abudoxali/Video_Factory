import { describe, it, expect } from 'vitest';
import {
  CreateVideoInputSchema,
  N8nStartPayloadSchema,
  N8nCallbackPayloadSchema,
  canTransitionStatus,
  isTerminalStatus,
  getArabicJobStatus,
  getArabicJobStage,
  getArabicPlanStatus,
  getArabicMediaStrategy,
  getArabicSceneMediaState,
  getArabicMediaAssetType,
  getArabicMediaError,
  getArabicRenderStatus,
  getArabicRenderError,
  CreativeBriefSchema,
  VideoScriptSchema,
  VideoChapterSchema,
  SceneSchema,
  ScenePlanSchema,
  calculateTimeline,
  validateAndAdjustTimeline,
  getArabicAIErrorMessage,
  MediaAssetSchema,
  MediaCallbackPayloadSchema,
  buildR2ObjectKey,
  RenderManifestSchema,
  RenderCallbackPayloadSchema,
  buildFinalRenderR2Key,
  secondsToFrames,
  framesToSeconds,
  normalizeTransition,
  buildCaptionSegments,
  OUTPUT_PRESET_CONFIGS,
} from '../src/index';

describe('Contracts & Validation Suite (Phases 01, 02, 03, 04)', () => {
  describe('CreateVideoInputSchema', () => {
    it('validates a valid create-video payload', () => {
      const valid = {
        title: 'فيديو تعريفي بالذكاء الاصطناعي',
        prompt: 'إنشاء فيديو قصير يتحدث عن مستقبل الذكاء الاصطناعي وصناعة المحتوى في العالم العربي',
        type: 'short' as const,
        durationSeconds: 30,
        platform: 'tiktok' as const,
        aspectRatio: '9:16' as const,
        language: 'ar' as const,
      };

      const result = CreateVideoInputSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('short');
        expect(result.data.durationSeconds).toBe(30);
      }
    });

    it('rejects invalid duration', () => {
      const invalid = {
        prompt: 'فيديو تجريبي',
        type: 'short' as const,
        durationSeconds: 2, // below min 5
        platform: 'tiktok' as const,
        aspectRatio: '9:16' as const,
      };

      const result = CreateVideoInputSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Deterministic Frame Math & Presets (Phase 04)', () => {
    it('converts seconds to frames and frames to seconds deterministically at 30 fps', () => {
      expect(secondsToFrames(5, 30)).toBe(150);
      expect(secondsToFrames(0.5, 30)).toBe(15);
      expect(secondsToFrames(30, 30)).toBe(900);

      expect(framesToSeconds(150, 30)).toBe(5);
      expect(framesToSeconds(900, 30)).toBe(30);
    });

    it('validates canonical output resolution presets', () => {
      expect(OUTPUT_PRESET_CONFIGS['9:16'].width).toBe(1080);
      expect(OUTPUT_PRESET_CONFIGS['9:16'].height).toBe(1920);

      expect(OUTPUT_PRESET_CONFIGS['16:9'].width).toBe(1920);
      expect(OUTPUT_PRESET_CONFIGS['16:9'].height).toBe(1080);

      expect(OUTPUT_PRESET_CONFIGS['1:1'].width).toBe(1080);
      expect(OUTPUT_PRESET_CONFIGS['1:1'].height).toBe(1080);
    });

    it('normalizes transitions with graceful fallback', () => {
      expect(normalizeTransition('fade')).toBe('FADE');
      expect(normalizeTransition('SLIDE')).toBe('SLIDE');
      expect(normalizeTransition('UNKNOWN_TRANSITION')).toBe('FADE');
      expect(normalizeTransition(undefined)).toBe('FADE');
    });

    it('builds phrase-level Arabic caption segments with safe timing', () => {
      const narration = 'مرحباً بكم في منصة مصنع الفيديو الذكية الحل الأسرع لإنتاج المحتوى';
      const segments = buildCaptionSegments(narration, 0, 150, 30, 'scn_1');

      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].startFrame).toBe(0);
      expect(segments[0].isRtl).toBe(true);
      expect(segments[segments.length - 1].endFrame).toBe(150);
    });

    it('formats deterministic final render R2 object keys', () => {
      const key = buildFinalRenderR2Key({
        userId: 'usr_123',
        projectId: 'prj_456',
        videoId: 'vid_789',
        renderId: 'rnd_999',
        version: 1,
      });

      expect(key).toBe(
        'video-factory/users/usr_123/projects/prj_456/videos/vid_789/renders/rnd_999/final-v1.mp4'
      );
    });
  });

  describe('Canonical RenderManifestSchema Validation (Phase 04)', () => {
    it('validates a complete RenderManifest', () => {
      const manifest = {
        version: '1.0' as const,
        renderId: 'rnd_test_1',
        videoId: 'vid_test_1',
        title: 'فيديو الإنتاجية',
        language: 'ar' as const,
        composition: {
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 300,
          durationSeconds: 10,
          aspectRatio: '9:16' as const,
        },
        scenes: [
          {
            sceneId: 'scn_1',
            position: 1,
            startFrame: 0,
            durationFrames: 150,
            durationSeconds: 5,
            mediaStrategy: 'AI_IMAGE' as const,
            visualAsset: {
              url: 'https://r2.local/image.png',
              type: 'IMAGE' as const,
              fit: 'cover' as const,
              animation: 'KEN_BURNS' as const,
            },
            narrationAsset: {
              url: 'https://r2.local/voice.mp3',
              durationSeconds: 5,
              startFrame: 0,
              durationFrames: 150,
              volume: 1,
            },
            visualDescription: 'Establishing shot',
            transition: { type: 'FADE' as const, durationFrames: 15 },
            layout: { template: 'default', theme: 'dark', backgroundColor: '#0b0f19' },
            captions: [
              {
                id: 'cap_1',
                text: 'مرحباً بكم في مصنع الفيديو',
                sceneId: 'scn_1',
                startFrame: 0,
                endFrame: 150,
                durationFrames: 150,
                startTime: 0,
                endTime: 5,
                isRtl: true,
              },
            ],
          },
        ],
        audio: {
          narrationTracks: [
            {
              id: 'nar_1',
              url: 'https://r2.local/voice.mp3',
              type: 'NARRATION' as const,
              startFrame: 0,
              durationFrames: 150,
              volume: 1,
              fadeInFrames: 0,
              fadeOutFrames: 0,
              loop: false,
            },
          ],
          musicTracks: [],
          sfxTracks: [],
          ducking: {
            enabled: true,
            duckedVolume: 0.15,
            normalVolume: 0.6,
            fadeFrames: 15,
          },
        },
        captions: {
          enabled: true,
          style: 'SOCIAL' as const,
          safeAreaMarginPercent: 18,
          primaryColor: '#ffffff',
          highlightColor: '#38bdf8',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          fontSize: 48,
          maxLines: 2,
          rtl: true,
          fontFamily: 'Cairo, sans-serif',
        },
        branding: {
          watermark: { enabled: false, opacity: 0.5, position: 'TOP_RIGHT' as const },
          introCard: { enabled: false, durationFrames: 60 },
          outroCard: { enabled: false, durationFrames: 90 },
        },
        output: {
          format: 'mp4' as const,
          codec: 'h264' as const,
          audioCodec: 'aac' as const,
          crf: 20,
        },
      };

      const res = RenderManifestSchema.safeParse(manifest);
      expect(res.success).toBe(true);
    });

    it('translates Phase 04 render statuses and errors to Arabic', () => {
      expect(getArabicRenderStatus('PREPARING')).toBe('تجهيز وتجميع المشاهد');
      expect(getArabicRenderStatus('RENDERING')).toBe('جاري إخراج وتصيير الفيديو');
      expect(getArabicRenderStatus('READY')).toBe('الفيديو جاهز للتحميل والمشاهدة');
      expect(getArabicRenderStatus('SUPERSEDED')).toBe('نسخة مستبدلة');

      expect(getArabicRenderError('RENDER_MANIFEST_INVALID')).toBe(
        'بيانات ومخطط إخراج الفيديو غير صالحة'
      );
      expect(getArabicRenderError('RENDER_ENGINE_ERROR')).toBe(
        'حدث خطأ أثناء معالجة وتصيير الفيديو عبر محرك الإخراج'
      );
    });
  });
});
