import type { ArtifactType } from '../../shared/game/mutation.js';

const GHOST_USE_WINDOW_MS = 900;
const CURSED_CRUMBLE_MS = 650;
const ONE_WAY_TOP_TOLERANCE = 8;

export function artifactUseWindowMs(type: ArtifactType): number | null {
  if (type === 'ghost_platform') return GHOST_USE_WINDOW_MS;
  if (type === 'cursed_brick') return CURSED_CRUMBLE_MS;
  return null;
}

export function canCollideWithArtifact(input: {
  type: ArtifactType;
  playerVelocityY: number;
  playerBottom: number;
  artifactTop: number;
}): boolean {
  if (input.type === 'lantern_trail') return false;
  if (input.type !== 'ghost_platform') return true;
  return (
    input.playerVelocityY >= 0 &&
    input.playerBottom <= input.artifactTop + ONE_WAY_TOP_TOLERANCE
  );
}
