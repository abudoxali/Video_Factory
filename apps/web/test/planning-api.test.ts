import { describe, it, expect } from 'vitest';
import { PlanningPayloadSchema, calculateTimeline } from '@video-factory/contracts';

describe('Planning API & Contract Integration Tests', () => {
  it('validates a complete Planning Payload from n8n', () => {
    const payload = {
      version: '1.0',
      job_id: 'job_test_100',
      video_id: 'vid_test_100',
      stage: 'PLAN_READY',
      progress: 100,
      message: 'الخطة جاهزة للمراجعة',
      brief: {
        videoId: 'vid_test_100',
        workingTitle: '3 نصائح للإنتاجية',
        coreIdea: 'تنظيم الوقت اليومي',
        objective: 'زيادة إنجاز المهنيين',
        targetAudience: 'الشباب والمهنيون',
        platform: 'tiktok',
        videoType: 'short',
        targetDurationSeconds: 30,
        language: 'ar',
        tone: 'حماسي ومباشر',
        contentAngle: 'نصائح عملية سريعة',
        hookStrategy: 'سؤال صادم',
        narrativeStyle: 'خطوات عمل',
        visualDirection: 'لقطات عصرية',
        pacing: 'fast',
        keyPoints: ['التركيز', 'فترات الراحة'],
        constraints: [],
        requiresResearch: false,
      },
      script: {
        videoId: 'vid_test_100',
        title: '3 نصائح للإنتاجية',
        hook: 'هل تعلم أنك تخسر ساعات يومياً في التشتت؟',
        fullNarration:
          'هل تعلم أنك تخسر ساعات يومياً في التشتت؟ السر الأول: ابدأ بأهم مهمة. السر الثاني: قسّم وقتك لـ 25 دقيقة. السر الثالث: خذ راحة منتظمة.',
        estimatedWordCount: 26,
        estimatedDurationSeconds: 30,
        language: 'ar',
        sections: [
          {
            id: 'sec_1',
            title: 'المقدمة',
            narration: 'هل تعلم أنك تخسر ساعات يومياً في التشتت؟',
            targetDurationSeconds: 6,
          },
          {
            id: 'sec_2',
            title: 'النقاط الأساسية',
            narration: 'السر الأول: ابدأ بأهم مهمة. السر الثاني: قسّم وقتك لـ 25 دقيقة.',
            targetDurationSeconds: 24,
          },
        ],
      },
      scenes: [
        {
          videoId: 'vid_test_100',
          position: 1,
          purpose: 'Hook',
          narration: 'هل تعلم أنك تخسر ساعات يومياً في التشتت؟',
          onScreenText: 'توقف عن التشتت!',
          visualDescription: 'شخص ينظر بحيرة لساعة اليد في بيئة مكتبية',
          visualPrompt: 'Cinematic medium shot of thoughtful professional looking at watch, modern office, 8k',
          mediaStrategy: 'AI_VIDEO',
          durationSeconds: 6,
        },
        {
          videoId: 'vid_test_100',
          position: 2,
          purpose: 'Steps',
          narration: 'السر الأول: ابدأ بأهم مهمة. السر الثاني: قسّم وقتك لـ 25 دقيقة.',
          onScreenText: '1. ركّز على الأهم',
          visualDescription: 'موشن جرافيك متحرك لجدول مهام منظم مع عداد بومودورو',
          visualPrompt: '3D motion graphics isometric pomodoro timer glowing on dark desk, neon accents',
          mediaStrategy: 'MOTION_GRAPHICS',
          durationSeconds: 24,
        },
      ],
    };

    const res = PlanningPayloadSchema.safeParse(payload);
    expect(res.success).toBe(true);
  });

  it('rejects planning payload with invalid stage or missing required IDs', () => {
    const invalidPayload = {
      version: '1.0',
      job_id: '',
      video_id: 'vid_test_100',
      stage: 'INVALID_STAGE_NAME',
      progress: 50,
    };

    const res = PlanningPayloadSchema.safeParse(invalidPayload);
    expect(res.success).toBe(false);
  });

  it('calculates deterministic scene timestamps during manual editing', () => {
    const userEditedScenes = [
      { position: 1, durationSeconds: 4, visualDescription: 'S1', visualPrompt: 'P1' },
      { position: 2, durationSeconds: 16, visualDescription: 'S2', visualPrompt: 'P2' },
      { position: 3, durationSeconds: 10, visualDescription: 'S3', visualPrompt: 'P3' },
    ];

    const timeline = calculateTimeline(userEditedScenes as any);
    expect(timeline[0].startTime).toBe(0);
    expect(timeline[0].endTime).toBe(4);

    expect(timeline[1].startTime).toBe(4);
    expect(timeline[1].endTime).toBe(20);

    expect(timeline[2].startTime).toBe(20);
    expect(timeline[2].endTime).toBe(30);
  });
});
