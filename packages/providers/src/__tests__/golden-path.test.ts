import { describe, it, expect } from 'vitest';
import {
  PlanningEngine,
  MockLlmProvider,
  createStorageProvider,
  createPublishingProvider,
  createAnalyticsProvider,
  PublishingMetadataGenerator,
  encryptToken,
  decryptToken,
} from '../index';
import {
  buildFinalRenderR2Key,
} from '@video-factory/contracts';

describe('Golden Path End-to-End Orchestration Pipeline', () => {
  it('executes complete Golden Path slice from planning to rendering and publishing', async () => {
    // 1. Planning: AI Director, Script, and Scene Planning
    const mockBrief = {
      videoId: 'vid_test_golden_path',
      workingTitle: 'أسرار الذكاء الاصطناعي في الفيديو',
      coreIdea: 'شرح فوائد الذكاء الاصطناعي في صناعة المحتوى العربي',
      objective: 'تعليم صناع المحتوى',
      targetAudience: 'المبدعون العرب',
      platform: 'youtube_shorts' as const,
      videoType: 'short' as const,
      targetDurationSeconds: 15,
      language: 'ar' as const,
      tone: 'حماسي وملهم',
      contentAngle: 'عملي وتقني',
      hookStrategy: 'سؤال افتتاحي سريع',
      narrativeStyle: 'سردي مباشر',
      visualDirection: 'سينمائي عالي الدقة',
      pacing: 'fast',
      keyPoints: ['السرعة', 'الجودة', 'الانتشار'],
      constraints: [],
      requiresResearch: false,
    };

    const mockScript = {
      videoId: 'vid_test_golden_path',
      title: 'أسرار الذكاء الاصطناعي في الفيديو',
      hook: 'هل تعلم كيف تنتج فيديو احترافي في ثوانٍ؟',
      fullNarration: 'هل تعلم كيف تنتج فيديو احترافي في ثوانٍ؟ عبر مصنع الفيديو، يمكنك تحويل فكرتك إلى سيناريو وصور وفيديو متكامل بنقرة واحدة.',
      estimatedWordCount: 22,
      estimatedDurationSeconds: 15,
      language: 'ar' as const,
      sections: [
        {
          id: 'sec_1',
          title: 'المقدمة',
          narration: 'هل تعلم كيف تنتج فيديو احترافي في ثوانٍ؟',
          targetDurationSeconds: 5,
        },
        {
          id: 'sec_2',
          title: 'المحتوى الرئيسي',
          narration: 'عبر مصنع الفيديو، يمكنك تحويل فكرتك إلى سيناريو وصور وفيديو متكامل بنقرة واحدة.',
          targetDurationSeconds: 10,
        },
      ],
    };

    const mockScenes = {
      scenes: [
        {
          position: 1,
          purpose: 'Hook',
          narration: 'هل تعلم كيف تنتج فيديو احترافي في ثوانٍ؟',
          visualDescription: 'شخص متحمس ينظر إلى شاشة حاسوب متطورة',
          visualPrompt: 'Cinematic creator in modern studio, dynamic lighting, 8k',
          mediaStrategy: 'AI_VIDEO',
          durationSeconds: 5,
        },
        {
          position: 2,
          purpose: 'Content',
          narration: 'عبر مصنع الفيديو، يمكنك تحويل فكرتك إلى سيناريو وصور وفيديو متكامل بنقرة واحدة.',
          visualDescription: 'واجهة رقمية عصرية تعرض إنتاج فيديو ذكي',
          visualPrompt: 'Modern futuristic dashboard showing video AI pipeline rendering',
          mediaStrategy: 'AI_IMAGE',
          durationSeconds: 10,
        },
      ],
    };

    const customMock = new MockLlmProvider();
    (customMock as any).generateStructured = async (req: any) => {
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
    const planResult = await engine.executeFullPlanningPipeline({
      videoId: 'vid_test_golden_path',
      prompt: 'فيديو قصير حول فوائد الذكاء الاصطناعي في صناعة المحتوى العربي',
      platform: 'youtube_shorts',
      videoType: 'short',
      durationSeconds: 15,
      language: 'ar',
      provider: customMock,
      persistToDb: false,
    });

    expect(planResult.success).toBe(true);
    expect(planResult.brief).toBeDefined();
    expect(planResult.script).toBeDefined();
    expect(planResult.scenes).toBeDefined();
    expect(planResult.scenes!.length).toBeGreaterThanOrEqual(2);

    const brief = planResult.brief!;
    const script = planResult.script!;

    // 2. Media Generation & Cloudflare R2 Object Storage
    const storage = createStorageProvider('mock');
    const mockAudio = Buffer.from('RIFF_MOCK_WAV_AUDIO_DATA_FOR_VOICE');
    const uploadedAudio = await storage.put(
      'video-factory/users/usr_test/videos/vid_test/voice/narration.mp3',
      mockAudio,
      { contentType: 'audio/mpeg' }
    );
    expect(uploadedAudio.checksum).toBeDefined();
    expect(uploadedAudio.sizeBytes).toBe(mockAudio.length);

    // 3. Render Manifest R2 Key Builder
    const r2Key = buildFinalRenderR2Key({
      userId: 'usr_test',
      projectId: 'prj_test',
      videoId: 'vid_test',
      renderId: 'rnd_test',
      version: 1,
    });
    expect(r2Key).toContain('final-v1.mp4');

    // 4. Social Token AES-256-GCM Encryption
    const sampleOAuthToken = 'ya29.a0AXooCg_test_token_golden_path';
    const encryptedToken = encryptToken(sampleOAuthToken);
    expect(encryptedToken.startsWith('v1:')).toBe(true);
    expect(decryptToken(encryptedToken)).toBe(sampleOAuthToken);

    // 5. AI-Assisted Social Copywriting
    const metaGenerator = new PublishingMetadataGenerator();
    const socialMeta = await metaGenerator.generateMetadata({
      title: 'أسرار الذكاء الاصطناعي في الفيديو',
      briefSummary: brief.coreIdea,
      scriptText: script.fullNarration,
    });
    expect(socialMeta.title).toBeDefined();
    expect(socialMeta.youtube).toBeDefined();
    expect(socialMeta.instagram).toBeDefined();
    expect(socialMeta.tiktok).toBeDefined();

    // 6. Social Multi-Platform Publishing
    const pubProvider = createPublishingProvider('YOUTUBE', { forceMock: true });
    const pubResult = await pubProvider.publish({
      publicationId: 'pub_gold_1',
      videoId: 'vid_test',
      renderId: 'rnd_test',
      userId: 'usr_test',
      account: {
        id: 'acc_yt_1',
        platformUserId: 'channel_123',
        accessToken: sampleOAuthToken,
      },
      metadata: socialMeta,
      video: {
        r2ObjectKey: r2Key,
        sizeBytes: 5000000,
        durationSeconds: 15,
        width: 1080,
        height: 1920,
        mimeType: 'video/mp4',
      },
      idempotencyKey: 'idemp_golden_path_123',
    });

    expect(pubResult.success).toBe(true);
    expect(pubResult.status).toBe('PUBLISHED');
    expect(pubResult.platformUrl).toContain('youtu.be');

    // 7. Telemetry & Analytics Snapshot
    const analyticsProvider = createAnalyticsProvider('YOUTUBE', { forceMock: true });
    const snapshot = await analyticsProvider.fetchPublicationAnalytics({
      publicationId: 'pub_gold_1',
      platform: 'YOUTUBE',
      platformPublicationId: pubResult.platformPublicationId!,
      account: { accessToken: sampleOAuthToken },
    });

    expect(snapshot.views).toBeDefined();
    expect(snapshot.likes).toBeDefined();
    expect(snapshot.capturedAt).toBeInstanceOf(Date);
  });
});
