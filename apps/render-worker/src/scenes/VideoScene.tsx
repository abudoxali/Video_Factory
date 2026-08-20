import React from 'react';
import { OffthreadVideo, staticFile, AbsoluteFill } from 'remotion';
import type { RenderScene } from '@video-factory/contracts';

interface VideoSceneProps {
  scene: RenderScene;
  width: number;
  height: number;
}

export const VideoScene: React.FC<VideoSceneProps> = ({ scene, width, height }) => {
  const visual = scene.visualAsset;
  const videoUrl = visual?.url;
  const fit: React.CSSProperties['objectFit'] = visual?.fit === 'contain' ? 'contain' : 'cover';

  return (
    <AbsoluteFill style={{ backgroundColor: scene.layout?.backgroundColor || '#0b0f19' }}>
      {videoUrl ? (
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
          volume={scene.narrationAsset?.url ? 0 : 0.8} // Mute source audio if narration exists
          muted={Boolean(scene.narrationAsset?.url)}
        />
      ) : (
        <AbsoluteFill
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#94a3b8',
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
              مشهد #{scene.position} (فيديو ذكي)
            </div>
            <div
              style={{
                fontSize: Math.round(width * 0.028),
                lineHeight: 1.5,
                color: '#e2e8f0',
              }}
            >
              {scene.visualDescription}
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Optional Gradient Vignette for Text Contrast */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
