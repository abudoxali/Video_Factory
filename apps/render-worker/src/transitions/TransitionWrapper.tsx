import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { TransitionType } from '@video-factory/contracts';

interface TransitionWrapperProps {
  children: React.ReactNode;
  transitionType: TransitionType;
  durationFrames: number;
  totalSceneFrames: number;
}

export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  transitionType,
  durationFrames,
  totalSceneFrames,
}) => {
  const frame = useCurrentFrame();
  const transFrames = Math.min(durationFrames, Math.floor(totalSceneFrames / 3));

  let opacity = 1;
  let transform = 'none';

  switch (transitionType) {
    case 'FADE':
    case 'DISSOLVE':
      opacity = interpolate(frame, [0, transFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      break;

    case 'SLIDE': {
      opacity = interpolate(frame, [0, Math.floor(transFrames / 2)], [0, 1], {
        extrapolateRight: 'clamp',
      });
      const translateX = interpolate(frame, [0, transFrames], [-80, 0], {
        extrapolateRight: 'clamp',
      });
      transform = `translateX(${translateX}px)`;
      break;
    }

    case 'ZOOM': {
      opacity = interpolate(frame, [0, transFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      const scale = interpolate(frame, [0, transFrames], [1.12, 1], {
        extrapolateRight: 'clamp',
      });
      transform = `scale(${scale})`;
      break;
    }

    case 'CUT':
    case 'NONE':
    default:
      opacity = 1;
      transform = 'none';
      break;
  }

  return (
    <AbsoluteFill style={{ opacity, transform, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};
