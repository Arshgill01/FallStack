import type {
  Artifact,
  ZoneSnapshot,
} from '../../shared/game/mutation.js';

export type ZoneEffectPresentation = {
  label: string;
  description: string;
  badgeClass: string;
};

export function zoneEffectPresentation(
  zone: ZoneSnapshot
): ZoneEffectPresentation {
  const artifact = primaryMechanicalArtifact(zone.artifacts);
  if (artifact?.type === 'cursed_brick') {
    return {
      label: 'Hazard active',
      description: 'A Cursed Brick crumbles shortly after landing.',
      badgeClass: 'badge-cursed',
    };
  }
  if (artifact?.type === 'ghost_platform') {
    return {
      label: 'Ghost active',
      description: 'A temporary one-way foothold helps this route.',
      badgeClass: 'badge-haunted',
    };
  }
  if (
    artifact?.type === 'corpse_stack' ||
    artifact?.type === 'mercy_nail'
  ) {
    return {
      label: 'Helper active',
      description: 'A solid community-made foothold helps this route.',
      badgeClass: 'badge-reinforced',
    };
  }
  if (zone.status === 'Stabilized') {
    return {
      label: 'Route stable',
      description: 'Clean clears stabilized this part of the tower.',
      badgeClass: 'badge-stabilized',
    };
  }
  if (
    zone.status === 'Reinforced' ||
    artifact?.type === 'lantern_trail'
  ) {
    return {
      label: 'Clean clears',
      description: 'Clean clears are repairing this part of the tower.',
      badgeClass: 'badge-reinforced',
    };
  }
  return {
    label: 'No active mark',
    description: 'No visible helper or hazard changes this route yet.',
    badgeClass: 'badge-quiet',
  };
}

function primaryMechanicalArtifact(
  artifacts: Artifact[]
): Artifact | undefined {
  return [...artifacts].sort(
    (left, right) => artifactPriority(right) - artifactPriority(left)
  )[0];
}

function artifactPriority(artifact: Artifact): number {
  if (artifact.type === 'cursed_brick') return 5;
  if (artifact.type === 'ghost_platform') return 4;
  if (artifact.type === 'mercy_nail') return 3;
  if (artifact.type === 'corpse_stack') return 2;
  return 1;
}
