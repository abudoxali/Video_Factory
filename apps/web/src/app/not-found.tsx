import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center shadow-lg">
        <AlertTriangle className="w-8 h-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold text-white">الصفحة أو المهمة غير موجودة</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          عذراً، الرابط الذي تحاول الوصول إليه غير موجود أو تم نقله.
        </p>
      </div>

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
      >
        <Home className="w-4 h-4" />
        <span>العودة إلى لوحة التحكم</span>
      </Link>
    </div>
  );
}
