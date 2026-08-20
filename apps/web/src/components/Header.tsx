'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export function Header() {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>منظومة المعالجة جاهزة</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-md shadow-blue-900/30 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء فيديو جديد</span>
        </Link>
      </div>
    </header>
  );
}
