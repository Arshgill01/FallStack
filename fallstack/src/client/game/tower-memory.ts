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
  revisionLabel: string;
  dateLabel: string;
  zones: TowerMemoryZone[];
  recentBeats: MutationBeat[];
  summitCopy: string;
  achievements: TowerMemoryAchievement[];
  rolloverCopy: string;
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
        statusLabel: macroStatusLabel(macroZones),
        siteId: primary?.id ?? null,
        siteName: primary?.name ?? null,
        detail: primary
          ? siteMemoryCopy(primary)
          : 'No shared mark has taken hold.',
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
      ? 'This board seals at 00:00 UTC. A fresh community tower opens next.'
      : 'Local practice resets at 00:00 UTC. No shared marks are being written.',
  };
}

function macroStatusLabel(zones: ZoneSnapshot[]): string {
  return (
    [...zones].sort(
      (left, right) => statusStoryScore(right.status) - statusStoryScore(left.status)
    )[0]?.statusLabel ?? 'Untouched'
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

  if (bucket === 'short_jump')
    return `${count} short ${plural(count, 'jump')} raised this foothold.`;
  if (bucket === 'wall_bonk')
    return `${count} wall ${plural(count, 'bonk')} left a one-use ghost.`;
  if (bucket === 'overjump')
    return `${count} ${plural(count, 'overjump')} cursed this landing.`;
  return `${count} helper ${plural(count, 'slip')} warped this landing.`;
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
  const artifact = [...site.artifacts].sort(
    (left, right) => artifactStoryScore(right) - artifactStoryScore(left)
  )[0];
  return artifact ? artifactName(artifact) : null;
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
