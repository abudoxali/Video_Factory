import React from 'react';
import { listProjects, getOrCreateDefaultUser } from '@video-factory/database';
import { ProjectList } from './ProjectList';
import { FolderKanban } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'المشاريع | مصنع الفيديو Video Factory',
  description: 'إدارة مساحات عمل ومشاريع الفيديو',
};

export default async function ProjectsPage() {
  const user = await getOrCreateDefaultUser();
  const projects = await listProjects(user.id);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-2">
          <FolderKanban className="w-3.5 h-3.5" />
          <span>تنظيم مساحات العمل</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          المشاريع
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          قائمة مشاريع إنتاج الفيديو والمحتوى الرقمي المقترنة بحسابك
        </p>
      </div>

      <ProjectList initialProjects={projects} />
    </div>
  );
}
