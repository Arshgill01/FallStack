import type { GameSnapshot } from '../shared/game/mutation.js';

export type SplashSnapshotCopy = {
  headline: string;
  artifactLabel: string;
  detail: string;
};

export function splashSnapshotCopy(
  snapshot: GameSnapshot | null
): SplashSnapshotCopy {
  if (!snapshot) {
    return {
      headline: "Today's tower is loading its shared scars.",
      artifactLabel: 'Community falls shape this foothold.',
      detail: 'See what the community changed, then add yours carefully.',
    };
  }

  const firstArtifact = snapshot.zones[0]?.artifacts.find(
    (artifact) => artifact.bucket !== 'successful_clear'
  );
  const artifactLabel =
    firstArtifact?.label ?? 'Community falls shape this foothold.';

  return {
    headline: `Today's tower has ${snapshot.totalFalls} failed ${snapshot.totalFalls === 1 ? 'climb' : 'climbs'} in it.`,
    artifactLabel,
    detail: `${artifactLabel} Add yours carefully.`,
  };
}
