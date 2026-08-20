import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { RenderManifest, RenderCaptionSegment } from '@video-factory/contracts';

interface ArabicCaptionsProps {
  manifest: RenderManifest;
  width: number;
  height: number;
}

export const ArabicCaptions: React.FC<ArabicCaptionsProps> = ({ manifest, width, height }) => {
  const frame = useCurrentFrame();
  const captionConfig = manifest.captions;

  if (!captionConfig.enabled) {
    return null;
  }

  // Find all caption segments across all scenes
  const allSegments: RenderCaptionSegment[] = [];
  manifest.scenes.forEach((scene) => {
    if (scene.captions && scene.captions.length > 0) {
      allSegments.push(...scene.captions);
    }
  });

  // Find active segment for the current frame
  const activeSegment = allSegments.find(
    (seg) => frame >= seg.startFrame && frame < seg.endFrame
  );

  if (!activeSegment) {
    return null;
  }

  const safeBottomMargin = Math.round(height * (captionConfig.safeAreaMarginPercent / 100));
  const style = captionConfig.style || 'SOCIAL';

  // Render caption card according to chosen style
  let containerStyle: React.CSSProperties = {};
  let textStyle: React.CSSProperties = {};

  switch (style) {
    case 'BOLD':
      containerStyle = {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid #38bdf8',
        borderRadius: 24,
        padding: '16px 36px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      };
      textStyle = {
        color: '#ffffff',
        fontSize: Math.round(width * 0.052),
        fontWeight: 900,
        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      };
      break;

    case 'CLEAN':
      containerStyle = {
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        borderRadius: 16,
        padding: '12px 28px',
      };
      textStyle = {
        color: '#f8fafc',
        fontSize: Math.round(width * 0.045),
        fontWeight: 700,
      };
      break;

    case 'MINIMAL':
      containerStyle = {
        padding: '8px 20px',
      };
      textStyle = {
        color: '#ffffff',
        fontSize: Math.round(width * 0.042),
        fontWeight: 700,
        textShadow: '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8)',
      };
      break;

    case 'SOCIAL':
    default:
      containerStyle = {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        padding: '14px 32px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
      };
      textStyle = {
        color: '#ffffff',
        fontSize: Math.round(width * 0.048),
        fontWeight: 800,
      };
      break;
  }

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: safeBottomMargin,
        paddingLeft: Math.round(width * 0.06),
        paddingRight: Math.round(width * 0.06),
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          ...containerStyle,
          maxWidth: '92%',
          textAlign: 'center',
          direction: 'rtl',
          fontFamily: captionConfig.fontFamily || 'Cairo, sans-serif',
        }}
      >
        <span
          style={{
            ...textStyle,
            lineHeight: 1.35,
            display: 'inline-block',
          }}
        >
          {activeSegment.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
