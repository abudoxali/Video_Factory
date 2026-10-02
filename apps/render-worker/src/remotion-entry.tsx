import React from 'react';
import { Composition, registerRoot } from 'remotion';
import type { RenderManifest } from '@video-factory/contracts';
import {
  MainVideoComposition,
  type MainVideoCompositionProps,
} from './compositions/MainVideoComposition';
import { ensureVendoredCairoFont } from './fonts';

/**
 * Canonical Remotion entry point for Video Factory.
 *
 * @remotion/bundler bundles this file into a serve URL; @remotion/renderer
 * then evaluates RemotionRoot inside headless Chromium, picks the composition
 * by id (see MAIN_VIDEO_COMPOSITION_ID) and renders real frames.
 *
 * NOTE: this module must not import @video-factory/contracts at runtime —
 * the package ships ESM dist with extensionless specifiers that webpack's
 * fullySpecified rule rejects. Only `import type` is safe here; manifests
 * arrive already validated by RenderService.
 */
export const MAIN_VIDEO_COMPOSITION_ID = 'MainVideoComposition';

const FALLBACK_MANIFEST: RenderManifest = {
  version: '1.0',
  renderId: 'rnd_default',
  videoId: 'vid_default',
  title: 'فيديو جديد',
  language: 'ar',
  composition: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 30,
    durationSeconds: 1,
    aspectRatio: '9:16',
  },
  scenes: [
    {
      sceneId: 'scn_default',
      position: 1,
      startFrame: 0,
      durationFrames: 30,
      durationSeconds: 1,
      mediaStrategy: 'TEXT',
      visualDescription: 'مشهد نصي افتراضي',
      onScreenText: 'Video Factory',
      transition: { type: 'FADE', durationFrames: 15 },
      layout: { template: 'default', theme: 'dark', backgroundColor: '#0b0f19' },
      captions: [],
    },
  ],
  audio: {
    narrationTracks: [],
    musicTracks: [],
    sfxTracks: [],
    ducking: { enabled: true, duckedVolume: 0.15, normalVolume: 0.6, fadeFrames: 15 },
  },
  captions: {
    enabled: true,
    style: 'SOCIAL',
    safeAreaMarginPercent: 18,
    primaryColor: '#ffffff',
    highlightColor: '#38bdf8',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    fontSize: 48,
    maxLines: 2,
    rtl: true,
    fontFamily: 'Cairo, sans-serif',
  },
  branding: {
    watermark: { enabled: false, opacity: 0.5, position: 'TOP_RIGHT' },
    introCard: { enabled: false, durationFrames: 60 },
    outroCard: { enabled: false, durationFrames: 90 },
  },
  output: { format: 'mp4', codec: 'h264', audioCodec: 'aac', crf: 20 },
};

const RemotionRoot: React.FC = () => {
  ensureVendoredCairoFont();

  return (
    <Composition<any, MainVideoCompositionProps>
      id={MAIN_VIDEO_COMPOSITION_ID}
      component={MainVideoComposition}
      durationInFrames={FALLBACK_MANIFEST.composition.durationInFrames}
      fps={FALLBACK_MANIFEST.composition.fps}
      width={FALLBACK_MANIFEST.composition.width}
      height={FALLBACK_MANIFEST.composition.height}
      defaultProps={{ manifest: FALLBACK_MANIFEST }}
      calculateMetadata={({ props }) => {
        // Manifest arrives already schema-validated by RenderService —
        // geometry is read straight from the caller's payload.
        const manifest = props.manifest;
        return {
          durationInFrames: manifest.composition.durationInFrames,
          fps: manifest.composition.fps,
          width: manifest.composition.width,
          height: manifest.composition.height,
          props: { manifest },
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
