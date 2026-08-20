import { describe, it, expect, beforeEach } from 'vitest';
import { CreativeBriefSchema } from '@video-factory/contracts';
import {
  MockLlmProvider,
  PlanningEngine,
  MockStorageProvider,
  MockImageProvider,
  MockVideoProvider,
  MockVoiceProvider,
  MediaCoordinator,
} from '../src/index';

describe('Providers & Orchestration Test Suite (Phases 02 & 03)', () => {
  describe('MockLlmProvider structured generation', () => {
    let mockProvider: MockLlmProvider;

    beforeEach(() => {
      mockProvider = new MockLlmProvider();
    });

    it('returns structured output matching request schema', async () => {
      const mockBrief = {
        videoId: 'vid_test_1',
        workingTitle: 'أسرار النجاح في التجارة الإلكترونية',
        coreIdea: 'شرح 3 خطوات لبدء متجر إلكتروني ناجح',
        objective: 'تعليم رواد الأعمال',
        targetAudience: 'المبتدئون',
        platform: 'tiktok',
        videoType: 'short',
        targetDurationSeconds: 30,
        language: 'ar',
        tone: 'حماسي',
        contentAngle: 'عملي',
        hookStrategy: 'سؤال افتتاحي سريع',
        narrativeStyle: 'خطوات',
        visualDirection: 'عصري وسريع',
        pacing: 'fast',
        keyPoints: ['اختيار المنتج', 'إنشاء المتجر', 'التسويق'],
        constraints: [],
        requiresResearch: false,
      };

      mockProvider.setOptions({ mockData: mockBrief });

      const result = await mockProvider.generateStructured({
        promptVersion: 'director/v1',
        systemPrompt: 'System',
        userPrompt: 'User',
        jsonSchema: {},
        validator: (data) => {
          const parsed = CreativeBriefSchema.safeParse(data);
          return { success: parsed.success, data: parsed.data };
        },
      });

      expect(result.success).toBe(true);
      expect(result.data?.workingTitle).toBe('أسرار النجاح في التجارة الإلكترونية');
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.inputTokens).toBe(120);
    });

    it('handles simulated timeout error cleanly', async () => {
      mockProvider.setOptions({
        shouldFail: true,
        failErrorCode: 'AI_TIMEOUT',
        failErrorMessage: 'Request timed out after 30000ms',
      });

      const result = await mockProvider.generateStructured({
        promptVersion: 'director/v1',
        systemPrompt: 'System',
        userPrompt: 'User',
        jsonSchema: {},
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_TIMEOUT');
    });

    it('rejects invalid structured output using validator', async () => {
      mockProvider.setOptions({
        mockData: { workingTitle: '' },
      });

      const result = await mockProvider.generateStructured({
        promptVersion: 'director/v1',
        systemPrompt: 'System',
        userPrompt: 'User',
        jsonSchema: {},
        validator: (data) => {
          const parsed = CreativeBriefSchema.safeParse(data);
          return { success: parsed.success, data: parsed.data, error: 'Invalid brief' };
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AI_VALIDATION_ERROR');
    });
  });

  describe('PlanningEngine workflow execution', () => {
    it('executes brief, script, and scene planning end-to-end with mock provider', async () => {
      const mockBrief = {
        videoId: 'vid_123',
        workingTitle: '3 أسرار للإنتاجية',
        coreIdea: 'تنظيم الوقت اليومي',
        objective: 'زيادة الإنجاز',
        targetAudience: 'الموظفون والطلاب',
        platform: 'tiktok',
        videoType: 'short',
        targetDurationSeconds: 30,
        language: 'ar',
        tone: 'تحفيزي',
        contentAngle: 'نصائح مباشرة',
        hookStrategy: 'سؤال صادم',
        narrativeStyle: 'نقاط',
        visualDirection: 'ديناميكي مع نصوص كبيرة',
        pacing: 'fast',
        keyPoints: ['التركيز', 'فترات الراحة', 'تحديد الأولويات'],
        constraints: [],
        requiresResearch: false,
      };

      const mockScript = {
        videoId: 'vid_123',
        title: '3 أسرار للإنتاجية',
        hook: 'كيف تضاعف إنجازك في نصف الوقت؟',
        fullNarration:
          'كيف تضاعف إنجازك في نصف الوقت؟ السر الأول: ابدأ بأهم مهمة. السر الثاني: قسّم وقتك لـ 25 دقيقة. السر الثالث: ابتعد عن المشتتات.',
        estimatedWordCount: 25,
        estimatedDurationSeconds: 30,
        language: 'ar',
        sections: [
          {
            id: 'sec_1',
            title: 'المقدمة',
            narration: 'كيف تضاعف إنجازك في نصف الوقت؟',
            targetDurationSeconds: 6,
          },
          {
            id: 'sec_2',
            title: 'النقاط',
            narration: 'السر الأول: ابدأ بأهم مهمة. السر الثاني: قسّم وقتك. السر الثالث: ابتعد عن المشتتات.',
            targetDurationSeconds: 24,
          },
        ],
      };

      const mockScenes = {
        scenes: [
          {
            position: 1,
            purpose: 'Hook',
            narration: 'كيف تضاعف إنجازك في نصف الوقت؟',
            visualDescription: 'شخص متحمس ينظر إلى ساعته الذكية في مكتب أنيق',
            visualPrompt: 'Cinematic shot of focused professional at modern desk, dynamic lighting, 8k',
            mediaStrategy: 'AI_VIDEO',
            durationSeconds: 6,
          },
          {
            position: 2,
            purpose: 'Content',
            narration: 'السر الأول: ابدأ بأهم مهمة.',
            visualDescription: 'قائمة مهام رقمية تتحرك بسلاسة مع علامة صح خضراء',
            visualPrompt: 'Modern 3d motion graphics checklist with glowing checkmark, dark background',
            mediaStrategy: 'MOTION_GRAPHICS',
            durationSeconds: 12,
          },
          {
            position: 3,
            purpose: 'Outro',
            narration: 'السر الثاني: قسّم وقتك. السر الثالث: ابتعد عن المشتتات.',
            visualDescription: 'لقطة نهائية لبيئة عمل هادئة ومرتبة مع زر المتابعة',
            visualPrompt: 'Minimalist workspace with warm lighting, serene atmosphere',
            mediaStrategy: 'AI_IMAGE',
            durationSeconds: 12,
          },
        ],
      };

      const customMock = new MockLlmProvider();
      customMock.generateStructured = async (req: any) => {
        if (req.promptVersion === 'director/v1') {
          return {
            success: true,
            data: mockBrief,
            provider: 'mock',
            model: 'mock',
            promptVersion: req.promptVersion,
            latencyMs: 10,
          };
        }
        if (req.promptVersion === 'script/v1') {
          return {
            success: true,
            data: mockScript,
            provider: 'mock',
            model: 'mock',
            promptVersion: req.promptVersion,
            latencyMs: 15,
          };
        }
        if (req.promptVersion === 'scene-planner/v1') {
          return {
            success: true,
            data: mockScenes,
            provider: 'mock',
            model: 'mock',
            promptVersion: req.promptVersion,
            latencyMs: 20,
          };
        }
        return { success: false, provider: 'mock', model: 'mock', promptVersion: req.promptVersion, latencyMs: 0 };
      };

      const engine = new PlanningEngine(customMock);
      const brief = await engine.generateCreativeBrief({
        videoId: 'vid_123',
        prompt: 'فيديو عن الإنتاجية وإدارة الوقت',
        platform: 'tiktok',
        videoType: 'short',
        durationSeconds: 30,
        language: 'ar',
        provider: customMock,
        persistToDb: false,
      });

      expect(brief.workingTitle).toBe('3 أسرار للإنتاجية');

      const script = await engine.generateScript(brief, undefined, customMock, false);
      expect(script.title).toBe('3 أسرار للإنتاجية');

      const scenes = await engine.generateScenes({
        brief,
        script,
        provider: customMock,
        persistToDb: false,
      });

      expect(scenes.length).toBe(3);
      expect(scenes[0].startTime).toBe(0);
      expect(scenes[0].endTime).toBe(6);
      expect(scenes[1].startTime).toBe(6);
      expect(scenes[2].endTime).toBe(30);
    });
  });

  describe('Phase 03 Storage Provider Tests (R2/S3)', () => {
    it('uploads object, computes SHA-256 checksum and generates presigned URL', async () => {
      const storage = new MockStorageProvider();
      const testBuffer = Buffer.from('hello-video-factory-media-content');

      const res = await storage.put('videos/vid_1/test.png', testBuffer, {
        contentType: 'image/png',
      });

      expect(res.sizeBytes).toBe(testBuffer.length);
      expect(res.checksum).toBeDefined();
      expect(res.objectKey).toBe('videos/vid_1/test.png');

      const head = await storage.head('videos/vid_1/test.png');
      expect(head.exists).toBe(true);
      expect(head.sizeBytes).toBe(testBuffer.length);

      const presigned = await storage.getSignedReadUrl('videos/vid_1/test.png', 3600);
      expect(presigned.url).toContain('https://mock-r2.local/videos/vid_1/test.png');
    });
  });

  describe('Phase 03 Image, Video & Voice Generation Providers', () => {
    it('generates image asset with valid dimensions and buffer', async () => {
      const imgProvider = new MockImageProvider();
      const res = await imgProvider.generate({
        prompt: 'Cinematic wide shot of Riyadh skyline at sunset',
        aspectRatio: '9:16',
      });

      expect(res.success).toBe(true);
      expect(res.buffer).toBeDefined();
      expect(res.mimeType).toBe('image/png');
      expect(res.width).toBe(768);
      expect(res.height).toBe(1344);
    });

    it('submits and polls video generation job', async () => {
      const vidProvider = new MockVideoProvider();
      const sub = await vidProvider.generate({
        prompt: 'Dynamic camera panning over modern smart office',
        durationSeconds: 5,
      });

      expect(sub.success).toBe(true);
      expect(sub.requestId).toBeDefined();

      const status = await vidProvider.getStatus!(sub.requestId);
      expect(status.status).toBe('COMPLETED');
      expect(status.buffer).toBeDefined();
      expect(status.mimeType).toBe('video/mp4');
    });

    it('synthesizes narration audio and computes actual duration', async () => {
      const voiceProvider = new MockVoiceProvider();
      const res = await voiceProvider.synthesize({
        text: 'أهلاً بكم في منصة مصنع الفيديو الذكية، الحل الأسرع لإنتاج المحتوى الاحترافي.',
        targetDurationSeconds: 5,
      });

      expect(res.success).toBe(true);
      expect(res.buffer).toBeDefined();
      expect(res.mimeType).toBe('audio/mpeg');
      expect(res.actualDurationSeconds).toBeGreaterThan(0);
      expect(res.isTimingMismatch).toBe(false);
    });
  });

  describe('MediaCoordinator Scene Routing & Ingestion', () => {
    it('processes single scene with AI_IMAGE and VOICE end-to-end without db', async () => {
      const coordinator = new MediaCoordinator({
        imageProvider: new MockImageProvider(),
        videoProvider: new MockVideoProvider(),
        voiceProvider: new MockVoiceProvider(),
        storageProvider: new MockStorageProvider(),
        persistToDb: false,
      });

      const scene = {
        id: 'scn_test_1',
        videoId: 'vid_test_100',
        position: 1,
        purpose: 'Hook',
        narration: 'هل ترغب في معرفة السر؟',
        visualDescription: 'لقطة سينمائية مميزة',
        visualPrompt: 'Cinematic establishing shot',
        mediaStrategy: 'AI_IMAGE' as const,
        durationSeconds: 5,
        startTime: 0,
        endTime: 5,
      };

      const result = await coordinator.processSceneMedia({
        scene: scene as any,
        videoId: 'vid_test_100',
      });

      expect(result.mediaState).toBe('READY');
      expect(result.visualObjectKey).toContain('image');
      expect(result.voiceObjectKey).toContain('voice');
      expect(result.actualVoiceDuration).toBe(5);
    });
  });
});
