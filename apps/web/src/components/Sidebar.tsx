'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Video, FolderKanban, Sparkles, Activity, Share2 } from 'lucide-react';

const navigationItems = [
  {
    name: 'لوحة التحكم',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'إنشاء فيديو',
    href: '/create',
    icon: Video,
  },
  {
    name: 'المشاريع',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    name: 'الحسابات والمنصات',
    href: '/settings/social',
    icon: Share2,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900/90 border-l border-slate-800 flex flex-col shrink-0 min-h-screen">
      {/* Brand / Logo */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-900/30">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base tracking-wide text-white">مصنع الفيديو</h1>
          <p className="text-xs text-slate-400">Video Factory AI</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status indicator footer */}
      <div className="p-4 border-t border-slate-800/80 m-4 rounded-xl bg-slate-950/40 border">
        <div className="flex items-center gap-2 mb-1.5">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">حالة الربط مع n8n</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          سير العمل VF-00 جاهز لاستقبال مهام الإنتاج والتوجيه التكاملي.
        </p>
      </div>
    </aside>
  );
}
