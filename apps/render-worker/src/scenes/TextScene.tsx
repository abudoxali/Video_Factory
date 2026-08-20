import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import type { RenderScene } from '@video-factory/contracts';

interface TextSceneProps {
  scene: RenderScene;
  width: number;
  height: number;
  fps: number;
}

export const TextScene: React.FC<TextSceneProps> = ({ scene, width, height, fps }) => {
  const frame = useCurrentFrame();

  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 14,
      stiffness: 90,
      mass: 0.8,
    },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);

  const textToDisplay = scene.onScreenText || scene.visualDescription;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.layout?.backgroundColor || '#080c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        direction: 'rtl',
        fontFamily: 'Cairo, sans-serif',
        padding: Math.round(width * 0.08),
      }}
    >
      {/* Background Subtle Gradient Glow */}
      <div
        style={{
          position: 'absolute',
          width: Math.round(width * 0.7),
          height: Math.round(width * 0.7),
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(30, 27, 75, 0) 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Main Text Card Container */}
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '8px 24px',
            borderRadius: '9999px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            fontSize: Math.round(width * 0.032),
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          {scene.purpose || `مشهد #${scene.position}`}
        </div>

        <h1
          style={{
            fontSize: Math.round(width * 0.065),
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.4,
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
            marginBottom: 16,
          }}
        >
          {textToDisplay}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
