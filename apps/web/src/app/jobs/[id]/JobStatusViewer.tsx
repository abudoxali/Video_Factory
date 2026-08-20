'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Layers,
  ChevronRight,
  Info,
  Film,
} from 'lucide-react';
import {
  getArabicJobStage,
  isTerminalStatus,
  type JobStatus,
  ArabicPlatformMap,
  ArabicVideoTypeMap,
} from '@video-factory/contracts';
import { StatusBadge } from '@/components/StatusBadge';

interface JobEventItem {
  id: string;
  eventId: string;
  eventType: string;
  stage: string;
  progress: number;
  message: string | null;
  createdAt: string | Date;
}

interface JobData {
  id: string;
  videoId: string;
  status: string;
  progress: number;
  currentStage: string;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
}

interface VideoData {
  id: string;
  title: string;
  prompt: string;
  type: string;
  durationSeconds: number;
  platform: string;
  aspectRatio: string;
  language: string;
}

interface JobStatusViewerProps {
  initialJob: JobData;
  initialVideo: VideoData | null;
  initialEvents: JobEventItem[];
}

export function JobStatusViewer({
  initialJob,
  initialVideo,
  initialEvents,
}: JobStatusViewerProps) {
  const [job, setJob] = useState<JobData>(initialJob);
  const [video, setVideo] = useState<VideoData | null>(initialVideo);
  const [events, setEvents] = useState<JobEventItem[]>(initialEvents);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const fetchJobStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = await res.json();
      if (data.success && data.job) {
        setJob(data.job);
        if (data.video) setVideo(data.video);
        if (data.events) setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to poll job status:', error);
    }
  }, [job.id]);

  // Controlled polling: every 3.5 seconds while NOT in terminal state
  useEffect(() => {
    if (isTerminalStatus(job.status as JobStatus)) {
      return; // Terminal state reached -> stop polling
    }

    const intervalId = setInterval(() => {
      fetchJobStatus();
    }, 3500);

    return () => clearInterval(intervalId);
  }, [job.status, fetchJobStatus]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchJobStatus();
    setIsRefreshing(false);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/start`, { method: 'POST' });
      const data = await res.json();
      setRetryMessage(data.message || 'تم إرسال طلب إعادة التشغيل');
      await fetchJobStatus();
    } catch {
      setRetryMessage('تعذر إعادة تشغيل المهمة');
    } finally {
      setIsRetrying(false);
    }
  };

  const isCompleted = job.status === 'COMPLETED';
  const isFailed = job.status === 'FAILED';
  const isPlanReady = job.currentStage === 'PLAN_READY' || isCompleted;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            لوحة التحكم
          </Link>
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          <span className="text-slate-200">حالة المهمة</span>
          <span className="font-mono text-slate-500 text-[11px]">({job.id})</span>
        </div>

        <div className="flex items-center gap-3">
          {isPlanReady && (
            <Link
              href={`/videos/${job.videoId}`}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/60"
            >
              <Film className="w-3.5 h-3.5" />
              <span>مراجعة واعتماد الخطة</span>
            </Link>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث يدوي</span>
          </button>

          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>إعادة تشغيل المهمة</span>
            </button>
          )}
        </div>
      </div>

      {retryMessage && (
        <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>{retryMessage}</span>
        </div>
      )}

      {/* Main Status Hero Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <StatusBadge status={job.status} className="text-sm px-3 py-1" />
              <span className="text-xs text-slate-400 font-mono">
                المرحلة: {getArabicJobStage(job.currentStage)}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white mt-1">
              {video?.title || 'طلب إنشاء فيديو'}
            </h1>
          </div>

          <div className="text-left md:text-left">
            <div className="text-3xl md:text-4xl font-extrabold text-white font-mono">
              {job.progress}%
            </div>
            <div className="text-xs text-slate-400 mt-0.5">نسبة الإنجاز الإجمالية</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isCompleted
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                  : isFailed
                  ? 'bg-rose-600'
                  : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400'
              }`}
              style={{ width: `${Math.max(job.progress, 5)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>البداية (استلام الطلب)</span>
            <span className="text-slate-300 font-medium">
              {getArabicJobStage(job.currentStage)}
            </span>
            <span>الانتهاء والتسليم</span>
          </div>
        </div>

        {/* Failure alert banner */}
        {isFailed && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="w-4 h-4" />
              <span>فشلت معالجة المهمة</span>
            </div>
            <p className="text-rose-300/80 leading-relaxed">
              {job.errorMessage || 'حدث خطأ أثناء معالجة سير العمل في n8n، يمكنك إعادة المحاولة.'}
            </p>
          </div>
        )}

        {/* Success completion banner */}
        {isCompleted && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم إعداد وتخطيط خطة الفيديو بنجاح</span>
              </div>
              <Link
                href={`/videos/${job.videoId}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
              >
                <span>الانتقال للمراجعة ←</span>
              </Link>
            </div>
            <p className="text-emerald-300/80 leading-relaxed">
              تم إعداد التوجيه الإبداعي وكتابة السيناريو وتوزيع المشاهد مع المطابقة الزمنية، يمكنك الآن فحص الخطة وتعديلها واعتمادها للإنتاج.
            </p>
          </div>
        )}
      </div>

      {/* Grid: Video Details (1/3) + Event History Timeline (2/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Request Metadata */}
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5 h-fit">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>بيانات طلب الفيديو</span>
          </h3>

          {video && (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">فكرة الفيديو:</span>
                <p className="text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                  {video.prompt}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">المنصة:</span>
                  <span className="text-slate-200 font-semibold">
                    {ArabicPlatformMap[video.platform as keyof typeof ArabicPlatformMap] || video.platform}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">النوع:</span>
                  <span className="text-slate-200 font-semibold">
                    {ArabicVideoTypeMap[video.type as keyof typeof ArabicVideoTypeMap] || video.type}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">المدة:</span>
                  <span className="text-slate-200 font-semibold">{video.durationSeconds} ثانية</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-500 block text-[11px]">الأبعاد:</span>
                  <span className="text-slate-200 font-semibold">{video.aspectRatio}</span>
                </div>
              </div>

              {isPlanReady && (
                <div className="pt-2">
                  <Link
                    href={`/videos/${job.videoId}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-xs transition-all shadow"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>عرض ومراجعة خطة المشاهد</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Event Timeline */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>سجل أحداث المعالجة والتخطيط</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{events.length} أحداث مسجلة</span>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              لم يتم تسجيل أي أحداث حتى الآن
            </div>
          ) : (
            <div className="relative pr-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:right-1.5 before:w-0.5 before:bg-slate-800">
              {events.map((evt, idx) => {
                const isLast = idx === events.length - 1;
                return (
                  <div key={evt.id} className="relative flex items-start gap-4">
                    {/* Node Dot */}
                    <div
                      className={`absolute right-[-14px] top-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        isLast
                          ? 'bg-blue-500 ring-2 ring-blue-500/30'
                          : 'bg-slate-600'
                      }`}
                    />

                    {/* Content Box */}
                    <div className="flex-1 mr-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">
                            {getArabicJobStage(evt.stage)}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {evt.progress}%
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {new Date(evt.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      {evt.message && (
                        <p className="text-xs text-slate-300 leading-relaxed">{evt.message}</p>
                      )}

                      <div className="text-[10px] font-mono text-slate-600 pt-1">
                        event_id: {evt.eventId}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
