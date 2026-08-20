import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import { ImageScene } from './ImageScene';
import { VideoScene } from './VideoScene';
import type { RenderScene } from '@video-factory/contracts';

interface MixedSceneProps {
  scene: RenderScene;
  width: number;
  height: number;
  fps: number;
}

export const MixedScene: React.FC<MixedSceneProps> = ({ scene, width, height, fps }) => {
  const frame = useCurrentFrame();
  const visual = scene.visualAsset;

  const textSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const textOpacity = interpolate(frame, [5, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textTranslateY = interpolate(textSpring, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#090d16' }}>
      {/* 1. Background Visual Layer */}
      {visual?.type === 'VIDEO' ? (
        <VideoScene scene={scene} width={width} height={height} />
      ) : (
        <ImageScene scene={scene} width={width} height={height} />
      )}

      {/* 2. Middle Dark Contrast Overlay */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.2) 50%, rgba(15,23,42,0.85) 100%)',
          zIndex: 1,
        }}
      />

      {/* 3. Foreground Text Badge / Highlight */}
      {scene.onScreenText && (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            padding: Math.round(width * 0.08),
            direction: 'rtl',
            fontFamily: 'Cairo, sans-serif',
          }}
        >
          <div
            style={{
              opacity: textOpacity,
              transform: `translateY(${textTranslateY}px)`,
              padding: '16px 32px',
              borderRadius: 24,
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
              maxWidth: '85%',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: Math.round(width * 0.055),
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.3,
                textShadow: '0 2px 10px rgba(0,0,0,0.6)',
              }}
            >
              {scene.onScreenText}
            </span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
