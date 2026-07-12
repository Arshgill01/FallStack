export const ZONE_IDS = [
  'orbital_scrapyard',
  'crater_foundry',
  'comet_reef',
  'nebula_vault',
  'ring_citadel',
  'dwarf_garden',
  'pulsar_spine',
  'neutron_forge',
  'black_hole_chapel',
  'galaxy_reef',
  'dying_star_garden',
  'event_horizon_crown',
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];
export const BOTTOM_ZONE_ID: ZoneId = ZONE_IDS[0];
export const TOP_ZONE_ID: ZoneId = ZONE_IDS[ZONE_IDS.length - 1]!;
export const ZONE_HEIGHT = 6000;

export const FAILURE_BUCKETS = [
  'short_jump',
  'overjump',
  'wall_bonk',
  'helper_overuse',
] as const;
export type FailureBucket = (typeof FAILURE_BUCKETS)[number];

export type ArtifactType =
  | 'corpse_stack'
  | 'mercy_nail'
  | 'ghost_platform'
  | 'cursed_brick'
  | 'lantern_trail';

export type ZoneStatus =
  'Quiet' | 'Haunted' | 'Cursed' | 'Reinforced' | 'Stabilized';

export type ZoneMutationCounters = Record<FailureBucket, number> & {
  successfulClears: number;
};

export type Artifact = {
  id: string;
  type: ArtifactType;
  zoneId: ZoneId;
  bucket: FailureBucket | 'successful_clear';
  x: number;
  y: number;
  width: number;
  height: number;
  solid: boolean;
  label: string;
  count: number;
};

export type ZoneSnapshot = {
  id: ZoneId;
  name: string;
  status: ZoneStatus;
  statusLabel: string;
  counters: ZoneMutationCounters;
  artifacts: Artifact[];
};

export type GameSnapshot = {
  dailySeed: string;
  dateKey: string;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  headline: string;
  zones: ZoneSnapshot[];
  result: ResultSummary;
};

export type AchievementState = {
  firstSummitUsername: string | null;
  firstSummitAt: number | null;
  highestClimberUsername: string | null;
  highestClimberZone: ZoneId;
  highestClimberY: number;
  bestStabilizerUsername: string | null;
  bestStabilizerClears: number;
};

export type ResultSummary = {
  towerName: string;
  seedLabel: string;
  summitStatus: 'Summit Cleared' | 'Summit Unclaimed';
  firstSummitUsername: string | null;
  mostCursedZone: string;
  mostCursedStatus: string;
  mostUsefulArtifact: string;
  bestStabilizerUsername: string | null;
  highestClimberUsername: string | null;
  highestClimberZone: string;
  tomorrowHook: string;
};

export const ZERO_COUNTERS: ZoneMutationCounters = {
  short_jump: 0,
  overjump: 0,
  wall_bonk: 0,
  helper_overuse: 0,
  successfulClears: 0,
};

export const ZONE_NAMES: Record<ZoneId, string> = {
  orbital_scrapyard: 'Orbital Scrapyard',
  crater_foundry: 'Crater Foundry',
  comet_reef: 'Comet Reef',
  nebula_vault: 'Nebula Vault',
  ring_citadel: 'Ring Citadel',
  dwarf_garden: 'Dwarf Garden',
  pulsar_spine: 'Pulsar Spine',
  neutron_forge: 'Neutron Forge',
  black_hole_chapel: 'Black Hole Chapel',
  galaxy_reef: 'Galaxy Reef',
  dying_star_garden: 'Dying Star Garden',
  event_horizon_crown: 'Event Horizon Crown',
};

const ARTIFACT_SLOTS: Record<
  ZoneId,
  Record<
    FailureBucket | 'successful_clear',
    Pick<Artifact, 'x' | 'y' | 'width' | 'height'>
  >
> = Object.fromEntries(
  ZONE_IDS.map((zoneId, index) => {
    const zoneBottom = (ZONE_IDS.length - index) * ZONE_HEIGHT;
    const drift = (index % 4) * 18;
    if (zoneId === BOTTOM_ZONE_ID) {
      return [
        zoneId,
        {
          // The seeded helper sits between spawn and the first ledge, proving
          // in the opening jump that aggregate failure changes the route.
          short_jump: { x: 280, y: zoneBottom - 130, width: 74, height: 26 },
          // The cursed option is visible on the tempting continuation line.
          overjump: { x: 174, y: zoneBottom - 220, width: 72, height: 24 },
          wall_bonk: { x: 44, y: zoneBottom - 424, width: 92, height: 18 },
          helper_overuse: {
            x: 214,
            y: zoneBottom - 584,
            width: 52,
            height: 24,
          },
          successful_clear: {
            x: 92,
            y: zoneBottom - 820,
            width: 128,
            height: 12,
          },
        },
      ];
    }
    return [
      zoneId,
      {
        short_jump: {
          x: 112 + drift,
          y: zoneBottom - 168,
          width: 74,
          height: 26,
        },
        overjump: {
          x: 286 - drift,
          y: zoneBottom - 276,
          width: 72,
          height: 24,
        },
        wall_bonk: {
          x: 44 + drift,
          y: zoneBottom - 424,
          width: 92,
          height: 18,
        },
        helper_overuse: {
          x: 214 - drift / 2,
          y: zoneBottom - 584,
          width: 52,
          height: 24,
        },
        successful_clear: {
          x: 92 + drift,
          y: zoneBottom - 820,
          width: 128,
          height: 12,
        },
      },
    ];
  })
) as Record<
  ZoneId,
  Record<
    FailureBucket | 'successful_clear',
    Pick<Artifact, 'x' | 'y' | 'width' | 'height'>
  >
>;

const seededCounters: Record<ZoneId, ZoneMutationCounters> = Object.fromEntries(
  ZONE_IDS.map((zoneId, index) => [
    zoneId,
    {
      short_jump: Math.max(1, 14 - index),
      overjump: index % 3 === 0 ? 3 : 1,
      wall_bonk: index % 2 === 0 ? 2 : 0,
      helper_overuse: index < 4 ? 1 : 0,
      successfulClears: index < 2 ? 2 - index : 0,
    },
  ])
) as Record<ZoneId, ZoneMutationCounters>;

export const SEEDED_TOTAL_FALLS = 37;

export function createDailySeed(now = new Date()): {
  dateKey: string;
  dailySeed: string;
} {
  const dateKey = now.toISOString().slice(0, 10);
  return { dateKey, dailySeed: `fallstack-${dateKey}` };
}

export function createSeededCounters(): Record<ZoneId, ZoneMutationCounters> {
  return Object.fromEntries(
    ZONE_IDS.map((zoneId) => [zoneId, { ...seededCounters[zoneId] }])
  ) as Record<ZoneId, ZoneMutationCounters>;
}

export function deriveSnapshot(input: {
  dailySeed: string;
  dateKey: string;
  counters: Record<ZoneId, ZoneMutationCounters>;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  achievements: AchievementState;
}): GameSnapshot {
  const zones = ZONE_IDS.map((zoneId) =>
    deriveZone(zoneId, input.counters[zoneId])
  );

  return {
    dailySeed: input.dailySeed,
    dateKey: input.dateKey,
    totalFalls: input.totalFalls,
    totalClears: input.totalClears,
    totalSummits: input.totalSummits,
    headline: `Today's tower has ${input.totalFalls} failed climbs in it.`,
    zones,
    result: deriveResult(
      input.dailySeed,
      zones,
      input.achievements,
      input.totalSummits
    ),
  };
}

export function createInitialAchievements(): AchievementState {
  return {
    firstSummitUsername: null,
    firstSummitAt: null,
    highestClimberUsername: null,
    highestClimberZone: BOTTOM_ZONE_ID,
    highestClimberY: (ZONE_IDS.length - 1) * ZONE_HEIGHT + 164,
    bestStabilizerUsername: null,
    bestStabilizerClears: 0,
  };
}

export function mergeAchievementState(
  current: AchievementState,
  incoming: Partial<AchievementState>
): AchievementState {
  const merged: AchievementState = { ...current };

  if (!merged.firstSummitUsername && incoming.firstSummitUsername) {
    merged.firstSummitUsername = incoming.firstSummitUsername;
    merged.firstSummitAt =
      typeof incoming.firstSummitAt === 'number' &&
      Number.isFinite(incoming.firstSummitAt)
        ? incoming.firstSummitAt
        : null;
  }

  if (
    typeof incoming.highestClimberY === 'number' &&
    Number.isFinite(incoming.highestClimberY) &&
    incoming.highestClimberY < merged.highestClimberY &&
    incoming.highestClimberUsername &&
    isZoneId(incoming.highestClimberZone)
  ) {
    merged.highestClimberY = incoming.highestClimberY;
    merged.highestClimberZone = incoming.highestClimberZone;
    merged.highestClimberUsername = incoming.highestClimberUsername;
  }

  if (
    typeof incoming.bestStabilizerClears === 'number' &&
    Number.isFinite(incoming.bestStabilizerClears) &&
    incoming.bestStabilizerClears > merged.bestStabilizerClears &&
    incoming.bestStabilizerUsername
  ) {
    merged.bestStabilizerClears = incoming.bestStabilizerClears;
    merged.bestStabilizerUsername = incoming.bestStabilizerUsername;
  }

  return merged;
}

export function deriveZone(
  zoneId: ZoneId,
  counters: ZoneMutationCounters
): ZoneSnapshot {
  const rawStatus = deriveRawStatus(counters);
  const status =
    counters.successfulClears >= 6
      ? 'Stabilized'
      : counters.successfulClears >= 3
        ? 'Reinforced'
        : rawStatus;
  const artifacts = deriveArtifacts(zoneId, counters, status);

  return {
    id: zoneId,
    name: ZONE_NAMES[zoneId],
    status,
    statusLabel: displayZoneStatus(status),
    counters: { ...counters },
    artifacts,
  };
}

export function isFailureBucket(value: unknown): value is FailureBucket {
  return (
    typeof value === 'string' &&
    FAILURE_BUCKETS.includes(value as FailureBucket)
  );
}

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === 'string' && ZONE_IDS.includes(value as ZoneId);
}

export function nextThreshold(count: number): number | null {
  if (count < 3) return 3;
  if (count < 6) return 6;
  if (count < 10) return 10;
  return null;
}

export function fallFeedback(args: {
  zoneName: string;
  bucket: FailureBucket;
  count: number;
  counted: boolean;
}): string {
  if (!args.counted) return `${args.zoneName} has heard enough from you today.`;

  if (args.count === 3) {
    return `Your fall spawned ${bucketArtifactName(args.bucket, args.count)} in ${args.zoneName}.`;
  }
  if (args.count === 6) {
    return `Your fall upgraded ${bucketArtifactName(args.bucket, args.count)} in ${args.zoneName}.`;
  }
  if (args.count >= 10) {
    return `Your fall counted. ${args.zoneName} is overgrown with failures.`;
  }

  const threshold = nextThreshold(args.count);
  if (!threshold)
    return `Your fall counted. ${args.zoneName} is overgrown with failures.`;

  const remaining = threshold - args.count;
  if (threshold === 10) {
    return `Your fall counted. ${remaining} more ${bucketLabel(args.bucket, remaining)} will overgrow ${args.zoneName}.`;
  }

  const artifact = bucketArtifactName(args.bucket, threshold);
  const verb = remaining === 1 ? 'spawns' : 'spawn';
  return `Your fall counted. ${remaining} more ${bucketLabel(args.bucket, remaining)} ${verb} ${artifact}.`;
}

function bucketLabel(bucket: FailureBucket, count: number): string {
  const plural =
    bucket === 'short_jump'
      ? 'short jumps'
      : bucket === 'overjump'
        ? 'overjumps'
        : bucket === 'wall_bonk'
          ? 'wall bonks'
          : 'helper slips';
  if (count !== 1) return plural;
  if (bucket === 'short_jump') return 'short jump';
  if (bucket === 'overjump') return 'overjump';
  if (bucket === 'wall_bonk') return 'wall bonk';
  return 'helper slip';
}

export function clearFeedback(args: {
  zoneName: string;
  clears: number;
  counted: boolean;
  nextZoneStatus?: ZoneStatus;
}): string {
  if (!args.counted) return `${args.zoneName} remembers the clean line.`;
  if (args.clears >= 6) return `${args.zoneName} stabilized by clean climbs.`;
  if (args.clears >= 3) return `${args.zoneName} is Reinforced. Keep climbing.`;
  if (args.nextZoneStatus) {
    return `${args.zoneName} cleared. Next: ${displayZoneStatus(args.nextZoneStatus)}.`;
  }
  return `${args.zoneName} cleared.`;
}

function deriveRawStatus(counters: ZoneMutationCounters): ZoneStatus {
  const highest = Math.max(
    counters.short_jump,
    counters.overjump,
    counters.wall_bonk,
    counters.helper_overuse
  );
  if (counters.overjump >= 10 || counters.helper_overuse >= 10) return 'Cursed';
  if (highest >= 10) return 'Haunted';
  return 'Quiet';
}

function deriveArtifacts(
  zoneId: ZoneId,
  counters: ZoneMutationCounters,
  status: ZoneStatus
): Artifact[] {
  const artifacts: Artifact[] = [];
  const helpfulBucket =
    counters.short_jump >= counters.wall_bonk ? 'short_jump' : 'wall_bonk';
  const helpfulCount = counters[helpfulBucket];
  if (helpfulCount >= 3) {
    artifacts.push(makeArtifact(zoneId, helpfulBucket, helpfulCount, status));
  }

  const hazardBucket =
    counters.overjump >= counters.helper_overuse
      ? 'overjump'
      : 'helper_overuse';
  const hazardCount = counters[hazardBucket];
  if (hazardCount >= 3) {
    artifacts.push(makeArtifact(zoneId, hazardBucket, hazardCount, status));
  }

  if (counters.successfulClears >= 3) {
    artifacts.push(
      makeArtifact(
        zoneId,
        'successful_clear',
        counters.successfulClears,
        status
      )
    );
  }

  return artifacts.slice(0, 3);
}

function deriveResult(
  dailySeed: string,
  zones: ZoneSnapshot[],
  achievements: AchievementState,
  totalSummits: number
): ResultSummary {
  const mostCursed =
    [...zones].sort((a, b) => curseScore(b) - curseScore(a))[0] ?? zones[0]!;
  const usefulArtifact =
    zones
      .flatMap((zone) => zone.artifacts.map((artifact) => ({ zone, artifact })))
      .filter(
        ({ artifact }) =>
          artifact.type === 'corpse_stack' || artifact.type === 'mercy_nail'
      )
      .sort((a, b) => b.artifact.count - a.artifact.count)[0] ?? null;

  return {
    towerName: 'The Cursed Stack',
    seedLabel: dailySeed.replace('fallstack-', ''),
    summitStatus: totalSummits > 0 ? 'Summit Cleared' : 'Summit Unclaimed',
    firstSummitUsername: achievements.firstSummitUsername,
    mostCursedZone: mostCursed.name,
    mostCursedStatus: mostCursed.statusLabel,
    mostUsefulArtifact: usefulArtifact
      ? `${displayArtifactName(usefulArtifact.artifact.type)} · ${usefulArtifact.zone.name}`
      : 'No foothold has earned trust yet.',
    bestStabilizerUsername: achievements.bestStabilizerUsername,
    highestClimberUsername: achievements.highestClimberUsername,
    highestClimberZone: ZONE_NAMES[achievements.highestClimberZone],
    tomorrowHook: "Tomorrow, today's worst ledge comes back as a relic.",
  };
}

export function displayZoneStatus(status: ZoneStatus): string {
  if (status === 'Quiet') return 'Untouched';
  if (status === 'Haunted') return 'Restless';
  if (status === 'Cursed') return 'Overgrown';
  if (status === 'Reinforced') return 'Well-Trodden';
  return 'Blessed';
}

function curseScore(zone: ZoneSnapshot): number {
  const failures =
    zone.counters.short_jump +
    zone.counters.overjump +
    zone.counters.wall_bonk +
    zone.counters.helper_overuse;
  return failures * 2 - zone.counters.successfulClears * 3;
}

function displayArtifactName(type: ArtifactType): string {
  if (type === 'corpse_stack') return 'Corpse Stack';
  if (type === 'mercy_nail') return 'Mercy Nail';
  if (type === 'ghost_platform') return 'Ghost Platform';
  if (type === 'cursed_brick') return 'Cursed Brick';
  return 'Lantern Trail';
}

function makeArtifact(
  zoneId: ZoneId,
  bucket: FailureBucket | 'successful_clear',
  count: number,
  status: ZoneStatus
): Artifact {
  const slot = ARTIFACT_SLOTS[zoneId][bucket];
  const stabilized = status === 'Stabilized';

  if (bucket === 'successful_clear') {
    return {
      ...slot,
      id: `${zoneId}-lantern-trail`,
      type: 'lantern_trail',
      zoneId,
      bucket,
      solid: false,
      label: `${count} clean climbs lit this line.`,
      count,
    };
  }

  const type = bucketArtifactType(bucket, count, stabilized);
  return {
    ...slot,
    id: `${zoneId}-${bucket}`,
    type,
    zoneId,
    bucket,
    solid: type !== 'lantern_trail',
    label: artifactLabel(type, count),
    count,
  };
}

function bucketArtifactType(
  bucket: FailureBucket,
  count: number,
  stabilized: boolean
): ArtifactType {
  if (bucket === 'short_jump')
    return count >= 6 || stabilized ? 'mercy_nail' : 'corpse_stack';
  if (bucket === 'wall_bonk') return 'ghost_platform';
  if (bucket === 'overjump')
    return stabilized ? 'corpse_stack' : 'cursed_brick';
  return stabilized ? 'mercy_nail' : 'cursed_brick';
}

function bucketArtifactName(bucket: FailureBucket, nextCount: number): string {
  if (bucket === 'short_jump')
    return nextCount >= 6 ? 'Mercy Nail' : 'Corpse Stack';
  if (bucket === 'wall_bonk') return 'Ghost Platform';
  if (bucket === 'overjump') return 'Cursed Brick';
  return 'Cursed Helper';
}

function artifactLabel(type: ArtifactType, count: number): string {
  if (type === 'corpse_stack') return `${count} falls made this foothold.`;
  if (type === 'mercy_nail') return `${count} falls hammered this nail.`;
  if (type === 'ghost_platform') return `${count} bonks left a ghost.`;
  if (type === 'cursed_brick')
    return `This brick remembers ${count} overconfident falls.`;
  return `${count} clean climbs left a trail.`;
}
