import type { GameSnapshot } from '../shared/game/mutation.js';

export type SplashSnapshotCopy = {
  scopeLabel: string;
  headline: string;
  artifactLabel: string;
  detail: string;
};

export function splashSnapshotCopy(
  snapshot: GameSnapshot | null
): SplashSnapshotCopy {
  if (!snapshot) {
    return {
      scopeLabel: 'This subreddit · one daily tower',
      headline: "Today's tower is loading its shared scars.",
      artifactLabel: 'Community falls shape this foothold.',
      detail: 'See where this subreddit fell, then leave the next climber a mark.',
    };
  }

  const firstArtifact = snapshot.zones[0]?.artifacts.find(
    (artifact) => artifact.bucket !== 'successful_clear'
  );
  const artifactLabel =
    firstArtifact?.label ?? 'Community falls shape this foothold.';
  const scopeLabel =
    'scopeLabel' in snapshot && typeof snapshot.scopeLabel === 'string'
      ? snapshot.scopeLabel
      : 'This subreddit';

  return {
    scopeLabel: `${scopeLabel} · one daily tower`,
    headline: `${snapshot.seededFalls} opening scars · ${snapshot.organicFalls} community ${snapshot.organicFalls === 1 ? 'fall' : 'falls'}`,
    artifactLabel,
    detail: `${artifactLabel} Your fall can change what ${scopeLabel} climbs next.`,
  };
}
