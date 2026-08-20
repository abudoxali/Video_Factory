'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Clock,
  Smartphone,
  Tv,
  Square,
  Globe,
  Share2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import {
  STANDARD_DURATIONS,
  type VideoType,
  type VideoPlatform,
  type VideoAspectRatio,
  type VideoLanguage,
} from '@video-factory/contracts';

const platforms: { id: VideoPlatform; name: string; icon: string }[] = [
  { id: 'tiktok', name: 'TikTok', icon: '📱' },
  { id: 'instagram_reels', name: 'Instagram Reels', icon: '📸' },
  { id: 'youtube_shorts', name: 'YouTube Shorts', icon: '⚡' },
  { id: 'youtube', name: 'YouTube', icon: '▶️' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'x', name: 'X (Twitter)', icon: '𝕏' },
];

const aspectRatios: { id: VideoAspectRatio; label: string; desc: string; icon: LucideIcon }[] = [
  { id: '9:16', label: 'عمودي 9:16', desc: 'مناسب لـ Reels و TikTok و Shorts', icon: Smartphone },
  { id: '16:9', label: 'أفقي 16:9', desc: 'مناسب لـ YouTube والشاشات', icon: Tv },
  { id: '1:1', label: 'مربع 1:1', desc: 'مناسب لمنشورات Feed و LinkedIn', icon: Square },
];

export function CreateVideoForm() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [videoType, setVideoType] = useState<VideoType>('short');
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [customDurationInput, setCustomDurationInput] = useState<string>('45');
  const [platform, setPlatform] = useState<VideoPlatform>('tiktok');
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>('9:16');
  const [language, setLanguage] = useState<VideoLanguage>('ar');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!prompt || prompt.trim().length < 5) {
      setFormError('يرجى كتابة فكرة الفيديو بتفصيل أكثر (5 أحرف على الأقل).');
      return;
    }

    const finalDuration = isCustomDuration
      ? parseInt(customDurationInput, 10)
      : durationSeconds;

    if (isNaN(finalDuration) || finalDuration < 5 || finalDuration > 3600) {
      setFormError('يرجى تحديد مدة صالحة بين 5 ثوانٍ و 3600 ثانية.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        title: title.trim() || undefined,
        prompt: prompt.trim(),
        type: videoType,
        durationSeconds: finalDuration,
        platform,
        aspectRatio,
        language,
      };

      const res = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر إنشاء الفيديو، يرجى التحقق من البيانات والمحاولة ثانية.');
      }

      // Successful creation -> redirect to job status page
      router.push(data.redirectUrl || `/jobs/${data.job.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      setFormError(error.message || 'حدث خطأ غير متوقع أثناء إرسال الطلب.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {formError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-3 text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* 1. Video Idea / Prompt */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="prompt" className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>فكرة وموضوع الفيديو *</span>
          </label>
          <span className="text-xs text-slate-400 font-mono">{prompt.length} / 4000 حرف</span>
        </div>

        <textarea
          id="prompt"
          rows={4}
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="مثال: فيديو قصير يشرح 3 نصائح ذهبية لرواد الأعمال المبتدئين في إدارة الوقت والإنتاجية اليومية بنبرة حماسية ومشوقة..."
          className="w-full px-4 py-3 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y"
          disabled={isLoading}
        />

        <div>
          <label htmlFor="title" className="text-xs font-semibold text-slate-300 block mb-1.5">
            عنوان الفيديو (اختياري)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: 3 نصائح للإنتاجية"
            className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* 2. Video Type & Duration */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-sm">
        <div>
          <label className="text-base font-bold text-white block mb-3">نوع الفيديو</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setVideoType('short');
                setDurationSeconds(30);
                setIsCustomDuration(false);
                setAspectRatio('9:16');
              }}
              className={`p-4 rounded-xl border text-right transition-all ${
                videoType === 'short'
                  ? 'bg-blue-950/50 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-white">فيديو قصير (Short-Form)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300">15 - 60 ثانية</span>
              </div>
              <p className="text-xs text-slate-400">مثالي لمنصات TikTok، Reels، و Shorts لزيادة الانتشار السريع</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setVideoType('long');
                setDurationSeconds(180);
                setIsCustomDuration(false);
                setAspectRatio('16:9');
              }}
              className={`p-4 rounded-xl border text-right transition-all ${
                videoType === 'long'
                  ? 'bg-blue-950/50 border-blue-500 text-white shadow-sm ring-1 ring-blue-500'
                  : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm text-white">فيديو طويل (Long-Form)</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300">3 - 10 دقائق</span>
              </div>
              <p className="text-xs text-slate-400">ملائم لليوتيوب وشروحات الفيديو والمحتوى الوثائقي المعمق</p>
            </button>
          </div>
        </div>

        {/* Durations */}
        <div>
          <label className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>مدة الفيديو</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {STANDARD_DURATIONS.map((dur) => (
              <button
                key={dur.value}
                type="button"
                onClick={() => {
                  setDurationSeconds(dur.value);
                  setIsCustomDuration(false);
                }}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  !isCustomDuration && durationSeconds === dur.value
                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {dur.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsCustomDuration(true)}
              className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                isCustomDuration
                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              مدة مخصصة
            </button>
          </div>

          {isCustomDuration && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="number"
                min="5"
                max="3600"
                value={customDurationInput}
                onChange={(e) => setCustomDurationInput(e.target.value)}
                className="w-32 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-center font-mono text-white focus:outline-none focus:border-blue-500"
                placeholder="بالثواني"
              />
              <span className="text-xs text-slate-400">ثانية (بين 5 و 3600 ثانية)</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Target Platform & Aspect Ratio */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-sm">
        <div>
          <label className="text-base font-bold text-white flex items-center gap-2 mb-3">
            <Share2 className="w-4 h-4 text-slate-400" />
            <span>المنصة الأساسية</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  platform === p.id
                    ? 'bg-blue-950/60 border-blue-500 text-white ring-1 ring-blue-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xl mb-1">{p.icon}</div>
                <div className="text-xs font-semibold">{p.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-base font-bold text-white block mb-3">نسبة الأبعاد (Aspect Ratio)</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {aspectRatios.map((ar) => {
              const Icon = ar.icon;
              return (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setAspectRatio(ar.id)}
                  className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                    aspectRatio === ar.id
                      ? 'bg-blue-950/60 border-blue-500 text-white ring-1 ring-blue-500'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-white mb-0.5">{ar.label}</div>
                    <div className="text-xs text-slate-400">{ar.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-base font-bold text-white flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-slate-400" />
            <span>لغة الفيديو وسيناريو التوليد</span>
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="language"
                checked={language === 'ar'}
                onChange={() => setLanguage('ar')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-white">العربية (الفصحى الحديثة)</span>
            </label>

            <label className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="language"
                checked={language === 'en'}
                onChange={() => setLanguage('en')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-300">English (الإنجليزية)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-4 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="px-5 py-3 rounded-xl border border-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          إلغاء
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2.5 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري إرسال الطلب وحفظ البيانات...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>بدء توليد الفيديو والربط مع سير العمل</span>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
