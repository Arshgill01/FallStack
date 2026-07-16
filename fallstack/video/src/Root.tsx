import { Composition } from 'remotion';
import { FallstackPitch } from './FallstackPitch';

export const FPS = 30;
export const DURATION_SECONDS = 58;

export const RemotionRoot = () => (
  <Composition
    id="FallstackPitch"
    component={FallstackPitch}
    durationInFrames={DURATION_SECONDS * FPS}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
