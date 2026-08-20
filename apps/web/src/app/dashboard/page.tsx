import React from 'react';
import Link from 'next/link';
import {
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { getDashboardStats, listVideos, listRecentJobs } from '@video-factory/database';
import { StatusBadge } from '@/components/StatusBadge';
import { ArabicPlatformMap, ArabicVideoTypeMap } from '@video-factory/contracts';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const recentVideos = await listVideos({ limit: 8 });
  const recentJobs = await listRecentJobs(6);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">لوحة التحكم</h1>
          <p className="text-sm text-slate-400 mt-1">
            نظرة شاملة على مهام إنتاج الفيديو وحالات التكامل مع سير العمل
          </p>
        </div>

        <Link
          href="/create"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md shadow-blue-900/30 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء فيديو جديد</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">إجمالي الفيديوهات</span>
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/40 text-blue-400 flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white">{stats.totalVideos}</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">المهام النشطة</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800/40 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-400">{stats.activeJobs}</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الفيديوهات المكتملة</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400">{stats.completedVideos}</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">المهام الفاشلة</span>
            <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/40 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-400">{stats.failedVideos}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Videos Table (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">أحدث طلبات الفيديو</h2>
            <Link
              href="/create"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>طلب جديد</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentVideos.length === 0 ? (
            <div className="p-10 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                <Video className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">لا توجد فيديوهات حتى الآن</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  ابدأ بإنشاء أول فيديو لك بالذكاء الاصطناعي وسيتم إدراجه ومتابعته هنا فورياً.
                </p>
              </div>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إنشاء أول فيديو</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">عنوان الفيديو / الفكرة</th>
                      <th className="py-3.5 px-4">المنصة</th>
                      <th className="py-3.5 px-4">النوع والمدة</th>
                      <th className="py-3.5 px-4">الحالة</th>
                      <th className="py-3.5 px-4 text-left">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {recentVideos.map(({ video, job }) => (
                      <tr key={video.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-white line-clamp-1">{video.title}</p>
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{video.prompt}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {ArabicPlatformMap[video.platform as keyof typeof ArabicPlatformMap] || video.platform}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          <div>{ArabicVideoTypeMap[video.type as keyof typeof ArabicVideoTypeMap] || video.type}</div>
                          <div>{video.durationSeconds} ثانية</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={job?.status || video.status} />
                        </td>
                        <td className="py-3.5 px-4 text-left">
                          {job ? (
                            <Link
                              href={`/jobs/${job.id}`}
                              className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              متابعة المهمة ←
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Active / Recent Jobs Timeline (1 col) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">حالة المهام الحديثة</h2>

          {recentJobs.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
              <Clock className="w-6 h-6 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400">لا توجد مهام معالجة مسجلة حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map(({ job, video }) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={job.status} />
                    <span className="text-xs text-slate-400 font-mono">{job.progress}%</span>
                  </div>

                  <p className="text-sm font-semibold text-white line-clamp-1 mb-1">{video.title}</p>
                  <p className="text-xs text-slate-400 line-clamp-1">{video.prompt}</p>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : job.status === 'FAILED'
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
