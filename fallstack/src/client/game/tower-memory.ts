import type {
  BoardSnapshot,
  MutationBeat,
} from '../../shared/game/board.js';
import type {
  Artifact,
  FailureBucket,
  GameSnapshot,
  SiteSnapshot,
  ZoneSnapshot,
} from '../../shared/game/mutation.js';
import {
  RELIQUARY_ZONE_NAMES,
  reliquaryZoneFor,
  type ReliquaryZone,
} from './art-direction.js';

export type TowerMemoryTone =
  | 'quiet'
  | 'helpful'
  | 'hazard'
  | 'stabilized';

export type TowerMemoryZone = {
  zoneId: ReliquaryZone;
  zoneName: string;
  statusLabel: string;
  siteId: string | null;
  siteName: string | null;
  detail: string;
  effect: string;
  artifactLabel: string | null;
  tone: TowerMemoryTone;
  latest: boolean;
};

export type TowerMemoryAchievement = {
  label: string;
  value: string;
};

export type TowerMemory = {
  scopeLabel: string;
  introCopy: string;
  revisionLabel: string;
  dateLabel: string;
  zones: TowerMemoryZone[];
  recentBeats: MutationBeat[];
  summitCopy: string;
  achievements: TowerMemoryAchievement[];
  rolloverCopy: string;
};

export type SessionStats = {
  falls: number;
  clears: number;
  summits: number;
};

export function deriveTowerMemory(snapshot: GameSnapshot): TowerMemory {
  const board = isBoardSnapshot(snapshot) ? snapshot : null;
  const recentBeats = board
    ? [...board.recentMutations]
        .sort((left, right) => right.revision - left.revision)
        .slice(0, 3)
    : [];
  const latestSiteId = recentBeats[0]?.siteId ?? null;

  return {
    scopeLabel: board?.scopeLabel ?? 'Local practice copy',
    introCopy: board
      ? `${board.scopeLabel} shaped this daily route. Read it from summit to spawn.`
      : 'This was local practice. No shared tower changed.',
    revisionLabel: board ? `BOARD r${board.revision}` : 'LOCAL · NOT SHARED',
    dateLabel: snapshot.dateKey,
    zones: (['moon_roof', 'bell_shaft', 'lower_ruins'] as const).map((zoneId) => {
      const primary = primarySite(
        snapshot.sites.filter((site) => reliquaryZoneFor(site.zoneId) === zoneId)
      );
      const macroZones = snapshot.zones.filter(
        (zone) => reliquaryZoneFor(zone.id) === zoneId
      );
      return {
        zoneId,
        zoneName: RELIQUARY_ZONE_NAMES[zoneId],
        statusLabel: primary
          ? siteEffectLabel(primary)
          : macroStatusLabel(macroZones),
        siteId: primary?.id ?? null,
        siteName: primary?.name ?? null,
        detail: primary
          ? siteMemoryCopy(primary)
          : 'No shared mark has taken hold.',
        effect: primary
          ? siteEffectCopy(primary)
          : 'No visible helper or hazard changes this route.',
        artifactLabel: primary ? preferredArtifactLabel(primary) : null,
        tone: primary ? siteTone(primary) : 'quiet',
        latest: primary?.id === latestSiteId,
      };
    }),
    recentBeats,
    summitCopy: snapshot.result.firstSummitUsername
      ? `Summit first claimed by ${snapshot.result.firstSummitUsername}.`
      : 'The summit is still unclaimed.',
    achievements: positiveAchievements(snapshot),
    rolloverCopy: board
      ? `At 00:00 UTC, ${board.scopeLabel} gets a fresh shared tower.`
      : 'Local practice resets at 00:00 UTC. No shared marks are being written.',
  };
}

export function towerResultCopy(
  snapshot: GameSnapshot,
  session: SessionStats
): string {
  const board = isBoardSnapshot(snapshot) ? snapshot : null;
  const scope = board?.scopeLabel ?? 'Local practice';
  const boardLine = board
    ? `${snapshot.organicFalls} community ${plural(snapshot.organicFalls, 'fall')} · ${snapshot.totalClears} clean ${plural(snapshot.totalClears, 'clear')} · ${snapshot.totalSummits} ${plural(snapshot.totalSummits, 'summit')} · board r${board.revision}`
    : 'Shared tower unchanged';
  return [
    `Fallstack · ${snapshot.dateKey} · ${scope}`,
    `My climb: ${session.falls} ${plural(session.falls, 'fall')} · ${session.clears} ${plural(session.clears, 'clear')} · ${session.summits} ${plural(session.summits, 'summit')}`,
    `Tower: ${boardLine}`,
  ].join('\n');
}

function macroStatusLabel(zones: ZoneSnapshot[]): string {
  return (
    [...zones].sort(
      (left, right) => statusStoryScore(right.status) - statusStoryScore(left.status)
    )[0]?.statusLabel ?? 'Low activity'
  );
}

function statusStoryScore(status: ZoneSnapshot['status']): number {
  if (status === 'Cursed') return 5;
  if (status === 'Stabilized') return 4;
  if (status === 'Haunted') return 3;
  if (status === 'Reinforced') return 2;
  return 1;
}

function isBoardSnapshot(snapshot: GameSnapshot): snapshot is BoardSnapshot {
  const candidate = snapshot as Partial<BoardSnapshot>;
  return (
    typeof candidate.boardId === 'string' &&
    typeof candidate.revision === 'number' &&
    Array.isArray(candidate.recentMutations)
  );
}

function primarySite(sites: SiteSnapshot[]): SiteSnapshot | null {
  return (
    [...sites].sort(
      (left, right) => siteStoryScore(right) - siteStoryScore(left)
    )[0] ?? null
  );
}

function siteStoryScore(site: SiteSnapshot): number {
  const organic = counterTotal(site.organicCounters);
  const combined = counterTotal(site.counters);
  const visible = site.artifacts.length > 0 ? 1 : 0;
  return organic * 1_000 + visible * 100 + combined;
}

function counterTotal(counters: SiteSnapshot['counters']): number {
  return (
    counters.short_jump +
    counters.overjump +
    counters.wall_bonk +
    counters.helper_overuse +
    counters.successfulClears
  );
}

function siteMemoryCopy(site: SiteSnapshot): string {
  if (site.status === 'Stabilized')
    return `${site.counters.successfulClears} clean clears stabilized this scar.`;
  if (site.status === 'Reinforced')
    return `${site.counters.successfulClears} clean clears reinforced this route.`;

  const [bucket, count] = dominantFailure(site);
  if (count === 0) {
    if (site.counters.successfulClears > 0) {
      return `${site.counters.successfulClears} clean ${plural(site.counters.successfulClears, 'clear')} marked this route.`;
    }
    return 'No shared mark has taken hold.';
  }

  const seeded = site.seededCounters[bucket];
  const organic = site.organicCounters[bucket];
  const cause =
    organic === 0
      ? `${seeded || count} opening ${failureScarName(bucket)} scars`
      : seeded === 0
        ? `${organic} community ${plural(organic, failureName(bucket))}`
        : `${seeded} opening + ${organic} community ${plural(organic, failureName(bucket))}`;
  if (bucket === 'short_jump') return `${cause} raised this foothold.`;
  if (bucket === 'wall_bonk') return `${cause} left a one-use ghost.`;
  if (bucket === 'overjump') return `${cause} cursed this landing.`;
  return `${cause} warped this landing.`;
}

function failureName(bucket: FailureBucket): string {
  if (bucket === 'short_jump') return 'short jump';
  if (bucket === 'wall_bonk') return 'wall bonk';
  if (bucket === 'overjump') return 'overjump';
  return 'helper slip';
}

function failureScarName(bucket: FailureBucket): string {
  if (bucket === 'short_jump') return 'short-jump';
  if (bucket === 'wall_bonk') return 'wall-bonk';
  if (bucket === 'overjump') return 'overjump';
  return 'helper-slip';
}

function dominantFailure(site: SiteSnapshot): [FailureBucket, number] {
  const entries: [FailureBucket, number][] = [
    ['short_jump', site.counters.short_jump],
    ['wall_bonk', site.counters.wall_bonk],
    ['overjump', site.counters.overjump],
    ['helper_overuse', site.counters.helper_overuse],
  ];
  return entries.sort((left, right) => right[1] - left[1])[0]!;
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function preferredArtifactLabel(site: SiteSnapshot): string | null {
  const artifact = preferredArtifact(site);
  return artifact ? artifactName(artifact) : null;
}

function preferredArtifact(site: SiteSnapshot): Artifact | undefined {
  return [...site.artifacts].sort(
    (left, right) => artifactStoryScore(right) - artifactStoryScore(left)
  )[0];
}

function siteEffectLabel(site: SiteSnapshot): string {
  const artifact = preferredArtifact(site);
  if (artifact?.type === 'cursed_brick') return 'Hazard active';
  if (artifact?.type === 'ghost_platform') return 'Ghost active';
  if (
    artifact?.type === 'corpse_stack' ||
    artifact?.type === 'mercy_nail'
  )
    return 'Helper active';
  if (
    site.status === 'Stabilized' ||
    site.status === 'Reinforced' ||
    artifact?.type === 'lantern_trail'
  )
    return 'Clean clears';
  return 'No active mark';
}

function siteEffectCopy(site: SiteSnapshot): string {
  const artifact = preferredArtifact(site);
  if (artifact?.type === 'cursed_brick')
    return 'Cursed Brick · crumbles shortly after landing.';
  if (artifact?.type === 'ghost_platform')
    return 'Ghost Platform · temporary one-way foothold.';
  if (artifact?.type === 'corpse_stack')
    return 'Corpse Stack · solid helper foothold.';
  if (artifact?.type === 'mercy_nail')
    return 'Mercy Nail · solid helper foothold.';
  if (
    site.status === 'Stabilized' ||
    site.status === 'Reinforced' ||
    artifact?.type === 'lantern_trail'
  )
    return 'Clean clears are repairing this route.';
  return 'No visible helper or hazard changes this route.';
}

function artifactStoryScore(artifact: Artifact): number {
  return (artifact.type === 'lantern_trail' ? 0 : 100) + artifact.count;
}

function artifactName(artifact: Artifact): string {
  if (artifact.type === 'corpse_stack') return 'Corpse Stack';
  if (artifact.type === 'mercy_nail') return 'Mercy Nail';
  if (artifact.type === 'ghost_platform') return 'Ghost Platform';
  if (artifact.type === 'cursed_brick') return 'Cursed Brick';
  return 'Lantern Trail';
}

function siteTone(site: SiteSnapshot): TowerMemoryTone {
  if (site.status === 'Stabilized' || site.status === 'Reinforced')
    return 'stabilized';
  const [bucket, count] = dominantFailure(site);
  if (count === 0) return 'quiet';
  if (bucket === 'overjump' || bucket === 'helper_overuse') return 'hazard';
  return 'helpful';
}

function positiveAchievements(
  snapshot: GameSnapshot
): TowerMemoryAchievement[] {
  const achievements: TowerMemoryAchievement[] = [];
  if (snapshot.result.highestClimberUsername) {
    achievements.push({
      label: 'Highest climber',
      value: `${snapshot.result.highestClimberUsername} · ${snapshot.result.highestClimberZone}`,
    });
  }
  if (snapshot.result.bestStabilizerUsername) {
    achievements.push({
      label: 'Best stabilizer',
      value: snapshot.result.bestStabilizerUsername,
    });
  }
  return achievements;
}
