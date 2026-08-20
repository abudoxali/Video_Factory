import React from 'react';
import { notFound } from 'next/navigation';
import { getJobWithDetails } from '@video-factory/database';
import { JobStatusViewer } from './JobStatusViewer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'حالة مهمة الفيديو | مصنع الفيديو Video Factory',
  description: 'متابعة حية لمراحل توليد الفيديو وسير عمل n8n',
};

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const details = await getJobWithDetails(id);

  if (!details) {
    notFound();
  }

  return (
    <div className="py-4">
      <JobStatusViewer
        initialJob={details.job}
        initialVideo={details.video}
        initialEvents={details.events}
      />
    </div>
  );
}
