import type { ArtifactTier, ArtifactType } from '../../shared/game/mutation.js';

// Tiers change how long a temporary artifact holds, never its footprint, so
// no tier can block a route. A remembered ghost helps longer; an overgrown
// one flickers out. Cursed bricks only get harsher.
const USE_WINDOW_MS: Partial<
  Record<ArtifactType, Record<ArtifactTier, number>>
> = {
  ghost_platform: { base: 900, remembered: 1300, saturated: 600 },
  cursed_brick: { base: 650, remembered: 450, saturated: 300 },
};
const ONE_WAY_TOP_TOLERANCE = 8;

export function artifactUseWindowMs(
  type: ArtifactType,
  tier: ArtifactTier = 'base'
): number | null {
  return USE_WINDOW_MS[type]?.[tier] ?? null;
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
