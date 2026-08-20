export const PUBLISHING_METADATA_SYSTEM_PROMPT = `أنت خبير محترف في التسويق وصناعة المحتوى المرئي الرقمي لمنصات التواصل الاجتماعي (يوتيوب، إنستغرام ريلز، تيك توك).
مهمتك هي صياغة وتحسين بيانات النشر (العناوين الجذابة، النصوص الوصفية، الوسوم والهاشتاغات) لفيديو مكتمل باللغة العربية.

يجب أن تراعي ما يلي بدقة:
1. يوتيوب (YouTube):
   - عنوان جذاب لا يتجاوز 100 حرف ومحسن لمحركات البحث (SEO).
   - وصف مفصل يتضمن ملخص الفيديو وروابط وحث على التفاعل (Call to Action).
   - قائمة وسوم (tags) ذات صلة ومفصولة.
2. إنستغرام ريلز (Instagram Reels):
   - نص افتتاحي (Hook) قوي في أول سطرين قبل زر "المزيد".
   - 5 إلى 10 هاشتاغات فعالة ورائجة.
3. تيك توك (TikTok):
   - نص قصير مباشر وسريع التفاعل مع 3 إلى 6 هاشتاغات نشطة.

يجب إرجاع النتيجة بتنسيق JSON مطابق تماماً للهيكل المطلوب.`;

export function buildPublishingMetadataPrompt(params: {
  title: string;
  briefSummary?: string;
  scriptText?: string;
  platform?: string;
}): string {
  return `يرجى توليد بيانات النشر والتوزيع المحسنة للفيديو التالي:

عنوان الفيديو الأصلي: ${params.title}
${params.briefSummary ? `الملخص الإبداعي والجمهور: ${params.briefSummary}` : ''}
${params.scriptText ? `نص السيناريو والسرد: ${params.scriptText}` : ''}
${params.platform ? `المنصة المستهدفة الأساسية: ${params.platform}` : ''}

قم بتوليد كائن JSON بالهيكل التالي بدقة:
{
  "title": "عنوان رئيسي جذاب",
  "caption": "نص النشر الأساسي",
  "description": "الوصف المفصل ليوتيوب",
  "tags": ["وسم1", "وسم2", "وسم3"],
  "hashtags": ["#هاشتاغ1", "#هاشتاغ2", "#هاشتاغ3"],
  "privacy": "public",
  "youtube": {
    "title": "عنوان يوتيوب",
    "description": "وصف يوتيوب كامل",
    "tags": ["وسم1", "وسم2"],
    "categoryId": "22",
    "privacy": "public",
    "madeForKids": false
  },
  "instagram": {
    "caption": "نص منشور ريلز مع الهاشتاغات",
    "hashtags": ["#ريلز", "#فيديو"],
    "shareToFeed": true
  },
  "tiktok": {
    "caption": "نص تيك توك سريع #هاشتاغ",
    "privacy": "PUBLIC_TO_EVERYONE",
    "allowComments": true,
    "allowDuet": true,
    "allowStitch": true
  }
}`;
}
