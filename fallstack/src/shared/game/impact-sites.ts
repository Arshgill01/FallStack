import { ZONE_IDS, ZONE_NAMES, type ZoneId } from './zones.js';
import {
  WORLD_WIDTH,
  isRoutePlatform,
  zoneById,
  type GeneratedTower,
  type Platform,
} from './tower.js';

export const IMPACT_SITE_VERSION = 1;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImpactSite = {
  id: string;
  name: string;
  zoneId: ZoneId;
  anchorPlatformId: string;
  approachPlatformId: string;
  helperSlot: Rect;
  hazardSlot: Rect;
  ghostSlot: Rect;
  baselinePathIds: [string, string];
};

type RouteJump = {
  approach: Platform;
  landing: Platform;
};

export function deriveImpactSites(tower: GeneratedTower): ImpactSite[] {
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((left, right) => right.y - left.y);
  const jumpsByZone = new Map<ZoneId, RouteJump[]>();

  for (const zoneId of ZONE_IDS) jumpsByZone.set(zoneId, []);
  for (let index = 0; index < route.length - 1; index += 1) {
    const approach = route[index]!;
    const landing = route[index + 1]!;
    if (approach.zoneId !== landing.zoneId) continue;
    if (approach.y - (landing.y + landing.height) < 22) continue;
    jumpsByZone.get(approach.zoneId)?.push({ approach, landing });
  }

  return ZONE_IDS.flatMap((zoneId) => {
    const jumps = jumpsByZone.get(zoneId) ?? [];
    return candidateIndexes(jumps.length).map((jumpIndex, siteIndex) => {
      const jump = jumps[jumpIndex]!;
      return makeImpactSite(
        zoneId,
        jump,
        siteIndex,
        route,
        tower.platforms
      );
    });
  });
}

function candidateIndexes(length: number): number[] {
  if (length <= 3) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor((length - 1) / 2), length - 1];
}

function makeImpactSite(
  zoneId: ZoneId,
  jump: RouteJump,
  siteIndex: number,
  route: Platform[],
  allPlatforms: Platform[]
): ImpactSite {
  const approachCenter = centerX(jump.approach);
  const landingCenter = centerX(jump.landing);
  const ghostWidth = 64;
  const zone = zoneById(zoneId);
  const helperSlot = makeHelperSlot(
    jump.approach,
    jump.landing,
    zone.yTop,
    zone.yBottom,
    allPlatforms
  );

  return {
    id: `impact-v${IMPACT_SITE_VERSION}:${jump.approach.id}:${jump.landing.id}`,
    name: siteName(zoneId, siteIndex),
    zoneId,
    anchorPlatformId: jump.landing.id,
    approachPlatformId: jump.approach.id,
    helperSlot,
    hazardSlot: hazardSlot(
      jump.approach,
      jump.landing,
      zone.yTop,
      zone.yBottom,
      route
    ),
    ghostSlot: {
      x: boundedX(approachCenter * 0.35 + landingCenter * 0.65, ghostWidth),
      y: betweenPlatformY(
        jump.approach,
        jump.landing,
        jump.approach.y * 0.35 + jump.landing.y * 0.65,
        14,
        zone.yTop,
        zone.yBottom
      ),
      width: ghostWidth,
      height: 14,
    },
    baselinePathIds: [jump.approach.id, jump.landing.id],
  };
}

function makeHelperSlot(
  approach: Platform,
  landing: Platform,
  zoneTop: number,
  zoneBottom: number,
  allPlatforms: Platform[]
): Rect {
  const height = 18;
  const y = betweenPlatformY(
    approach,
    landing,
    (approach.y + landing.y) / 2,
    height,
    zoneTop,
    zoneBottom
  );
  const landingMovesRight = centerX(landing) >= centerX(approach);
  const gap = 8;
  const occupiedLeft = Math.min(approach.x, landing.x);
  const occupiedRight = Math.max(
    approach.x + approach.width,
    landing.x + landing.width
  );
  const sides = landingMovesRight
    ? (['right', 'left'] as const)
    : (['left', 'right'] as const);

  // Helpers remain fully solid, so they must not become a ceiling over the
  // launch ledge or a pocket under the landing. Prefer the far side of the
  // landing, where the extra foothold catches an overjump without changing
  // the baseline jump corridor.
  for (const inset of [46, 8]) {
    for (const width of [54, 48, 42, 36, 30, 24, 18]) {
      for (const side of sides) {
        const x =
          side === 'left'
            ? occupiedLeft - gap - width
            : occupiedRight + gap;
        const slot = { x: Math.round(x), y, width, height };
        if (
          slot.x < inset ||
          slot.x + slot.width > WORLD_WIDTH - inset
        )
          continue;
        if (allPlatforms.every((platform) => !rectsOverlap(slot, platform)))
          return slot;
      }
    }
  }

  throw new Error(
    `No route-safe helper slot for ${approach.id} -> ${landing.id}`
  );
}

function siteName(zoneId: ZoneId, siteIndex: number): string {
  if (zoneId === ZONE_IDS[0] && siteIndex === 0) return 'First Gap';
  const position = ['Lower Scar', 'Middle Scar', 'Upper Scar'][siteIndex];
  return `${ZONE_NAMES[zoneId]} · ${position ?? `Scar ${siteIndex + 1}`}`;
}

function hazardSlot(
  approach: Platform,
  landing: Platform,
  zoneTop: number,
  zoneBottom: number,
  route: Platform[]
): Rect {
  const width = 44;
  const gap = 8;
  const leftX = landing.x - width - gap;
  const rightX = landing.x + landing.width + gap;
  const landingMovesRight = centerX(landing) >= centerX(approach);
  const candidates = landingMovesRight ? [rightX, leftX] : [leftX, rightX];
  const edgeY = boundedY(landing.y - 4, 22, zoneTop, zoneBottom);
  const x = candidates.find((candidate) => {
    if (candidate < 8 || candidate + width > WORLD_WIDTH - 8) return false;
    return route.every(
      (platform) =>
        !rectsOverlap(
          { x: candidate, y: edgeY, width, height: 22 },
          platform
        )
    );
  });

  if (x !== undefined) {
    return { x: Math.round(x), y: edgeY, width, height: 22 };
  }

  return {
    x: boundedX((centerX(approach) + centerX(landing)) / 2, width),
    y: betweenPlatformY(
      approach,
      landing,
      (approach.y + landing.y) / 2,
      22,
      zoneTop,
      zoneBottom
    ),
    width,
    height: 22,
  };
}

function boundedX(center: number, width: number): number {
  return Math.round(clamp(center - width / 2, 8, WORLD_WIDTH - width - 8));
}

function boundedY(
  y: number,
  height: number,
  zoneTop: number,
  zoneBottom: number
): number {
  return Math.round(clamp(y, zoneTop, zoneBottom - height));
}

function betweenPlatformY(
  approach: Platform,
  landing: Platform,
  preferredY: number,
  height: number,
  zoneTop: number,
  zoneBottom: number
): number {
  const min = Math.max(zoneTop, landing.y + landing.height);
  const max = Math.min(zoneBottom - height, approach.y - height);
  if (max >= min) return Math.round(clamp(preferredY, min, max));
  return boundedY(preferredY, height, zoneTop, zoneBottom);
}

function centerX(platform: Platform): number {
  return platform.x + platform.width / 2;
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
