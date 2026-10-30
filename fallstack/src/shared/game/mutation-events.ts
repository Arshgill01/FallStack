import { deriveImpactSites, type ImpactSite } from './impact-sites.js';
import {
  earnedHelpers,
  earnedRescuers,
  type Artifact,
  type EarnedHelper,
  type EarnedRescuer,
  type FailureBucket,
  type GameSnapshot,
  type ZoneId,
} from './mutation.js';
import { generateDailyTower, type Platform } from './tower.js';

export type FallObservation = {
  attemptId: string;
  respawnZoneId: ZoneId;
  fallX: number;
  fallY: number;
  highestY: number;
  lastPlatformId: string | null;
  lastHelperArtifactId: string | null;
  wallBonkPlatformId: string | null;
  launchChargePercent: number;
  launchDirection: -1 | 0 | 1;
};

export type ResolvedFall = {
  zoneId: ZoneId;
  siteId: string;
  siteName: string;
  bucket: FailureBucket;
};

export type ResolvedFallObservation = FallObservation & ResolvedFall;

export type FallResolution =
  | { ok: true; value: ResolvedFall }
  | { ok: false; message: string };

export function resolveFallObservation(
  observation: FallObservation,
  snapshot: GameSnapshot
): FallResolution {
  const tower = generateDailyTower(snapshot.dailySeed);
  const platforms = new Map(
    tower.platforms.map((platform) => [platform.id, platform])
  );
  const helpers = new Map(
    earnedHelpers(snapshot.sites).map((helper) => [helper.id, helper])
  );

  if (
    !validPlatformEvidence(
      observation.lastPlatformId,
      platforms,
      observation.respawnZoneId
    )
  )
    return invalidObservation();
  if (
    !validPlatformEvidence(
      observation.wallBonkPlatformId,
      platforms,
      observation.respawnZoneId
    )
  )
    return invalidObservation();

  const helper = observation.lastHelperArtifactId
    ? (helpers.get(observation.lastHelperArtifactId) ?? null)
    : null;
  if (
    observation.lastHelperArtifactId &&
    (!helper || helper.zoneId !== observation.respawnZoneId)
  )
    return invalidObservation();

  const sites = deriveImpactSites(tower).filter(
    (site) => site.zoneId === observation.respawnZoneId
  );
  const site = resolveSite(
    sites,
    platforms,
    helper,
    observation.lastPlatformId,
    observation.wallBonkPlatformId,
    observation.fallX,
    observation.highestY
  );
  if (!site) return invalidObservation();

  return {
    ok: true,
    value: {
      zoneId: observation.respawnZoneId,
      siteId: site.id,
      siteName: site.name,
      bucket: classifyFailure(observation, helper),
    },
  };
}

// A jump that crosses a zone boundary moves the respawn zone mid-air, so a
// fall right after it still carries ledge/helper evidence from the zone below.
// The server rejects cross-zone evidence, so drop it and let the fall resolve
// by position inside the respawn zone instead of losing the fall entirely.
export function scopeFallEvidenceToZone<T extends FallObservation>(
  observation: T,
  platforms: readonly Pick<Platform, 'id' | 'zoneId'>[],
  artifacts: readonly Pick<Artifact, 'id' | 'zoneId'>[]
): T {
  const inZone = (
    id: string | null,
    candidates: readonly { id: string; zoneId: ZoneId }[]
  ) =>
    id !== null &&
    candidates.find((candidate) => candidate.id === id)?.zoneId ===
      observation.respawnZoneId
      ? id
      : null;
  return {
    ...observation,
    lastPlatformId: inZone(observation.lastPlatformId, platforms),
    wallBonkPlatformId: inZone(observation.wallBonkPlatformId, platforms),
    lastHelperArtifactId: inZone(observation.lastHelperArtifactId, artifacts),
  };
}

export function resolveClearSite(
  snapshot: GameSnapshot,
  zoneId: ZoneId
): { siteId: string; siteName: string } | null {
  const site = snapshot.sites
    .filter((candidate) => candidate.zoneId === zoneId)
    .sort(
      (left, right) =>
        siteFailureTotal(right) - siteFailureTotal(left)
    )[0];
  return site ? { siteId: site.id, siteName: site.name } : null;
}

export type ClearRescuer = EarnedRescuer & { siteName: string };

// The community artifacts a clear may thank: earned rescuers in the cleared
// zone, by id. Displaced-but-earned rescuers count, as with helper falls.
export function resolveClearRescuers(
  snapshot: GameSnapshot,
  zoneId: ZoneId,
  artifactIds: readonly string[]
): ClearRescuer[] {
  const rescuers = new Map(
    earnedRescuers(snapshot.sites).map((rescuer) => [rescuer.id, rescuer])
  );
  const names = new Map(snapshot.sites.map((site) => [site.id, site.name]));
  return [...new Set(artifactIds)].flatMap((id) => {
    const rescuer = rescuers.get(id);
    if (!rescuer || rescuer.zoneId !== zoneId) return [];
    return [{ ...rescuer, siteName: names.get(rescuer.siteId) ?? 'this zone' }];
  });
}

function siteFailureTotal(site: GameSnapshot['sites'][number]): number {
  return (
    site.counters.short_jump +
    site.counters.overjump +
    site.counters.wall_bonk +
    site.counters.helper_overuse
  );
}

function resolveSite(
  sites: ImpactSite[],
  platforms: Map<string, Platform>,
  helper: EarnedHelper | null,
  lastPlatformId: string | null,
  wallBonkPlatformId: string | null,
  fallX: number,
  highestY: number
): ImpactSite | null {
  if (helper) {
    const helperSite = sites.find((site) => site.id === helper.siteId);
    if (helperSite) return helperSite;
  }

  const evidencePlatformId = wallBonkPlatformId ?? lastPlatformId;
  if (evidencePlatformId) {
    const direct = sites.find((site) =>
      site.baselinePathIds.includes(evidencePlatformId)
    );
    if (direct) return direct;
  }

  return (
    [...sites].sort(
      (left, right) =>
        siteDistance(left, platforms, fallX, highestY) -
        siteDistance(right, platforms, fallX, highestY)
    )[0] ?? null
  );
}

function siteDistance(
  site: ImpactSite,
  platforms: Map<string, Platform>,
  x: number,
  y: number
): number {
  const anchor = platforms.get(site.anchorPlatformId);
  if (!anchor) return Number.POSITIVE_INFINITY;
  const anchorX = anchor.x + anchor.width / 2;
  return Math.hypot(anchorX - x, anchor.y - y);
}

function classifyFailure(
  observation: FallObservation,
  helper: EarnedHelper | null
): FailureBucket {
  if (helper) return 'helper_overuse';
  if (observation.wallBonkPlatformId) return 'wall_bonk';
  if (observation.launchChargePercent > 82) return 'overjump';
  return 'short_jump';
}

function validPlatformEvidence(
  id: string | null,
  platforms: Map<string, Platform>,
  zoneId: ZoneId
): boolean {
  return id === null || platforms.get(id)?.zoneId === zoneId;
}

function invalidObservation(): FallResolution {
  return { ok: false, message: 'Invalid fall observation.' };
}
