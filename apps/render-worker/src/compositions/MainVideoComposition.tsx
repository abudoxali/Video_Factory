import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { VideoScene } from '../scenes/VideoScene';
import { ImageScene } from '../scenes/ImageScene';
import { TextScene } from '../scenes/TextScene';
import { MotionGraphicsScene } from '../scenes/MotionGraphicsScene';
import { MixedScene } from '../scenes/MixedScene';
import { ArabicCaptions } from '../captions/ArabicCaptions';
import { AudioMixer } from '../audio/AudioMixer';
import { TransitionWrapper } from '../transitions/TransitionWrapper';
import { BrandingOverlay } from '../branding/BrandingOverlay';
import type { RenderManifest, RenderScene } from '@video-factory/contracts';

export interface MainVideoCompositionProps {
  manifest: RenderManifest;
}

export const MainVideoComposition: React.FC<MainVideoCompositionProps> = ({ manifest }) => {
  const { width, height, fps } = manifest.composition;

  const renderSceneContent = (scene: RenderScene) => {
    switch (scene.mediaStrategy) {
      case 'AI_VIDEO':
        return <VideoScene scene={scene} width={width} height={height} />;
      case 'AI_IMAGE':
      case 'STOCK':
        return <ImageScene scene={scene} width={width} height={height} />;
      case 'TEXT':
        return <TextScene scene={scene} width={width} height={height} fps={fps} />;
      case 'MOTION_GRAPHICS':
        return <MotionGraphicsScene scene={scene} width={width} height={height} fps={fps} />;
      case 'MIXED':
      default:
        return <MixedScene scene={scene} width={width} height={height} fps={fps} />;
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#090d16', overflow: 'hidden' }}>
      {/* 1. Scenes Sequences Layer */}
      {manifest.scenes.map((scene) => (
        <Sequence
          key={scene.sceneId}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
        >
          <TransitionWrapper
            transitionType={scene.transition?.type || 'FADE'}
            durationFrames={scene.transition?.durationFrames || 15}
            totalSceneFrames={scene.durationFrames}
          >
            {renderSceneContent(scene)}
          </TransitionWrapper>
        </Sequence>
      ))}

      {/* 2. Arabic Captions Layer */}
      <ArabicCaptions manifest={manifest} width={width} height={height} />

      {/* 3. Audio Mixer Layer (Narration, Music, SFX) */}
      <AudioMixer manifest={manifest} />

      {/* 4. Branding & Watermark Layer */}
      <BrandingOverlay branding={manifest.branding} width={width} height={height} />
    </AbsoluteFill>
  );
};
