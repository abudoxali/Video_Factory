import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import type { RenderScene } from '@video-factory/contracts';

interface MotionGraphicsSceneProps {
  scene: RenderScene;
  width: number;
  height: number;
  fps: number;
}

export const MotionGraphicsScene: React.FC<MotionGraphicsSceneProps> = ({
  scene,
  width,
  height,
  fps,
}) => {
  const frame = useCurrentFrame();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);

  // Extract lines or bullet points from onScreenText or visualDescription
  const textSource = scene.onScreenText || scene.visualDescription;
  const items = textSource.includes('•')
    ? textSource.split('•').map((s) => s.trim()).filter(Boolean)
    : textSource.includes('-')
    ? textSource.split('-').map((s) => s.trim()).filter(Boolean)
    : [textSource];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.layout?.backgroundColor || '#0a0f1d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        direction: 'rtl',
        fontFamily: 'Cairo, sans-serif',
        padding: Math.round(width * 0.08),
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: Math.round(width * 0.85),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* Header Badge */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            padding: '6px 20px',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)',
            color: '#ffffff',
            fontSize: Math.round(width * 0.032),
            fontWeight: 800,
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
          }}
        >
          {scene.purpose || 'موشن جرافيك'}
        </div>

        {/* Dynamic Items Cards */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((item, idx) => {
            const delay = 10 + idx * 12;
            const itemSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 14, stiffness: 120 },
            });
            const itemOpacity = interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const itemScale = interpolate(itemSpring, [0, 1], [0.92, 1]);

            return (
              <div
                key={idx}
                style={{
                  opacity: itemOpacity,
                  transform: `scale(${itemScale})`,
                  padding: `${Math.round(width * 0.035)}px ${Math.round(width * 0.045)}px`,
                  borderRadius: 20,
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: Math.round(width * 0.07),
                    height: Math.round(width * 0.07),
                    borderRadius: '50%',
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '2px solid #38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                    fontWeight: 900,
                    fontSize: Math.round(width * 0.035),
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div
                  style={{
                    fontSize: Math.round(width * 0.045),
                    fontWeight: 700,
                    color: '#f8fafc',
                    lineHeight: 1.35,
                  }}
                >
                  {item}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
