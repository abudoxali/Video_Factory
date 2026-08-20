import React from 'react';
import { CreateVideoForm } from './CreateVideoForm';
import { Sparkles } from 'lucide-react';

export const metadata = {
  title: 'إنشاء فيديو جديد | مصنع الفيديو Video Factory',
  description: 'اطلب إنشاء فيديو ذكي مخصص للشبكات الاجتماعية',
};

export default function CreateVideoPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-slate-800 pb-5">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>توليد فيديو جديد بالذكاء الاصطناعي</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          إنشاء فيديو احترافي
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          أدخل الفكرة وحدد المنصة والمدة المطلوبة لتشغيل سير العمل الآلي عبر n8n
        </p>
      </div>

      <CreateVideoForm />
    </div>
  );
}
