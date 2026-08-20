import React from 'react';
import { Audio, Sequence, useCurrentFrame, interpolate } from 'remotion';
import type { RenderManifest } from '@video-factory/contracts';

interface AudioMixerProps {
  manifest: RenderManifest;
}

export const AudioMixer: React.FC<AudioMixerProps> = ({ manifest }) => {
  const frame = useCurrentFrame();
  const audioConfig = manifest.audio;
  const ducking = audioConfig.ducking;

  // Check if any narration is active at current frame
  const isNarrationActive = audioConfig.narrationTracks.some(
    (track) => frame >= track.startFrame && frame < track.startFrame + track.durationFrames
  );

  // Compute music ducking volume
  let musicVolume = ducking.normalVolume;
  if (ducking.enabled && isNarrationActive) {
    musicVolume = ducking.duckedVolume;
  }

  return (
    <>
      {/* 1. Narration Audio Tracks (Primary) */}
      {audioConfig.narrationTracks.map((track) => (
        <Sequence
          key={track.id}
          from={track.startFrame}
          durationInFrames={track.durationFrames}
        >
          <Audio src={track.url} volume={track.volume ?? 1} />
        </Sequence>
      ))}

      {/* 2. Background Music Tracks (Ducked) */}
      {audioConfig.musicTracks.map((track) => (
        <Sequence
          key={track.id}
          from={track.startFrame}
          durationInFrames={track.durationFrames}
        >
          <Audio
            src={track.url}
            volume={musicVolume * (track.volume ?? 1)}
            loop={track.loop}
          />
        </Sequence>
      ))}

      {/* 3. Sound Effects Tracks (SFX) */}
      {audioConfig.sfxTracks.map((track) => (
        <Sequence
          key={track.id}
          from={track.startFrame}
          durationInFrames={track.durationFrames}
        >
          <Audio src={track.url} volume={track.volume ?? 0.8} />
        </Sequence>
      ))}
    </>
  );
};
