'use client';

import React, { useState } from 'react';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  type SocialPlatform,
} from '@video-factory/contracts';

interface SocialAccountUI {
  id: string;
  platform: SocialPlatform;
  platformUserId: string;
  platformUsername?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  status: string;
  scopes: string[];
  tokenExpiresAt?: string | null;
  connectedAt: string;
}

interface SocialAccountsManagerProps {
  initialAccounts: SocialAccountUI[];
}

export function SocialAccountsManager({ initialAccounts }: SocialAccountsManagerProps) {
  const [accounts, setAccounts] = useState<SocialAccountUI[]>(initialAccounts);
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const platforms: Array<{
    id: SocialPlatform;
    name: string;
    description: string;
    iconColor: string;
    bgColor: string;
  }> = [
    {
      id: 'YOUTUBE',
      name: 'يوتيوب (YouTube)',
      description: 'نشر مقاطع الفيديو الطويلة ومقاطع يوتيوب شورتس (Shorts) عبر YouTube Data API الرسمية',
      iconColor: 'text-red-400',
      bgColor: 'bg-red-950/40 border-red-800/40',
    },
    {
      id: 'INSTAGRAM',
      name: 'إنستغرام (Instagram)',
      description: 'نشر مقاطع ريلز (Reels) ومشاركتها في الخلاصة لحسابات الأعمال والاحترافية عبر Meta Graph API',
      iconColor: 'text-pink-400',
      bgColor: 'bg-pink-950/40 border-pink-800/40',
    },
    {
      id: 'TIKTOK',
      name: 'تيك توك (TikTok)',
      description: 'نشر مقاطع الفيديو العمودية مباشرة عبر TikTok Content Posting API الرسمية',
      iconColor: 'text-cyan-400',
      bgColor: 'bg-cyan-950/40 border-cyan-800/40',
    },
  ];

  const handleConnect = async (platform: SocialPlatform) => {
    setLoadingPlatform(platform);
    setStatusMessage(null);

    try {
      const res = await fetch(`/api/social/oauth/${platform.toLowerCase()}/start`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.data?.authUrl) {
        throw new Error(data.error || 'تعذر بدء عملية الربط مع المنصة');
      }

      // Redirect to provider OAuth consent screen
      window.location.href = data.data.authUrl;
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء الاتصال بالمنصة' });
      setLoadingPlatform(null);
    }
  };

  const handleDisconnect = async (accountId: string, platformName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في قطع الاتصال بحساب ${platformName}؟`)) {
      return;
    }

    setStatusMessage(null);
    try {
      const res = await fetch(`/api/social/accounts/${accountId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر قطع اتصال الحساب');
      }

      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setStatusMessage({
        type: 'success',
        text: `تم قطع اتصال حساب ${platformName} بنجاح وإلغاء صلاحيات النشر النشطة`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء قطع الاتصال' });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Share2 className="w-6 h-6 text-blue-400" />
            <span>الحسابات والمنصات المتصلة</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة وتفويض حسابات التواصل الاجتماعي لنشر وتوزيع مقاطع الفيديو المنتجة بنقرة واحدة
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>تشفير الرموز: AES-256-GCM</span>
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
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Platform Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {platforms.map((p) => {
          const connectedAccount = accounts.find((a) => a.platform === p.id && a.status === 'CONNECTED');
          const isProcessing = loadingPlatform === p.id;

          return (
            <div
              key={p.id}
              className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-6 hover:border-slate-700 transition-all shadow-lg"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-base font-bold ${p.iconColor}`}>{p.name}</span>
                  <span
                    className={`text-[11px] px-2.5 py-1 rounded-md font-bold border ${
                      connectedAccount
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {connectedAccount ? 'متصل' : 'غير متصل'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                  {p.description}
                </p>

                {connectedAccount && (
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>اسم الحساب:</span>
                      <span className="text-white font-bold truncate max-w-[140px]">
                        {connectedAccount.displayName || connectedAccount.platformUsername || 'قناة مفعلة'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>تاريخ الربط:</span>
                      <span className="text-slate-300">
                        {new Date(connectedAccount.connectedAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {connectedAccount ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConnect(p.id)}
                      disabled={isProcessing}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                      <span>إعادة الربط</span>
                    </button>

                    <button
                      onClick={() => handleDisconnect(connectedAccount.id, p.name)}
                      className="py-2 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      title="قطع الاتصال"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>قطع</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(p.id)}
                    disabled={isProcessing}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-950/50 disabled:opacity-50"
                  >
                    <LinkIcon className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{isProcessing ? 'جاري الاتصال...' : 'ربط الحساب الآن'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
