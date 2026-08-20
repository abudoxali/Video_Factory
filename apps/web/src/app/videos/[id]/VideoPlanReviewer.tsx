'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  FileText,
  Film,
  Compass,
  Check,
  Sparkles,
  Image as ImageIcon,
  Volume2,
  Play,
  RefreshCw,
  Video,
  ShieldCheck,
  Layers,
  Share2,
  BarChart3,
  ExternalLink,
  Send,
  Eye,
  ThumbsUp,
  MessageSquare,
  Repeat,
} from 'lucide-react';
import {
  getArabicPlanStatus,
  getArabicMediaStrategy,
  getArabicSceneMediaState,
  getArabicRenderStatus,
  getArabicPublicationStatus,
  ArabicPlatformMap,
  ArabicVideoTypeMap,
  ArabicSocialPlatformMap,
  type Scene,
  type MediaAsset,
  type SceneMediaState,
  type SocialPlatform,
  type PublicationMetadata,
} from '@video-factory/contracts';

interface VideoPlanReviewerProps {
  initialPlan: {
    video: {
      id: string;
      title: string;
      prompt: string;
      type: string;
      durationSeconds: number;
      platform: string;
      aspectRatio: string;
      language: string;
      planStatus: string;
      approvedAt?: string | null;
    };
    brief: {
      id: string;
      workingTitle: string;
      coreIdea: string;
      objective: string;
      targetAudience: string;
      tone: string;
      contentAngle: string;
      hookStrategy: string;
      narrativeStyle: string;
      visualDirection: string;
      pacing: string;
      callToAction?: string | null;
      keyPoints: string[];
      constraints: string[];
      requiresResearch?: boolean;
    } | null;
    script: {
      id: string;
      title: string;
      hook: string;
      fullNarration: string;
      estimatedWordCount: number;
      estimatedDurationSeconds: number;
      callToAction?: string | null;
      sections: Array<{ id: string; title: string; narration: string; targetDurationSeconds: number }>;
    } | null;
    chapters: Array<{
      id: string;
      position: number;
      title: string;
      purpose: string;
      summary: string;
      targetDurationSeconds: number;
    }>;
    scenes: Array<Scene & { id: string; mediaState?: SceneMediaState }>;
    assets?: Array<MediaAsset & { id: string; createdAt: string }>;
    renders?: Array<{
      id: string;
      videoId: string;
      version: number;
      status: string;
      width: number;
      height: number;
      fps: number;
      durationSeconds: number | null;
      objectKey: string | null;
      sizeBytes: number | null;
      checksum: string | null;
      createdAt: string;
      completedAt: string | null;
    }>;
    socialAccounts?: Array<{
      id: string;
      platform: SocialPlatform;
      displayName: string;
      status: string;
    }>;
    publications?: Array<{
      id: string;
      platform: string;
      status: string;
      platformPublicationId?: string | null;
      platformUrl?: string | null;
      metadataJson: any;
      createdAt: string;
      publishedAt?: string | null;
    }>;
    analyticsSummary?: Array<{
      publication: any;
      latestSnapshot: any;
    }>;
    totalDurationSeconds: number;
    isApproved: boolean;
  };
}

export function VideoPlanReviewer({ initialPlan }: VideoPlanReviewerProps) {
  const [video, setVideo] = useState(initialPlan.video);
  const [brief] = useState(initialPlan.brief);
  const [script, setScript] = useState(initialPlan.script);
  const [scenes, setScenes] = useState(initialPlan.scenes || []);
  const [assets, setAssets] = useState<any[]>(initialPlan.assets || []);
  const [renders, setRenders] = useState<any[]>(initialPlan.renders || []);
  const [socialAccounts] = useState<any[]>(initialPlan.socialAccounts || []);
  const [publications, setPublications] = useState<any[]>(initialPlan.publications || []);
  const [analyticsSummary, setAnalyticsSummary] = useState<any[]>(initialPlan.analyticsSummary || []);

  const hasReadyRender = (initialPlan.renders || []).some((r) => r.status === 'READY');
  const hasPublications = (initialPlan.publications || []).length > 0;

  const [activeTab, setActiveTab] = useState<'publish' | 'analytics' | 'render' | 'media' | 'scenes' | 'script' | 'brief' | 'chapters'>(
    hasPublications ? 'publish' : hasReadyRender ? 'render' : initialPlan.video.planStatus === 'APPROVED' ? 'media' : 'scenes'
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(video.title);
  const [editedScriptText, setEditedScriptText] = useState(script?.fullNarration || '');
  const [editedScenes, setEditedScenes] = useState<Scene[]>(initialPlan.scenes || []);

  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Publishing form state
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['YOUTUBE']);
  const [selectedAccounts, setSelectedAccounts] = useState<Record<string, string>>(() => {
    const accMap: Record<string, string> = {};
    (initialPlan.socialAccounts || []).forEach((acc) => {
      if (acc.status === 'CONNECTED' && !accMap[acc.platform]) {
        accMap[acc.platform] = acc.id;
      }
    });
    return accMap;
  });

  const [publishMetadata, setPublishMetadata] = useState<PublicationMetadata>({
    title: video.title,
    caption: `${video.title} | شاهد المحتوى المميز`,
    description: `${video.title}\n\nتم الإنتاج عبر Video Factory`,
    tags: ['فيديو', 'ذكاء_اصطناعي'],
    hashtags: ['#فيديو', '#محتوى_عربي', '#ريلز'],
    privacy: 'public',
  });

  const isApproved = video.planStatus === 'APPROVED';
  const activeRender = renders.find((r) => r.status === 'READY') || renders[0];

  const handleSaveEdits = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          scriptText: editedScriptText,
          scenes: editedScenes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'تعذر حفظ التعديلات');

      setVideo((prev) => ({ ...prev, title: editedTitle }));
      if (script) setScript((prev) => (prev ? { ...prev, fullNarration: editedScriptText } : null));
      setScenes(data.data?.scenes || editedScenes);
      setIsEditing(false);
      setStatusMessage({ type: 'success', text: 'تم حفظ التعديلات بنجاح' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprovePlan = async () => {
    setIsApproving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/plan/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'تعذر اعتماد الخطة');

      setVideo((prev) => ({ ...prev, planStatus: 'APPROVED', approvedAt: new Date().toISOString() }));
      setActiveTab('media');
      setStatusMessage({ type: 'success', text: 'تم اعتماد خطة الإنتاج بنجاح! تم فتح استوديو الوسائط.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء اعتماد الخطة' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleGenerateMediaPipeline = async () => {
    setIsGeneratingMedia(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/media/generate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'تعذر توليد الوسائط');

      const mediaRes = await fetch(`/api/videos/${video.id}/media`);
      const mediaData = await mediaRes.json();
      if (mediaData.success) {
        if (mediaData.data.scenes) setScenes(mediaData.data.scenes);
        if (mediaData.data.assets) setAssets(mediaData.data.assets);
      }
      setStatusMessage({ type: 'success', text: 'تم توليد وتخزين وسائط المشاهد والتعليق الصوتي بنجاح في R2!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء توليد الوسائط' });
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  const handleStartRender = async () => {
    setIsRendering(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/render`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشل إخراج الفيديو');

      const renderRes = await fetch(`/api/videos/${video.id}/render`);
      const renderData = await renderRes.json();
      if (renderData.success && renderData.data) {
        setRenders(renderData.data.renders || []);
      }
      setActiveTab('render');
      setStatusMessage({ type: 'success', text: 'تم إخراج وتجميع الفيديو النهائي بنجاح وتخزينه في R2!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء إخراج الفيديو' });
    } finally {
      setIsRendering(false);
    }
  };

  const handleGenerateAiMetadata = async () => {
    setIsGeneratingMeta(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/publishing/metadata`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) throw new Error(data.error || 'تعذر توليد البيانات');

      setPublishMetadata(data.data);
      setStatusMessage({ type: 'success', text: 'تم توليد وصياغة بيانات النشر الذكية بنجاح!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء توليد بيانات النشر' });
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const handlePublishToPlatforms = async () => {
    if (selectedPlatforms.length === 0) {
      alert('يرجى تحديد منصة واحدة على الأقل للنشر');
      return;
    }

    setIsPublishing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/publishing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          accountIds: selectedAccounts,
          metadata: publishMetadata,
          renderId: activeRender?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'فشلت عملية النشر');

      // Refresh publications
      const pubsRes = await fetch(`/api/videos/${video.id}/publishing`);
      const pubsData = await pubsRes.json();
      if (pubsData.success) {
        setPublications(pubsData.data || []);
      }

      setStatusMessage({ type: 'success', text: 'تم إرسال طلبات النشر بنجاح إلى المنصات المحددة!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء النشر' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRefreshAnalytics = async () => {
    setIsRefreshingAnalytics(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/videos/${video.id}/analytics`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'تعذر تحديث الإحصاءات');

      setAnalyticsSummary(data.data || []);
      setStatusMessage({ type: 'success', text: 'تم تحديث وسحب أحدث مؤشرات الأداء من المنصات!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء تحديث الإحصاءات' });
    } finally {
      setIsRefreshingAnalytics(false);
    }
  };

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const totalCalculatedDuration = (isEditing ? editedScenes : scenes).reduce(
    (sum, s) => sum + s.durationSeconds,
    0
  );

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-white transition-colors">
            لوحة التحكم
          </Link>
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          <Link href={`/jobs/${video.id}`} className="hover:text-white transition-colors">
            حالة المهمة
          </Link>
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          <span className="text-slate-200 font-semibold">استوديو الخطة والإنتاج</span>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedScenes(scenes);
                  setEditedTitle(video.title);
                  setEditedScriptText(script?.fullNarration || '');
                }}
                disabled={isSaving}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-all"
              >
                إلغاء التعديل
              </button>
              <button
                onClick={handleSaveEdits}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                <span>تعديل يدوي</span>
              </button>

              {activeRender && activeRender.status === 'READY' ? (
                <button
                  onClick={() => setActiveTab('publish')}
                  className="inline-flex items-center gap-2 px-5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/60"
                >
                  <Share2 className="w-4 h-4" />
                  <span>النشر والتوزيع</span>
                </button>
              ) : !isApproved ? (
                <button
                  onClick={handleApprovePlan}
                  disabled={isApproving || scenes.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/60 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isApproving ? 'جاري الاعتماد...' : 'اعتماد الخطة للإنتاج'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStartRender}
                  disabled={isRendering}
                  className="inline-flex items-center gap-2 px-5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/60 disabled:opacity-50"
                >
                  <Video className={`w-4 h-4 ${isRendering ? 'animate-spin' : ''}`} />
                  <span>{isRendering ? 'جاري إخراج وتجميع الفيديو...' : 'إخراج الفيديو النهائي'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border-rose-800 text-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Hero Header Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-md text-xs font-bold border ${
                  isApproved
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : 'bg-blue-950/80 text-blue-300 border-blue-700/60'
                }`}
              >
                {getArabicPlanStatus(video.planStatus)}
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs">
                {ArabicPlatformMap[video.platform as keyof typeof ArabicPlatformMap] || video.platform}
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs">
                {ArabicVideoTypeMap[video.type as keyof typeof ArabicVideoTypeMap] || video.type}
              </span>

              <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">
                {video.aspectRatio}
              </span>
            </div>

            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full text-xl md:text-2xl font-extrabold text-white bg-slate-950 px-3 py-2 rounded-lg border border-blue-500 focus:outline-none"
              />
            ) : (
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
                {video.title}
              </h1>
            )}

            <p className="text-xs text-slate-400 line-clamp-2">
              <span className="text-slate-500">الفكرة الأصلية: </span>
              {video.prompt}
            </p>
          </div>

          {/* KPI Mini-metrics */}
          <div className="flex items-center gap-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 self-start md:self-auto">
            <div className="text-center px-2">
              <div className="text-2xl font-extrabold text-white font-mono">{scenes.length}</div>
              <div className="text-[11px] text-slate-400">مشاهد مخططة</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                {publications.filter((p) => p.status === 'PUBLISHED').length}
              </div>
              <div className="text-[11px] text-slate-400">منشورات منشورة</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div className="text-center px-2">
              <div className="text-2xl font-extrabold text-blue-400 font-mono">
                {totalCalculatedDuration}s
              </div>
              <div className="text-[11px] text-slate-400">المدة الإجمالية</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          {/* Phase 05 Publishing Tab */}
          <button
            onClick={() => setActiveTab('publish')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'publish'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Share2 className="w-4 h-4 text-cyan-300" />
            <span>النشر والتوزيع ({publications.length})</span>
          </button>

          {/* Phase 05 Analytics Tab */}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-300" />
            <span>الأداء والإحصاءات</span>
          </button>

          {/* Phase 04 Final Video Tab */}
          <button
            onClick={() => setActiveTab('render')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'render'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Video className="w-4 h-4 text-emerald-300" />
            <span>الفيديو النهائي والتجميع ({renders.length})</span>
          </button>

          {/* Phase 03 Media Studio Tab */}
          <button
            onClick={() => setActiveTab('media')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'media'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>استوديو الوسائط ({assets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('scenes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'scenes'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>خطة المشاهد ({scenes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'script'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>السيناريو</span>
          </button>

          <button
            onClick={() => setActiveTab('brief')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'brief'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>التوجيه الإبداعي</span>
          </button>
        </div>
      </div>

      {/* Tab: Publishing & Distribution (Phase 05 Core) */}
      {activeTab === 'publish' && (
        <div className="space-y-6">
          {/* Pre-publish checks banner */}
          {(!activeRender || activeRender.status !== 'READY') && (
            <div className="p-5 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>الفيديو بحاجة للإخراج والتجميع النهائي قبل النشر</span>
                </h4>
                <p className="text-xs text-amber-300/80 leading-relaxed">
                  يجب إخراج الفيديو النهائي بنجاح ومطابقة جودة MP4 في تبويب &quot;الفيديو النهائي&quot; قبل النشر على منصات التواصل.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('render')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow transition-all"
              >
                الذهاب لتبويب الإخراج
              </button>
            </div>
          )}

          {/* Social Publishing Form & Platforms Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Platform Selection Card */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-blue-400" />
                  <span>اختيار المنصات والحسابات</span>
                </h3>
                <Link
                  href="/settings/social"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>إدارة الحسابات</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {(['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] as SocialPlatform[]).map((plt) => {
                const isSelected = selectedPlatforms.includes(plt);
                const platformAccounts = socialAccounts.filter((a) => a.platform === plt);
                const hasConnected = platformAccounts.length > 0;

                return (
                  <div
                    key={plt}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-600/60'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlatform(plt)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-white">
                          {ArabicSocialPlatformMap[plt]}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          hasConnected
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {hasConnected ? 'متصل' : 'غير متصل'}
                      </span>
                    </label>

                    {isSelected && (
                      <div className="pt-2 border-t border-slate-800/80">
                        {hasConnected ? (
                          <select
                            value={selectedAccounts[plt] || ''}
                            onChange={(e) =>
                              setSelectedAccounts((prev) => ({ ...prev, [plt]: e.target.value }))
                            }
                            className="w-full text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none"
                          >
                            {platformAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.displayName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-[11px] text-amber-300/80 flex items-center justify-between">
                            <span>لا يوجد حساب متصل</span>
                            <Link href="/settings/social" className="text-blue-400 underline">
                              ربط الآن
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Publishing Metadata Card */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">بيانات النشر والوصف</h3>
                <button
                  onClick={handleGenerateAiMetadata}
                  disabled={isGeneratingMeta}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-800/40 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingMeta ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingMeta ? 'جاري الصياغة...' : 'توليد بالذكاء الاصطناعي'}</span>
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    عنوان المنشور (Title):
                  </label>
                  <input
                    type="text"
                    value={publishMetadata.title}
                    onChange={(e) =>
                      setPublishMetadata((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    الوصف / الكابشن (Caption & Description):
                  </label>
                  <textarea
                    rows={4}
                    value={publishMetadata.caption || publishMetadata.description}
                    onChange={(e) =>
                      setPublishMetadata((prev) => ({
                        ...prev,
                        caption: e.target.value,
                        description: e.target.value,
                      }))
                    }
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      الهاشتاغات (Hashtags):
                    </label>
                    <input
                      type="text"
                      value={publishMetadata.hashtags?.join(' ') || ''}
                      onChange={(e) =>
                        setPublishMetadata((prev) => ({
                          ...prev,
                          hashtags: e.target.value.split(' ').filter(Boolean),
                        }))
                      }
                      placeholder="#فيديو #ريلز"
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">الخصوصية:</label>
                    <select
                      value={publishMetadata.privacy}
                      onChange={(e) =>
                        setPublishMetadata((prev) => ({ ...prev, privacy: e.target.value }))
                      }
                      className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="public">عام للجميع (Public)</option>
                      <option value="unlisted">غير مدرج (Unlisted)</option>
                      <option value="private">خاص للمعاينة (Private)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={handlePublishToPlatforms}
                    disabled={isPublishing || !activeRender || activeRender.status !== 'READY'}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${isPublishing ? 'animate-spin' : ''}`} />
                    <span>
                      {isPublishing
                        ? 'جاري النشر والتوزيع على المنصات...'
                        : `نشر الفيديو فوراً على (${selectedPlatforms.length}) منصات مختارة`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Publications History List */}
          {publications.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>سجل المنشورات والتوزيع ({publications.length})</span>
              </h4>

              <div className="space-y-3">
                {publications.map((pub) => (
                  <div
                    key={pub.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 font-bold text-white">
                        {ArabicSocialPlatformMap[pub.platform as SocialPlatform] || pub.platform}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded font-bold ${
                          pub.status === 'PUBLISHED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : pub.status === 'FAILED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-blue-950 text-blue-300'
                        }`}
                      >
                        {getArabicPublicationStatus(pub.status)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-400">
                      <span>{new Date(pub.createdAt).toLocaleDateString('ar-SA')}</span>

                      {pub.platformUrl ? (
                        <a
                          href={pub.platformUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                        >
                          <span>عرض المنشور</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">جاري المعالجة</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Analytics (Phase 05 Core) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <span>مؤشرات الأداء وإحصاءات التفاعل</span>
              </h3>
              <p className="text-xs text-slate-400">
                بيانات رسمية مسترجعة مباشرة من واجهات برمجة منصات التواصل (Official Platform Insights)
              </p>
            </div>

            <button
              onClick={handleRefreshAnalytics}
              disabled={isRefreshingAnalytics}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all shadow"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAnalytics ? 'animate-spin' : ''}`} />
              <span>تحديث الإحصاءات الآن</span>
            </button>
          </div>

          {/* Aggregated KPI Cards */}
          {(() => {
            const totalViews = analyticsSummary.reduce(
              (acc, item) => acc + (item.latestSnapshot?.views || 0),
              0
            );
            const totalLikes = analyticsSummary.reduce(
              (acc, item) => acc + (item.latestSnapshot?.likes || 0),
              0
            );
            const totalComments = analyticsSummary.reduce(
              (acc, item) => acc + (item.latestSnapshot?.comments || 0),
              0
            );
            const totalShares = analyticsSummary.reduce(
              (acc, item) => acc + (item.latestSnapshot?.shares || 0),
              0
            );

            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span>إجمالي المشاهدات</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{totalViews}</div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <ThumbsUp className="w-4 h-4 text-rose-400" />
                    <span>الإعجابات</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{totalLikes}</div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>التعليقات</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{totalComments}</div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Repeat className="w-4 h-4 text-purple-400" />
                    <span>المشاركات</span>
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{totalShares}</div>
                </div>
              </div>
            );
          })()}

          {/* Breakdown Table by Platform */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-300">تفاصيل الأداء حسب المنصة</h4>

            {analyticsSummary.length > 0 ? (
              <div className="space-y-3">
                {analyticsSummary.map((item, idx) => {
                  const snap = item.latestSnapshot;
                  const pub = item.publication;

                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs font-mono"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded bg-slate-900 border border-slate-800 font-bold text-white">
                          {ArabicSocialPlatformMap[pub.platform as SocialPlatform] || pub.platform}
                        </span>
                        {pub.platformUrl && (
                          <a
                            href={pub.platformUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <span>رابط المنشور</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-6 text-slate-300 text-[11px]">
                        <span>المشاهدات: <strong className="text-white">{snap?.views ?? 'غير متاح'}</strong></span>
                        <span>الإعجابات: <strong className="text-white">{snap?.likes ?? 'غير متاح'}</strong></span>
                        <span>التعليقات: <strong className="text-white">{snap?.comments ?? 'غير متاح'}</strong></span>
                        <span>المشاركات: <strong className="text-white">{snap?.shares ?? 'غير متاح'}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs">
                لم يتم نشر هذا الفيديو على أي منصة بعد لجلب الإحصاءات.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Final Video (Phase 04 Preserved) */}
      {activeTab === 'render' && (
        <div className="space-y-6">
          {activeRender && activeRender.status === 'READY' ? (
            <div className="p-6 md:p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold text-xs">
                      {getArabicRenderStatus(activeRender.status)}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                      الإصدار v{activeRender.version}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    تم إخراج وتجميع الفيديو النهائي ومطابقة الجودة بنجاح
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('publish')}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/60"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>الانتقال للنشر والتوزيع</span>
                  </button>
                </div>
              </div>

              {/* Video Player & Technical Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <div className="rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center min-h-[380px] relative">
                    <div className="text-center p-8 space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 flex items-center justify-center mx-auto">
                        <Play className="w-8 h-8 ml-0.5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">
                          جاهز للعرض والتحميل الفوري من Cloudflare R2
                        </p>
                        <p className="text-xs text-slate-400">
                          تم تجميع كافة المشاهد البصرية والتعليق الصوتي والترجمات العربية
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800/80 pb-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>المواصفات الفنية المعتمدة</span>
                  </h4>

                  <div className="space-y-2.5 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>الأبعاد (Resolution):</span>
                      <span className="text-white font-bold">{activeRender.width} × {activeRender.height}</span>
                    </div>

                    <div className="flex justify-between text-slate-400">
                      <span>معدل الإطارات (FPS):</span>
                      <span className="text-white font-bold">{activeRender.fps} FPS</span>
                    </div>

                    <div className="flex justify-between text-slate-400">
                      <span>المدة الفعلية:</span>
                      <span className="text-white font-bold">{activeRender.durationSeconds} ثانية</span>
                    </div>

                    <div className="flex justify-between text-slate-400">
                      <span>الترميز (Codec):</span>
                      <span className="text-white">H.264 / AAC</span>
                    </div>

                    {activeRender.checksum && (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        <span className="text-slate-400 block">SHA-256 Checksum:</span>
                        <span className="text-cyan-400 truncate block text-[10px]" title={activeRender.checksum}>
                          {activeRender.checksum}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-950/60 border border-blue-800/40 text-blue-400 flex items-center justify-center mx-auto">
                <Video className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">إخراج وتجميع الفيديو النهائي</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  بعد اعتماد خطة الفيديو وتوليد وسائط المشاهد والتعليق الصوتي، يمكنك الآن بدء عملية الإخراج النهائي لتوليد ملف MP4 مدمج مع النصوص والترجمات العربية ومؤثرات الانتقال.
                </p>
              </div>
              <button
                onClick={handleStartRender}
                disabled={isRendering || !isApproved}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isRendering ? 'animate-spin' : ''}`} />
                <span>{isRendering ? 'جاري الإخراج والتصيير...' : 'بدء إخراج الفيديو النهائي'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Media Studio (Preserved) */}
      {activeTab === 'media' && (
        <div className="space-y-6">
          {isApproved && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>توليد وتحديث وسائط جميع المشاهد</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  توليد الصور والفيديوهات الذكية والتعليق الصوتي وحفظها تلقائياً في Cloudflare R2
                </span>
              </div>
              <button
                onClick={handleGenerateMediaPipeline}
                disabled={isGeneratingMedia}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-950/60 disabled:opacity-50 shrink-0"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingMedia ? 'animate-spin' : ''}`} />
                <span>{isGeneratingMedia ? 'جاري توليد وحفظ الوسائط...' : 'توليد وسائط المشاهد والصوت'}</span>
              </button>
            </div>
          )}

          {/* Scene Media Asset Cards */}
          <div className="space-y-5">
            {scenes.map((sc, index) => (
              <div
                key={sc.id || index}
                className="p-5 md:p-6 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-5 hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/50 flex items-center justify-center font-bold text-xs">
                      #{sc.position}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-200">
                      {getArabicMediaStrategy(sc.mediaStrategy)}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-bold border ${
                        sc.mediaState === 'READY'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {getArabicSceneMediaState(sc.mediaState || 'PENDING')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <span>المادة البصرية:</span>
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{sc.visualDescription}</p>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                      <span>التعليق الصوتي:</span>
                    </span>
                    <p className="p-3 rounded-lg bg-slate-900 text-slate-200 leading-relaxed text-xs">
                      {sc.narration || 'لا يوجد نص سردي لهذا المشهد'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Scenes & Timeline (Preserved) */}
      {activeTab === 'scenes' && (
        <div className="space-y-6">
          <div className="space-y-4">
            {(isEditing ? editedScenes : scenes).map((sc, index) => (
              <div
                key={sc.id || index}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 hover:border-slate-700 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-blue-950 text-blue-400 border border-blue-800/50 flex items-center justify-center font-bold text-xs">
                      #{sc.position}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-slate-200">
                      {getArabicMediaStrategy(sc.mediaStrategy)}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 font-mono text-xs">
                    {sc.durationSeconds} ثانية
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">السرد:</label>
                    <p className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-200 leading-relaxed">
                      {sc.narration || '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">الوصف البصري:</label>
                    <p className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-slate-300 leading-relaxed">
                      {sc.visualDescription}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Script (Preserved) */}
      {activeTab === 'script' && script && (
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-6">
          <h3 className="text-lg font-bold text-white">{script.title}</h3>
          <p className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-loose whitespace-pre-line">
            {script.fullNarration}
          </p>
        </div>
      )}

      {/* Tab: Brief (Preserved) */}
      {activeTab === 'brief' && brief && (
        <div className="p-6 md:p-8 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-6">
          <h3 className="text-lg font-bold text-white">وثيقة التوجيه الإبداعي (Creative Brief)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="text-slate-500 font-semibold block">الفكرة الجوهرية:</span>
              <p className="text-slate-200 font-medium">{brief.coreIdea}</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="text-slate-500 font-semibold block">الجمهور المستهدف:</span>
              <p className="text-slate-200 font-medium">{brief.targetAudience}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
