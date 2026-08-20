import {
  type PublicationMetadata,
  PublicationMetadataSchema,
  PUBLISHING_METADATA_SYSTEM_PROMPT,
  buildPublishingMetadataPrompt,
  PROMPT_VERSIONS,
} from '@video-factory/contracts';
import type { LlmProvider } from '../llm/types';
import { getLlmProvider } from '../llm/factory';

export interface GeneratePublishingMetadataOptions {
  llmProvider?: LlmProvider;
}

export class PublishingMetadataGenerator {
  private readonly llm: LlmProvider;

  constructor(options?: GeneratePublishingMetadataOptions) {
    this.llm = options?.llmProvider || getLlmProvider();
  }

  public async generateMetadata(params: {
    title: string;
    briefSummary?: string;
    scriptText?: string;
    platform?: string;
  }): Promise<PublicationMetadata> {
    const prompt = buildPublishingMetadataPrompt(params);

    try {
      const response = await this.llm.generateStructured<PublicationMetadata>({
        promptVersion: PROMPT_VERSIONS.PUBLISHING_METADATA_V1,
        systemPrompt: PUBLISHING_METADATA_SYSTEM_PROMPT,
        userPrompt: prompt,
        jsonSchema: {},
        temperature: 0.7,
        validator: (raw: unknown) => {
          const res = PublicationMetadataSchema.safeParse(raw);
          if (res.success) {
            return { success: true, data: res.data };
          }
          return { success: false, error: res.error.message };
        },
      });

      if (response.success && response.data) {
        return response.data;
      }
    } catch {
      // Fallback if LLM or parsing fails
    }

    // High quality deterministic fallback
    const title = params.title || 'فيديو جديد';
    return {
      title,
      caption: `${title} | شاهد واستفد من هذا الفيديو المميز`,
      description: `${title}\n\nتم إنتاج هذا المحتوى بالكامل عبر منصة مصنع الفيديو (Video Factory).\nتابعنا لمزيد من المقاطع الشيقة والمفيدة!`,
      tags: ['فيديو', 'محتوى_عربي', 'فيديو_قصير'],
      hashtags: ['#فيديو', '#محتوى_عربي', '#ريلز', '#شورتس'],
      privacy: 'public',
      youtube: {
        title,
        description: `${title}\n\nفيديو مميز من إنتاج مصنع الفيديو.\nاشترك بالقناة وفعّل جرس التنبيهات!`,
        tags: ['فيديو', 'محتوى', 'ذكاء_اصطناعي'],
        categoryId: '22',
        privacy: 'public',
        madeForKids: false,
      },
      instagram: {
        caption: `${title} 🔥\n\nشاركنا رأيك في التعليقات!\n\n#ريلز #فيديو #محتوى_عربي #إكسبلور`,
        hashtags: ['#ريلز', '#فيديو', '#محتوى_عربي', '#إكسبلور'],
        shareToFeed: true,
      },
      tiktok: {
        caption: `${title} ✨ شارك الفيديو مع أصدقائك #fyp #foryou #عرب`,
        privacy: 'PUBLIC_TO_EVERYONE',
        allowComments: true,
        allowDuet: true,
        allowStitch: true,
        brandContentToggle: false,
        brandOrganicToggle: false,
      },
    };
  }
}
