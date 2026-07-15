const ONE_WAY_TOP_TOLERANCE = 8;

export function canCollideWithPlatform(input: {
  checkpoint: boolean;
  playerVelocityY: number;
  playerBottom: number;
  platformTop: number;
}): boolean {
  if (!input.checkpoint) return true;
  return (
    input.playerVelocityY >= 0 &&
    input.playerBottom <= input.platformTop + ONE_WAY_TOP_TOLERANCE
  );
}
