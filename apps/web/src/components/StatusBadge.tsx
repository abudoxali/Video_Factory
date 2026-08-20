import React from 'react';
import { getArabicJobStatus } from '@video-factory/contracts';

interface StatusBadgeProps {
  status: string;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className = '', showDot = true }: StatusBadgeProps) {
  const arabicText = getArabicJobStatus(status);

  const getColors = (s: string) => {
    switch (s) {
      case 'COMPLETED':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50';
      case 'PROCESSING':
        return 'bg-blue-950/70 text-blue-300 border-blue-700/50';
      case 'QUEUED':
        return 'bg-amber-950/70 text-amber-300 border-amber-700/50';
      case 'FAILED':
        return 'bg-rose-950/70 text-rose-300 border-rose-700/50';
      case 'CANCELLED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'DRAFT':
      default:
        return 'bg-slate-800/80 text-slate-300 border-slate-700';
    }
  };

  const getDotColor = (s: string) => {
    switch (s) {
      case 'COMPLETED':
        return 'bg-emerald-400';
      case 'PROCESSING':
        return 'bg-blue-400 animate-ping';
      case 'QUEUED':
        return 'bg-amber-400';
      case 'FAILED':
        return 'bg-rose-400';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getColors(
        status
      )} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {status === 'PROCESSING' && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${getDotColor(
                status
              )}`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              status === 'PROCESSING' ? 'bg-blue-400' : getDotColor(status)
            }`}
          />
        </span>
      )}
      <span>{arabicText}</span>
    </span>
  );
}
