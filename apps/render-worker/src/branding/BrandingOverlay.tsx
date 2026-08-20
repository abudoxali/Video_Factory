import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { RenderBranding } from '@video-factory/contracts';

interface BrandingOverlayProps {
  branding: RenderBranding;
  width: number;
  height: number;
}

export const BrandingOverlay: React.FC<BrandingOverlayProps> = ({ branding, width, height }) => {
  const watermark = branding.watermark;

  if (!watermark || !watermark.enabled) {
    return null;
  }

  // Determine watermark positioning
  const positionStyles: Record<string, React.CSSProperties> = {
    TOP_RIGHT: { top: Math.round(height * 0.05), right: Math.round(width * 0.05) },
    TOP_LEFT: { top: Math.round(height * 0.05), left: Math.round(width * 0.05) },
    BOTTOM_RIGHT: { bottom: Math.round(height * 0.1), right: Math.round(width * 0.05) },
    BOTTOM_LEFT: { bottom: Math.round(height * 0.1), left: Math.round(width * 0.05) },
  };

  const selectedPos = positionStyles[watermark.position] || positionStyles.TOP_RIGHT;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 60 }}>
      <div
        style={{
          position: 'absolute',
          ...selectedPos,
          opacity: watermark.opacity || 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          direction: 'rtl',
          fontFamily: 'Cairo, sans-serif',
        }}
      >
        {watermark.logoUrl && (
          <Img
            src={watermark.logoUrl}
            style={{
              width: Math.round(width * 0.08),
              height: 'auto',
              objectFit: 'contain',
            }}
          />
        )}
        {watermark.text && (
          <span
            style={{
              color: '#ffffff',
              fontSize: Math.round(width * 0.028),
              fontWeight: 700,
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {watermark.text}
          </span>
        )}
      </div>
    </AbsoluteFill>
  );
};
