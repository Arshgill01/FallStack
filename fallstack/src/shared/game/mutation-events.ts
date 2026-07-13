import { deriveImpactSites, type ImpactSite } from './impact-sites.js';
import {
  type Artifact,
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
  const artifacts = new Map(
    snapshot.zones
      .flatMap((zone) => zone.artifacts)
      .map((artifact) => [artifact.id, artifact])
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
    ? (artifacts.get(observation.lastHelperArtifactId) ?? null)
    : null;
  if (
    observation.lastHelperArtifactId &&
    (!helper ||
      helper.zoneId !== observation.respawnZoneId ||
      !isHelperArtifact(helper))
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
  helper: Artifact | null,
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
  helper: Artifact | null
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

function isHelperArtifact(artifact: Artifact): boolean {
  return artifact.type === 'corpse_stack' || artifact.type === 'mercy_nail';
}

function invalidObservation(): FallResolution {
  return { ok: false, message: 'Invalid fall observation.' };
}
