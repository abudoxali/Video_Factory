import React from 'react';
import { Img, AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { RenderScene, ImageAnimation } from '@video-factory/contracts';

interface ImageSceneProps {
  scene: RenderScene;
  width: number;
  height: number;
}

export const ImageScene: React.FC<ImageSceneProps> = ({ scene, width, height }) => {
  const frame = useCurrentFrame();
  const visual = scene.visualAsset;
  const imageUrl = visual?.url;
  const animation: ImageAnimation = visual?.animation || 'KEN_BURNS';
  const durationFrames = scene.durationFrames || 90;

  // Compute transform based on chosen animation preset
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (animation) {
    case 'ZOOM_IN':
      scale = interpolate(frame, [0, durationFrames], [1, 1.15], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'ZOOM_OUT':
      scale = interpolate(frame, [0, durationFrames], [1.15, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'PAN_LEFT':
      scale = 1.1;
      translateX = interpolate(frame, [0, durationFrames], [30, -30], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'PAN_RIGHT':
      scale = 1.1;
      translateX = interpolate(frame, [0, durationFrames], [-30, 30], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'KEN_BURNS':
    case 'PARALLAX_SIMPLE':
      scale = interpolate(frame, [0, durationFrames], [1.02, 1.12], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, durationFrames], [0, -20], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'STATIC':
    default:
      scale = 1;
      break;
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.layout?.backgroundColor || '#0b0f19',
        overflow: 'hidden',
      }}
    >
      {imageUrl ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
            transformOrigin: 'center center',
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      ) : (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)',
            color: '#cbd5e1',
            fontFamily: 'Cairo, sans-serif',
            direction: 'rtl',
            padding: 40,
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '80%' }}>
            <div
              style={{
                fontSize: Math.round(width * 0.04),
                fontWeight: 700,
                color: '#38bdf8',
                marginBottom: 16,
              }}
            >
              مشهد #{scene.position} (صورة ذكية)
            </div>
            <div
              style={{
                fontSize: Math.round(width * 0.028),
                lineHeight: 1.5,
                color: '#f8fafc',
              }}
            >
              {scene.visualDescription}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Atmospheric Cinematic Gradient */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(11,15,25,0.35) 0%, rgba(11,15,25,0) 40%, rgba(11,15,25,0.75) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
