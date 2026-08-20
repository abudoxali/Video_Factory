import { z } from 'zod';

export const JobStatusEnum = z.enum([
  'DRAFT',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export type JobStatus = z.infer<typeof JobStatusEnum>;

export const PlanStatusEnum = z.enum([
  'PENDING',
  'GENERATING',
  'READY_FOR_REVIEW',
  'APPROVED',
  'STALE',
]);

export type PlanStatus = z.infer<typeof PlanStatusEnum>;

export const JobStageEnum = z.enum([
  'RECEIVED',
  'INITIALIZING',
  'VALIDATING',
  'AI_DIRECTOR',
  'SCRIPT_GENERATION',
  'CHAPTER_PLANNING',
  'SCENE_PLANNING',
  'PLAN_VALIDATION',
  'PLAN_READY',
  // Phase 03 Media Stages
  'MEDIA_PREPARATION',
  'IMAGE_GENERATION',
  'VIDEO_GENERATION',
  'VOICE_GENERATION',
  'ASSET_STORAGE',
  'MEDIA_VALIDATION',
  'MEDIA_READY',
  // Phase 04 Rendering & Assembly Stages
  'RENDER_PREPARATION',
  'RENDERING',
  'FINAL_ASSEMBLY',
  'FINAL_QA',
  'RENDER_READY',
  'ORCHESTRATING',
  'CORE_TEST',
  'FINISHED',
  'ERROR',
]);

export type JobStage = z.infer<typeof JobStageEnum>;

export const ArabicJobStatusMap: Record<JobStatus, string> = {
  DRAFT: 'مسودة',
  QUEUED: 'في قائمة الانتظار',
  PROCESSING: 'جاري التنفيذ',
  COMPLETED: 'مكتمل',
  FAILED: 'فشل',
  CANCELLED: 'تم الإلغاء',
};

export const ArabicPlanStatusMap: Record<PlanStatus, string> = {
  PENDING: 'قيد الانتظار',
  GENERATING: 'جاري التوليد',
  READY_FOR_REVIEW: 'جاهز للمراجعة',
  APPROVED: 'معتمد للإنتاج',
  STALE: 'بحاجة لتحديث',
};

export const ArabicJobStageMap: Record<string, string> = {
  RECEIVED: 'تم استلام الطلب',
  INITIALIZING: 'تهيئة بيئة المعالجة',
  VALIDATING: 'التحقق من المعطيات',
  AI_DIRECTOR: 'تحليل الفكرة والتوجيه الإبداعي',
  SCRIPT_GENERATION: 'كتابة السيناريو والنص',
  CHAPTER_PLANNING: 'تخطيط فصول الفيديو',
  SCENE_PLANNING: 'تخطيط وتوزيع المشاهد',
  PLAN_VALIDATION: 'مراجعة ومطابقة خطة الإنتاج',
  PLAN_READY: 'خطة الفيديو جاهزة للمراجعة',
  // Phase 03 Media Generation
  MEDIA_PREPARATION: 'تجهيز وتوزيع خطة الوسائط',
  IMAGE_GENERATION: 'إنشاء وتوليد الصور',
  VIDEO_GENERATION: 'إنشاء وتوليد مشاهد الفيديو',
  VOICE_GENERATION: 'توليد التعليق الصوتي والسرد',
  ASSET_STORAGE: 'حفظ وتخزين الوسائط في R2',
  MEDIA_VALIDATION: 'التحقق من سلامة ومطابقة الوسائط',
  MEDIA_READY: 'الوسائط جاهزة للاستعراض والمراجعة',
  // Phase 04 Rendering & Assembly
  RENDER_PREPARATION: 'تجهيز مخطط وتوقيتات الإخراج',
  RENDERING: 'جاري تصيير وإخراج مقاطع الفيديو',
  FINAL_ASSEMBLY: 'تجميع الطبقات البصرية والصوتية والنصوص',
  FINAL_QA: 'فحص واعتماد جودة الفيديو النهائي MP4',
  RENDER_READY: 'الفيديو النهائي جاهز للمشاهدة والتحميل',
  ORCHESTRATING: 'توجيه المهمة عبر سير العمل',
  CORE_TEST: 'فحص الاتصال التكاملي',
  FINISHED: 'اكتملت المعالجة بنجاح',
  ERROR: 'حدث خطأ أثناء المعالجة',
};

export function getArabicJobStatus(status: string): string {
  return ArabicJobStatusMap[status as JobStatus] || status;
}

export function getArabicPlanStatus(status: string): string {
  return ArabicPlanStatusMap[status as PlanStatus] || status;
}

export function getArabicJobStage(stage: string): string {
  return ArabicJobStageMap[stage] || stage;
}

/**
 * Canonical state machine allowed transitions
 */
export const AllowedStatusTransitions: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['QUEUED', 'CANCELLED'],
  QUEUED: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [], // Terminal
  FAILED: ['QUEUED'], // Retry allowed
  CANCELLED: [], // Terminal
};

export function canTransitionStatus(
  currentStatus: JobStatus,
  nextStatus: JobStatus
): boolean {
  if (currentStatus === nextStatus) {
    return true; // Idempotent self-transition
  }
  const allowed = AllowedStatusTransitions[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function isTerminalStatus(status: JobStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}
