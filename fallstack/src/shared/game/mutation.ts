export const ZONE_IDS = ['lower_ruins', 'bell_shaft', 'moon_roof'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

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
  | 'Quiet'
  | 'Haunted'
  | 'Cursed'
  | 'Reinforced'
  | 'Stabilized';

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

const ZONE_NAMES: Record<ZoneId, string> = {
  lower_ruins: 'Lower Ruins',
  bell_shaft: 'Bell Shaft',
  moon_roof: 'Moon Roof',
};

const ARTIFACT_SLOTS: Record<
  ZoneId,
  Record<FailureBucket | 'successful_clear', Pick<Artifact, 'x' | 'y' | 'width' | 'height'>>
> = {
  lower_ruins: {
    short_jump: { x: 128, y: 5848, width: 74, height: 26 },
    overjump: { x: 304, y: 5766, width: 72, height: 24 },
    wall_bonk: { x: 40, y: 5718, width: 92, height: 18 },
    helper_overuse: { x: 214, y: 5668, width: 52, height: 24 },
    successful_clear: { x: 82, y: 5586, width: 128, height: 12 },
  },
  bell_shaft: {
    short_jump: { x: 244, y: 3830, width: 70, height: 25 },
    overjump: { x: 52, y: 3702, width: 66, height: 24 },
    wall_bonk: { x: 310, y: 3568, width: 96, height: 18 },
    helper_overuse: { x: 176, y: 3420, width: 54, height: 24 },
    successful_clear: { x: 248, y: 3218, width: 130, height: 12 },
  },
  moon_roof: {
    short_jump: { x: 284, y: 1720, width: 68, height: 24 },
    overjump: { x: 78, y: 1338, width: 68, height: 24 },
    wall_bonk: { x: 270, y: 1198, width: 96, height: 18 },
    helper_overuse: { x: 190, y: 930, width: 54, height: 24 },
    successful_clear: { x: 96, y: 388, width: 132, height: 12 },
  },
};

const seededCounters: Record<ZoneId, ZoneMutationCounters> = {
  lower_ruins: {
    short_jump: 14,
    overjump: 3,
    wall_bonk: 2,
    helper_overuse: 1,
    successfulClears: 2,
  },
  bell_shaft: {
    short_jump: 6,
    overjump: 5,
    wall_bonk: 3,
    helper_overuse: 1,
    successfulClears: 1,
  },
  moon_roof: {
    short_jump: 2,
    overjump: 3,
    wall_bonk: 0,
    helper_overuse: 0,
    successfulClears: 0,
  },
};

export const SEEDED_TOTAL_FALLS = 37;

export function createDailySeed(now = new Date()): { dateKey: string; dailySeed: string } {
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
  const zones = ZONE_IDS.map((zoneId) => deriveZone(zoneId, input.counters[zoneId]));

  return {
    dailySeed: input.dailySeed,
    dateKey: input.dateKey,
    totalFalls: input.totalFalls,
    totalClears: input.totalClears,
    totalSummits: input.totalSummits,
    headline: `Today's tower has ${input.totalFalls} failed climbs in it.`,
    zones,
    result: deriveResult(input.dailySeed, zones, input.achievements, input.totalSummits),
  };
}

export function createInitialAchievements(): AchievementState {
  return {
    firstSummitUsername: null,
    firstSummitAt: null,
    highestClimberUsername: null,
    highestClimberZone: 'lower_ruins',
    highestClimberY: 2164,
    bestStabilizerUsername: null,
    bestStabilizerClears: 0,
  };
}

export function deriveZone(zoneId: ZoneId, counters: ZoneMutationCounters): ZoneSnapshot {
  const rawStatus = deriveRawStatus(counters);
  const status = counters.successfulClears >= 6 ? 'Stabilized' : counters.successfulClears >= 3 ? 'Reinforced' : rawStatus;
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
  return typeof value === 'string' && FAILURE_BUCKETS.includes(value as FailureBucket);
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

  const threshold = nextThreshold(args.count);
  if (!threshold) return `Your fall counted. ${args.zoneName} is Cursed.`;

  const artifact = bucketArtifactName(args.bucket, args.count + 1);
  const remaining = threshold - args.count;
  return `Your fall counted. ${remaining} more ${bucketLabel(args.bucket)} spawn ${artifact}.`;
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
    return `${args.zoneName} cleared. Next: ${args.nextZoneStatus}.`;
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
  const helpfulBucket = counters.short_jump >= counters.wall_bonk ? 'short_jump' : 'wall_bonk';
  const helpfulCount = counters[helpfulBucket];
  if (helpfulCount >= 3) {
    artifacts.push(makeArtifact(zoneId, helpfulBucket, helpfulCount, status));
  }

  const hazardBucket = counters.overjump >= counters.helper_overuse ? 'overjump' : 'helper_overuse';
  const hazardCount = counters[hazardBucket];
  if (hazardCount >= 3) {
    artifacts.push(makeArtifact(zoneId, hazardBucket, hazardCount, status));
  }

  if (counters.successfulClears >= 3) {
    artifacts.push(makeArtifact(zoneId, 'successful_clear', counters.successfulClears, status));
  }

  return artifacts.slice(0, 3);
}

function deriveResult(
  dailySeed: string,
  zones: ZoneSnapshot[],
  achievements: AchievementState,
  totalSummits: number
): ResultSummary {
  const mostCursed = [...zones].sort((a, b) => curseScore(b) - curseScore(a))[0] ?? zones[0]!;
  const usefulArtifact =
    zones
      .flatMap((zone) => zone.artifacts.map((artifact) => ({ zone, artifact })))
      .filter(({ artifact }) => artifact.type === 'corpse_stack' || artifact.type === 'mercy_nail')
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
  if (bucket === 'short_jump') return count >= 6 || stabilized ? 'mercy_nail' : 'corpse_stack';
  if (bucket === 'wall_bonk') return 'ghost_platform';
  if (bucket === 'overjump') return stabilized ? 'corpse_stack' : 'cursed_brick';
  return stabilized ? 'mercy_nail' : 'cursed_brick';
}

function bucketArtifactName(bucket: FailureBucket, nextCount: number): string {
  if (bucket === 'short_jump') return nextCount >= 6 ? 'Mercy Nail' : 'Corpse Stack';
  if (bucket === 'wall_bonk') return 'Ghost Platform';
  if (bucket === 'overjump') return 'Cursed Brick';
  return 'cursed helper';
}

function bucketLabel(bucket: FailureBucket): string {
  if (bucket === 'short_jump') return 'short jumps';
  if (bucket === 'overjump') return 'overjumps';
  if (bucket === 'wall_bonk') return 'wall bonks';
  return 'helper slips';
}

function artifactLabel(type: ArtifactType, count: number): string {
  if (type === 'corpse_stack') return `${count} falls made this foothold.`;
  if (type === 'mercy_nail') return `${count} falls hammered this nail.`;
  if (type === 'ghost_platform') return `${count} bonks left a ghost.`;
  if (type === 'cursed_brick') return `This brick remembers ${count} overconfident falls.`;
  return `${count} clean climbs left a trail.`;
}
