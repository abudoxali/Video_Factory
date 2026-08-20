'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/40 text-rose-400 flex items-center justify-center shadow-lg">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-2xl font-bold text-white">حدث خطأ غير متوقع</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          تعذر إتمام العملية المطلوبة. يرجى المحاولة مرة أخرى أو مراجعة إدارة النظام.
        </p>
      </div>

      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
      >
        <RotateCw className="w-4 h-4" />
        <span>إعادة المحاولة</span>
      </button>
    </div>
  );
}
