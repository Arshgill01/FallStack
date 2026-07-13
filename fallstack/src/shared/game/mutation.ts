import {
  BOTTOM_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
  ZONE_NAMES,
  type ZoneId,
} from './zones.js';
import {
  deriveImpactSites,
  type ImpactSite,
  type Rect,
} from './impact-sites.js';
import { generateDailyTower } from './tower.js';

export {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
  ZONE_NAMES,
  type ZoneId,
} from './zones.js';

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

export type SiteMutationCounters = ZoneMutationCounters;

export type Artifact = {
  id: string;
  type: ArtifactType;
  zoneId: ZoneId;
  siteId: string;
  siteName: string;
  anchorPlatformId: string;
  bucket: FailureBucket | 'successful_clear';
  x: number;
  y: number;
  width: number;
  height: number;
  solid: boolean;
  label: string;
  count: number;
  seededCount: number;
  organicCount: number;
};

export type ZoneSnapshot = {
  id: ZoneId;
  name: string;
  status: ZoneStatus;
  statusLabel: string;
  counters: ZoneMutationCounters;
  artifacts: Artifact[];
};

export type SiteSnapshot = ImpactSite & {
  status: ZoneStatus;
  counters: SiteMutationCounters;
  seededCounters: SiteMutationCounters;
  organicCounters: SiteMutationCounters;
  artifacts: Artifact[];
};

export type GameSnapshot = {
  dailySeed: string;
  dateKey: string;
  seededFalls: number;
  organicFalls: number;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  headline: string;
  sites: SiteSnapshot[];
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
};

export const ZERO_COUNTERS: ZoneMutationCounters = {
  short_jump: 0,
  overjump: 0,
  wall_bonk: 0,
  helper_overuse: 0,
  successfulClears: 0,
};

const seededFailures: Record<ZoneId, Record<FailureBucket, number>> = {
  orbital_scrapyard: {
    short_jump: 4,
    overjump: 3,
    wall_bonk: 3,
    helper_overuse: 0,
  },
  crater_foundry: {
    short_jump: 3,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  comet_reef: {
    short_jump: 3,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  nebula_vault: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 3,
    helper_overuse: 0,
  },
  ring_citadel: {
    short_jump: 0,
    overjump: 10,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  dwarf_garden: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 3,
  },
  pulsar_spine: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 2,
    helper_overuse: 0,
  },
  neutron_forge: {
    short_jump: 0,
    overjump: 3,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  black_hole_chapel: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  galaxy_reef: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  dying_star_garden: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
  event_horizon_crown: {
    short_jump: 0,
    overjump: 0,
    wall_bonk: 0,
    helper_overuse: 0,
  },
};

const seededCounters: Record<ZoneId, ZoneMutationCounters> = Object.fromEntries(
  ZONE_IDS.map((zoneId, index) => [
    zoneId,
    {
      ...seededFailures[zoneId],
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

export function createSeededSiteCounters(
  dailySeed: string
): Record<string, SiteMutationCounters> {
  return siteCountersFromZoneCounters(dailySeed, createSeededCounters());
}

export function deriveSnapshot(input: {
  dailySeed: string;
  dateKey: string;
  counters: Record<ZoneId, ZoneMutationCounters>;
  siteCounters?: Record<string, SiteMutationCounters>;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  achievements: AchievementState;
}): GameSnapshot {
  const impactSites = deriveImpactSites(generateDailyTower(input.dailySeed));
  const siteCounters =
    input.siteCounters ??
    siteCountersFromZoneCounters(input.dailySeed, input.counters);
  const seededSiteCounters = createSeededSiteCounters(input.dailySeed);
  const sites = impactSites.map((site) => {
    const counters = { ...ZERO_COUNTERS, ...siteCounters[site.id] };
    const seeded = { ...ZERO_COUNTERS, ...seededSiteCounters[site.id] };
    const status = deriveSiteStatus(counters);
    return {
      ...site,
      status,
      counters,
      seededCounters: seeded,
      organicCounters: subtractCounters(counters, seeded),
      artifacts: deriveSiteArtifacts(site, counters, status, seeded),
    };
  });
  const zoneCounters = aggregateSiteCounters(impactSites, siteCounters);
  const zones = ZONE_IDS.map((zoneId) =>
    deriveZoneFromSites(
      zoneId,
      zoneCounters[zoneId],
      sites.filter((site) => site.zoneId === zoneId)
    )
  );

  return {
    dailySeed: input.dailySeed,
    dateKey: input.dateKey,
    seededFalls: SEEDED_TOTAL_FALLS,
    organicFalls: Math.max(0, input.totalFalls - SEEDED_TOTAL_FALLS),
    totalFalls: input.totalFalls,
    totalClears: input.totalClears,
    totalSummits: input.totalSummits,
    headline: `Today's tower has ${input.totalFalls} failed climbs in it.`,
    sites,
    zones,
    result: deriveResult(
      input.dailySeed,
      zones,
      input.achievements,
      input.totalSummits
    ),
  };
}

function siteCountersFromZoneCounters(
  dailySeed: string,
  counters: Record<ZoneId, ZoneMutationCounters>
): Record<string, SiteMutationCounters> {
  const sites = deriveImpactSites(generateDailyTower(dailySeed));
  const result = Object.fromEntries(
    sites.map((site) => [site.id, { ...ZERO_COUNTERS }])
  ) as Record<string, SiteMutationCounters>;

  for (const zoneId of ZONE_IDS) {
    const zoneSites = sites.filter((site) => site.zoneId === zoneId);
    const zoneCounters = counters[zoneId];
    assignSiteCounter(zoneSites, result, 0, 'short_jump', zoneCounters.short_jump);
    assignSiteCounter(zoneSites, result, 1, 'wall_bonk', zoneCounters.wall_bonk);
    assignSiteCounter(zoneSites, result, 2, 'overjump', zoneCounters.overjump);
    assignSiteCounter(
      zoneSites,
      result,
      2,
      'helper_overuse',
      zoneCounters.helper_overuse
    );
    assignSiteCounter(
      zoneSites,
      result,
      0,
      'successfulClears',
      zoneCounters.successfulClears
    );
  }

  return result;
}

function assignSiteCounter(
  sites: ImpactSite[],
  counters: Record<string, SiteMutationCounters>,
  preferredIndex: number,
  counter: keyof SiteMutationCounters,
  value: number
): void {
  const site = sites[preferredIndex] ?? sites[0];
  if (site) counters[site.id]![counter] = value;
}

function aggregateSiteCounters(
  sites: ImpactSite[],
  counters: Record<string, SiteMutationCounters>
): Record<ZoneId, ZoneMutationCounters> {
  const result = Object.fromEntries(
    ZONE_IDS.map((zoneId) => [zoneId, { ...ZERO_COUNTERS }])
  ) as Record<ZoneId, ZoneMutationCounters>;

  for (const site of sites) {
    const siteCounters = { ...ZERO_COUNTERS, ...counters[site.id] };
    for (const counter of Object.keys(
      ZERO_COUNTERS
    ) as (keyof SiteMutationCounters)[]) {
      result[site.zoneId][counter] += siteCounters[counter];
    }
  }
  return result;
}

function subtractCounters(
  counters: SiteMutationCounters,
  seeded: SiteMutationCounters
): SiteMutationCounters {
  return Object.fromEntries(
    (Object.keys(ZERO_COUNTERS) as (keyof SiteMutationCounters)[]).map(
      (counter) => [counter, Math.max(0, counters[counter] - seeded[counter])]
    )
  ) as SiteMutationCounters;
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
  counters: ZoneMutationCounters,
  impactSites: ImpactSite[]
): ZoneSnapshot {
  const status = deriveSiteStatus(counters);
  const artifacts = deriveArtifacts(zoneId, counters, status, impactSites);

  return {
    id: zoneId,
    name: ZONE_NAMES[zoneId],
    status,
    statusLabel: displayZoneStatus(status),
    counters: { ...counters },
    artifacts,
  };
}

function deriveZoneFromSites(
  zoneId: ZoneId,
  counters: ZoneMutationCounters,
  sites: SiteSnapshot[]
): ZoneSnapshot {
  const status = deriveSiteStatus(counters);
  const artifacts = sites
    .map((site) => preferredSiteArtifact(site.artifacts))
    .filter((artifact): artifact is Artifact => Boolean(artifact))
    .slice(0, 3);

  return {
    id: zoneId,
    name: ZONE_NAMES[zoneId],
    status,
    statusLabel: displayZoneStatus(status),
    counters: { ...counters },
    artifacts,
  };
}

function preferredSiteArtifact(artifacts: Artifact[]): Artifact | null {
  return (
    [...artifacts].sort(
      (left, right) =>
        right.count - left.count ||
        artifactPriority(left.bucket) - artifactPriority(right.bucket)
    )[0] ?? null
  );
}

function artifactPriority(
  bucket: FailureBucket | 'successful_clear'
): number {
  if (bucket === 'short_jump') return 0;
  if (bucket === 'wall_bonk') return 1;
  if (bucket === 'overjump') return 2;
  if (bucket === 'helper_overuse') return 3;
  return 4;
}

function deriveSiteStatus(counters: SiteMutationCounters): ZoneStatus {
  if (counters.successfulClears >= 6) return 'Stabilized';
  if (counters.successfulClears >= 3) return 'Reinforced';
  return deriveRawStatus(counters);
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
  const totalFailures =
    counters.short_jump +
    counters.overjump +
    counters.wall_bonk +
    counters.helper_overuse;
  const highest = Math.max(
    counters.short_jump,
    counters.overjump,
    counters.wall_bonk,
    counters.helper_overuse
  );
  if (counters.overjump >= 10 || counters.helper_overuse >= 10) return 'Cursed';
  if (highest >= 10 || totalFailures >= 10) return 'Haunted';
  return 'Quiet';
}

function deriveArtifacts(
  zoneId: ZoneId,
  counters: ZoneMutationCounters,
  status: ZoneStatus,
  impactSites: ImpactSite[]
): Artifact[] {
  const artifacts: Artifact[] = [];
  const helpfulBucket =
    counters.short_jump >= counters.wall_bonk ? 'short_jump' : 'wall_bonk';
  const helpfulCount = counters[helpfulBucket];
  if (helpfulCount >= 3) {
    artifacts.push(
      makeArtifact(zoneId, helpfulBucket, helpfulCount, status, impactSites)
    );
  }

  const hazardBucket =
    counters.overjump >= counters.helper_overuse
      ? 'overjump'
      : 'helper_overuse';
  const hazardCount = counters[hazardBucket];
  if (hazardCount >= 3) {
    artifacts.push(
      makeArtifact(zoneId, hazardBucket, hazardCount, status, impactSites)
    );
  }

  if (counters.successfulClears >= 3) {
    artifacts.push(
      makeArtifact(
        zoneId,
        'successful_clear',
        counters.successfulClears,
        status,
        impactSites
      )
    );
  }

  return artifacts.slice(0, 3);
}

function deriveSiteArtifacts(
  site: ImpactSite,
  counters: SiteMutationCounters,
  status: ZoneStatus,
  seeded: SiteMutationCounters
): Artifact[] {
  const artifacts: Artifact[] = [];
  const helpfulBucket =
    counters.short_jump >= counters.wall_bonk ? 'short_jump' : 'wall_bonk';
  const helpfulCount = counters[helpfulBucket];
  if (helpfulCount >= 3) {
    artifacts.push(
      makeSiteArtifact(
        site,
        helpfulBucket,
        helpfulCount,
        status,
        seeded[helpfulBucket]
      )
    );
  }

  const hazardBucket =
    counters.overjump >= counters.helper_overuse
      ? 'overjump'
      : 'helper_overuse';
  const hazardCount = counters[hazardBucket];
  if (hazardCount >= 3) {
    artifacts.push(
      makeSiteArtifact(
        site,
        hazardBucket,
        hazardCount,
        status,
        seeded[hazardBucket]
      )
    );
  }

  if (counters.successfulClears >= 3) {
    artifacts.push(
      makeSiteArtifact(
        site,
        'successful_clear',
        counters.successfulClears,
        status,
        seeded.successfulClears
      )
    );
  }

  return artifacts;
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
  status: ZoneStatus,
  impactSites: ImpactSite[]
): Artifact {
  const site = impactSiteForBucket(impactSites, bucket);
  const seededCount = Math.min(
    count,
    bucket === 'successful_clear'
      ? seededCounters[zoneId].successfulClears
      : seededCounters[zoneId][bucket]
  );
  return makeSiteArtifact(site, bucket, count, status, seededCount);
}

function makeSiteArtifact(
  site: ImpactSite,
  bucket: FailureBucket | 'successful_clear',
  count: number,
  status: ZoneStatus,
  seededCounter: number
): Artifact {
  const slot = artifactSlot(site, bucket);
  const stabilized = status === 'Stabilized';
  const seededCount = Math.min(count, seededCounter);
  const organicCount = Math.max(0, count - seededCount);

  if (bucket === 'successful_clear') {
    return {
      ...slot,
      id: `${site.id}-lantern-trail`,
      type: 'lantern_trail',
      zoneId: site.zoneId,
      siteId: site.id,
      siteName: site.name,
      anchorPlatformId: site.anchorPlatformId,
      bucket,
      solid: false,
      label: `${count} clean climbs lit this line.`,
      count,
      seededCount,
      organicCount,
    };
  }

  const type = bucketArtifactType(bucket, count, stabilized);
  return {
    ...slot,
    id: `${site.id}-${bucket}`,
    type,
    zoneId: site.zoneId,
    siteId: site.id,
    siteName: site.name,
    anchorPlatformId: site.anchorPlatformId,
    bucket,
    solid: type !== 'lantern_trail',
    label: artifactLabel(type, count),
    count,
    seededCount,
    organicCount,
  };
}

function impactSiteForBucket(
  impactSites: ImpactSite[],
  bucket: FailureBucket | 'successful_clear'
): ImpactSite {
  const index =
    bucket === 'short_jump' || bucket === 'successful_clear'
      ? 0
      : bucket === 'wall_bonk'
        ? 1
        : 2;
  const site = impactSites[index] ?? impactSites[0];
  if (!site) throw new Error('Cannot derive an artifact without an impact site.');
  return site;
}

function artifactSlot(
  site: ImpactSite,
  bucket: FailureBucket | 'successful_clear'
): Rect {
  if (bucket === 'short_jump') return site.helperSlot;
  if (bucket === 'wall_bonk' || bucket === 'successful_clear')
    return site.ghostSlot;
  return site.hazardSlot;
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
  return 'Cursed Brick';
}

function artifactLabel(type: ArtifactType, count: number): string {
  if (type === 'corpse_stack') return `${count} falls made this foothold.`;
  if (type === 'mercy_nail') return `${count} falls hammered this nail.`;
  if (type === 'ghost_platform')
    return `${count} bonks left a one-use ghost.`;
  if (type === 'cursed_brick')
    return `${count} falls cursed this crumbling brick.`;
  return `${count} clean climbs left a trail.`;
}
