import React from 'react';
import Link from 'next/link';
import { Video, Sparkles, LayoutDashboard, ArrowLeft, Cpu, Database } from 'lucide-react';
import { getDashboardStats } from '@video-factory/database';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-10 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 p-8 md:p-12 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>المرحلة الأولى — البنية الأساسية والتكامل مع n8n</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
            منصة أتمتة وإنتاج الفيديو الذكي باللغة العربية
          </h1>

          <p className="text-slate-300 text-base md:text-lg leading-relaxed">
            أنشئ مقاطع فيديو احترافية مخصصة للشبكات الاجتماعية (تيك توك، ريلز، شورتس) من خلال فكرة نصية واحدة، مربوطة مباشرة بمحرك الأتمتة n8n مع تتبع فوري لمراحل المعالجة.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/create"
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98]"
            >
              <Video className="w-4 h-4" />
              <span>بدء إنشاء فيديو جديد</span>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-200 font-semibold text-sm transition-all border border-slate-700"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>لوحة التحكم والمتابعة</span>
            </Link>
          </div>
        </div>

        {/* Decorative background grid effect */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"></div>
      </section>

      {/* Architecture Highlights */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center border border-blue-800/40">
            <Video className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">واجهة عربية أصيلة</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            تصميم مخصص بالكامل باتجاه اليمين إلى اليسار (RTL) مع خطوط ونصوص ومصطلحات احترافية ملائمة لسوق المحتوى العربي.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/40">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">ربط متين مع n8n</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            تكامل خادمي آمن مع سير العمل VF-00 مع التحقق من الهوية، منع تكرار الأحداث (Idempotency)، وإرجاع الحالات فورياً.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center border border-emerald-800/40">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">قاعدة بيانات PostgreSQL</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            هيكلية معاملات حقيقية عبر Drizzle ORM لتسجيل الفيديوهات، المهام، وسجل الأحداث المتراكم دون أي بيانات وهمية.
          </p>
        </div>
      </section>

      {/* Quick summary stats */}
      <section className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white">حالة المنظومة الحالية</h4>
          <p className="text-xs text-slate-400">بيانات حقيقية من قاعدة البيانات</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-xs text-slate-400">إجمالي الفيديوهات</p>
            <p className="text-lg font-bold text-white">{stats.totalVideos}</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center">
            <p className="text-xs text-slate-400">المهام النشطة</p>
            <p className="text-lg font-bold text-amber-400">{stats.activeJobs}</p>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center">
            <p className="text-xs text-slate-400">المكتملة بنجاح</p>
            <p className="text-lg font-bold text-emerald-400">{stats.completedVideos}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
