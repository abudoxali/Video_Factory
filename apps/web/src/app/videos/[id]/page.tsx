import React from 'react';
import { notFound } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/session';
import {
  getVideoPlanDetails,
  getVideoMediaAssets,
  getVideoRenders,
  getSocialAccounts,
  getVideoPublications,
  getVideoAnalyticsSummary,
} from '@video-factory/database';
import { VideoPlanReviewer } from './VideoPlanReviewer';

export const dynamic = 'force-dynamic';

export default async function VideoPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  const userId = user?.userId || 'usr_dev_default';

  const planDetails = await getVideoPlanDetails(id);

  if (!planDetails || !planDetails.video) {
    notFound();
  }

  const rawAssets = await getVideoMediaAssets(id);
  const rawRenders = await getVideoRenders(id);
  const rawSocialAccounts = await getSocialAccounts(userId);
  const rawPublications = await getVideoPublications(id, userId);
  const rawAnalyticsSummary = await getVideoAnalyticsSummary(id, userId);

  // Format serializable plan object for client component
  const serializablePlan = {
    video: {
      ...planDetails.video,
      approvedAt: planDetails.video.approvedAt ? planDetails.video.approvedAt.toISOString() : null,
      createdAt: planDetails.video.createdAt ? planDetails.video.createdAt.toISOString() : '',
      updatedAt: planDetails.video.updatedAt ? planDetails.video.updatedAt.toISOString() : '',
    },
    brief: planDetails.brief
      ? {
          ...planDetails.brief,
          createdAt: planDetails.brief.createdAt ? planDetails.brief.createdAt.toISOString() : '',
          updatedAt: planDetails.brief.updatedAt ? planDetails.brief.updatedAt.toISOString() : '',
          keyPoints: Array.isArray(planDetails.brief.keyPoints)
            ? (planDetails.brief.keyPoints as string[])
            : [],
          constraints: Array.isArray(planDetails.brief.constraints)
            ? (planDetails.brief.constraints as string[])
            : [],
        }
      : null,
    script: planDetails.script
      ? {
          ...planDetails.script,
          createdAt: planDetails.script.createdAt ? planDetails.script.createdAt.toISOString() : '',
          updatedAt: planDetails.script.updatedAt ? planDetails.script.updatedAt.toISOString() : '',
          sections: Array.isArray(planDetails.script.sections)
            ? (planDetails.script.sections as Array<{ id: string; title: string; narration: string; targetDurationSeconds: number }>)
            : [],
        }
      : null,
    chapters: planDetails.chapters.map((ch) => ({
      ...ch,
      createdAt: ch.createdAt ? ch.createdAt.toISOString() : '',
      updatedAt: ch.updatedAt ? ch.updatedAt.toISOString() : '',
    })),
    scenes: planDetails.scenes.map((sc) => ({
      ...sc,
      mediaStrategy: (sc.mediaStrategy || 'AI_VIDEO') as any,
      mediaState: (sc.mediaState || 'PENDING') as any,
      status: (sc.status || 'PLANNED') as any,
      createdAt: sc.createdAt ? sc.createdAt.toISOString() : '',
      updatedAt: sc.updatedAt ? sc.updatedAt.toISOString() : '',
    })),
    assets: rawAssets.map((ast) => ({
      ...ast,
      type: ast.type as any,
      source: ast.source as any,
      status: ast.status as any,
      durationSeconds: ast.durationSeconds ? parseFloat(ast.durationSeconds) : null,
      metadata: (ast.metadata as Record<string, unknown>) || null,
      createdAt: ast.createdAt ? ast.createdAt.toISOString() : '',
      updatedAt: ast.updatedAt ? ast.updatedAt.toISOString() : '',
    })),
    renders: rawRenders.map((rnd) => ({
      ...rnd,
      durationSeconds: rnd.durationSeconds ? parseFloat(rnd.durationSeconds) : null,
      sizeBytes: rnd.sizeBytes || null,
      createdAt: rnd.createdAt ? rnd.createdAt.toISOString() : '',
      completedAt: rnd.completedAt ? rnd.completedAt.toISOString() : null,
      updatedAt: rnd.updatedAt ? rnd.updatedAt.toISOString() : '',
    })),
    socialAccounts: rawSocialAccounts.map((acc) => ({
      id: acc.id,
      platform: acc.platform as any,
      displayName: acc.displayName || acc.platformUsername || 'قناة متصلة',
      status: acc.status,
    })),
    publications: rawPublications.map((pub) => ({
      ...pub,
      metadataJson: pub.metadataJson as any,
      createdAt: pub.createdAt ? pub.createdAt.toISOString() : '',
      startedAt: pub.startedAt ? pub.startedAt.toISOString() : null,
      publishedAt: pub.publishedAt ? pub.publishedAt.toISOString() : null,
      updatedAt: pub.updatedAt ? pub.updatedAt.toISOString() : '',
    })),
    analyticsSummary: rawAnalyticsSummary.map((item) => ({
      publication: {
        ...item.publication,
        createdAt: item.publication.createdAt ? item.publication.createdAt.toISOString() : '',
      },
      latestSnapshot: item.latestSnapshot
        ? {
            ...item.latestSnapshot,
            watchTimeSeconds: item.latestSnapshot.watchTimeSeconds
              ? parseFloat(item.latestSnapshot.watchTimeSeconds)
              : null,
            averageViewDurationSeconds: item.latestSnapshot.averageViewDurationSeconds
              ? parseFloat(item.latestSnapshot.averageViewDurationSeconds)
              : null,
            capturedAt: item.latestSnapshot.capturedAt
              ? item.latestSnapshot.capturedAt.toISOString()
              : '',
            createdAt: item.latestSnapshot.createdAt
              ? item.latestSnapshot.createdAt.toISOString()
              : '',
          }
        : null,
    })),
    totalDurationSeconds: planDetails.totalDurationSeconds,
    isApproved: planDetails.isApproved,
  };

  return <VideoPlanReviewer initialPlan={serializablePlan} />;
}
