import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
  ZONE_NAMES,
  type ZoneId,
} from './zones.js';
import { MOVEMENT_TUNING } from './movement.js';

export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = ZONE_IDS.length * ZONE_HEIGHT;
export const KNOWN_GOOD_SEED = 'fallstack-known-good';
export const CHECKPOINT_RESPAWN_CENTER_X = 240;
const CHECKPOINT_STACK_CLEARANCE = 96;
const LATE_ROUTE_EDGE_MARGIN = 46;
const PROTECTED_OPENING_LEDGE_COUNT = 7;

export type PlatformKind = 'stone' | 'metal' | 'moon' | 'summit' | 'obstacle';

export type Platform = {
  id: string;
  zoneId: ZoneId;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: PlatformKind;
};

export type Connector = {
  xMin: number;
  xMax: number;
  y: number;
};

export type TowerChunk = {
  id: string;
  theme: ZoneId;
  archetype: TraversalArchetype;
  difficultyMin: number;
  difficultyMax: number;
  height: number;
  entranceConnector: Connector;
  exitConnector: Connector;
  ledges: Platform[];
};

export type TraversalArchetype =
  | 'switchback'
  | 'chimney'
  | 'orbit_gap'
  | 'narrow_shelf'
  | 'recovery_bowl'
  | 'checkpoint_approach';

export type GeneratedTower = {
  seed: string;
  zones: ZoneDefinition[];
  platforms: Platform[];
  chunks: TowerChunk[];
};

export type ZoneDefinition = {
  id: ZoneId;
  name: string;
  yTop: number;
  yBottom: number;
  recoveryY: number;
  checkpointY: number;
};

export const ZONES: ZoneDefinition[] = [...ZONE_IDS]
  .map((zoneId, index) => {
    const yBottom = WORLD_HEIGHT - index * ZONE_HEIGHT;
    const yTop = yBottom - ZONE_HEIGHT;
    return {
      id: zoneId,
      name: ZONE_NAMES[zoneId],
      yTop,
      yBottom,
      recoveryY: yBottom + 40,
      checkpointY: yBottom,
    };
  })
  .reverse();

// Helper to check if a y coordinate is in a zone
export function zoneForY(y: number): ZoneDefinition {
  return (
    ZONES.find((zone) => y >= zone.yTop && y < zone.yBottom) ??
    ZONES[ZONES.length - 1]!
  );
}

export function zoneById(zoneId: ZoneId): ZoneDefinition {
  return ZONES.find((zone) => zone.id === zoneId) ?? ZONES[ZONES.length - 1]!;
}

export function nextZoneId(zoneId: ZoneId): ZoneId | null {
  const index = ZONE_IDS.indexOf(zoneId);
  return index >= 0 ? (ZONE_IDS[index + 1] ?? null) : null;
}

// Generate procedurally stitched tower platforms based on a seed
export function generateDailyTower(seed: string): GeneratedTower {
  const prng = createPrng(seed);
  const platforms: Platform[] = [];

  // Start platform at the bottom
  let prevY = WORLD_HEIGHT - 60;
  const prevX = 180;
  const prevW = 120;
  let prevCenter = prevX + prevW / 2;

  platforms.push({
    id: 'start',
    zoneId: BOTTOM_ZONE_ID,
    x: prevX,
    y: prevY,
    width: prevW,
    height: 28,
    kind: 'stone',
  });

  // Climb up procedurally to the top
  let count = 1;
  const checkpointYLevels = ZONES.map((zone) => zone.yTop).filter((y) => y > 0);

  while (
    prevY >
    MOVEMENT_TUNING.topConnectorY + MOVEMENT_TUNING.reachableVertical - 10
  ) {
    // Determine target Y for the next platform
    let nextY = prevY - Math.round(96 + prng() * 28);

    // If crossing a checkpoint level, force a checkpoint platform there
    for (const cpY of checkpointYLevels) {
      if (prevY > cpY && nextY <= cpY) {
        nextY = cpY;
        break;
      }
      if (
        prevY > cpY &&
        nextY > cpY &&
        nextY - cpY < CHECKPOINT_STACK_CLEARANCE
      ) {
        nextY =
          prevY - cpY <= MOVEMENT_TUNING.reachableVertical
            ? cpY
            : cpY + CHECKPOINT_STACK_CLEARANCE;
        break;
      }
    }

    // Keep the final generated ledge far enough below the fixed connector to
    // expose its top surface instead of presenting another underside ceiling.
    const minimumSummitApproachY = MOVEMENT_TUNING.topConnectorY + 80;
    if (nextY < minimumSummitApproachY) {
      nextY = minimumSummitApproachY;
    }

    const zone = zoneForY(nextY);
    let pWidth = Math.round(94 + prng() * 28);

    // Checkpoints are wider/more forgiving
    const isCP = checkpointYLevels.includes(nextY);
    if (isCP) {
      pWidth = 148;
    }

    // Set horizontal coordinate based on the shared movement reachability budget.
    const traversal = traversalForZone(zone.id);
    const maxOffset = traversal.maxHorizontalStep;

    // As we get close to the summit, gradually pull the target center towards 240
    let centerTarget = prevCenter;
    if (nextY < 800) {
      const pull = Math.min(1, (800 - nextY) / 450);
      centerTarget = prevCenter + (240 - prevCenter) * pull;
    }

    const nextCenter = isCP
      ? checkpointCenterForApproach(prevCenter, pWidth)
      : chooseNextCenter({
          centerTarget,
          maxOffset,
          minOffset: traversal.minHorizontalStep,
          platformWidth: pWidth,
          prevCenter,
          sideMargin:
            count <= PROTECTED_OPENING_LEDGE_COUNT
              ? 30
              : LATE_ROUTE_EDGE_MARGIN,
          prng,
        });
    const nextX = nextCenter - pWidth / 2;

    const kind = platformKindForZone(zone.id);
    const pId = isCP ? `${zone.id}-checkpoint` : `ledge-${zone.id}-${count}`;

    platforms.push({
      id: pId,
      zoneId: zone.id,
      x: nextX,
      y: nextY,
      width: pWidth,
      height: 22,
      kind,
    });

    if (!isCP && count % 8 === 0) {
      const obstacleW = 18;
      const obstacleH = 86;
      // Dress the outer edge of the landing. Putting this post on the
      // approach side makes its underside intersect the baseline jump arc.
      const side = nextCenter < prevCenter ? -1 : 1;
      const obstacleX = clamp(
        nextCenter + side * (pWidth / 2 + 42) - obstacleW / 2,
        18,
        WORLD_WIDTH - obstacleW - 18
      );
      const clearsLanding =
        side < 0
          ? obstacleX + obstacleW <= nextX
          : obstacleX >= nextX + pWidth;
      if (clearsLanding) {
        platforms.push({
          id: `obstacle-${zone.id}-${count}`,
          zoneId: zone.id,
          x: Math.round(obstacleX),
          y: nextY - 64,
          width: obstacleW,
          height: obstacleH,
          kind: 'obstacle',
        });
      }
    }

    // Optional ricochet chimney: the normal ledge sequence stays clear while
    // confident players can rebound between two visibly paired wall faces.
    if (!isCP && count % 12 === 0) {
      const wallWidth = 16;
      const wallHeight = 60;
      const wallTopOffset = 112;
      const halfGap = 82;
      const leftX = nextCenter - halfGap - wallWidth;
      const rightX = nextCenter + halfGap;
      if (leftX >= 18 && rightX + wallWidth <= WORLD_WIDTH - 18) {
        platforms.push(
          {
            id: `ricochet-${zone.id}-${count}-left`,
            zoneId: zone.id,
            x: Math.round(leftX),
            y: nextY - wallTopOffset,
            width: wallWidth,
            height: wallHeight,
            kind: 'obstacle',
          },
          {
            id: `ricochet-${zone.id}-${count}-right`,
            zoneId: zone.id,
            x: Math.round(rightX),
            y: nextY - wallTopOffset,
            width: wallWidth,
            height: wallHeight,
            kind: 'obstacle',
          }
        );
      }
    }

    prevY = nextY;
    prevCenter = nextCenter;
    count++;
  }

  // Bridge the last generated ledge to the fixed summit without breaking reachability.
  const transitionW = 90;
  // Enter the summit from one exposed side. Centering these final platforms
  // creates a low ceiling: the player hits the connector/summit underside
  // before rising high enough to land. Alternating across the tower leaves a
  // readable air lane while keeping both jumps inside the movement budget.
  const desiredTransitionCenter = prevCenter <= WORLD_WIDTH / 2 ? 360 : 120;
  const transitionCenter = clamp(
    desiredTransitionCenter,
    prevCenter - MOVEMENT_TUNING.reachableHorizontal,
    prevCenter + MOVEMENT_TUNING.reachableHorizontal
  );
  const transitionX = transitionCenter - transitionW / 2;
  platforms.push({
    id: `ledge-${TOP_ZONE_ID}-summit-connector`,
    zoneId: TOP_ZONE_ID,
    x: transitionX,
    y: MOVEMENT_TUNING.topConnectorY,
    width: transitionW,
    height: 22,
    kind: 'moon',
  });

  // Force Summit platform at the very top (y = 240)
  const summitY = 240;
  const summitW = 160;
  const summitX = 240 - summitW / 2; // Centered at 240

  platforms.push({
    id: 'summit',
    zoneId: TOP_ZONE_ID,
    x: summitX,
    y: summitY,
    width: summitW,
    height: 26,
    kind: 'summit',
  });

  const collisionSafePlatforms = removeRouteBlockingObstacles(platforms);

  // Expose generated zone chunks for validation and downstream metadata.
  const chunks: TowerChunk[] = ZONES.map((zone) => {
    const zoneLedges = collisionSafePlatforms.filter(
      (p) => p.zoneId === zone.id && isRoutePlatform(p)
    );
    const entrance = zoneLedges[0] ?? collisionSafePlatforms[0]!;
    const exit =
      zoneLedges[zoneLedges.length - 1] ??
      collisionSafePlatforms[collisionSafePlatforms.length - 1]!;
    return {
      id: `${zone.id}-chunk-gen`,
      theme: zone.id,
      archetype: traversalForZone(zone.id).archetype,
      difficultyMin: 2,
      difficultyMax: 6,
      height: Math.abs(exit.y - entrance.y),
      entranceConnector: {
        xMin: entrance.x,
        xMax: entrance.x + entrance.width,
        y: entrance.y,
      },
      exitConnector: { xMin: exit.x, xMax: exit.x + exit.width, y: exit.y },
      ledges: zoneLedges,
    };
  });

  return {
    seed,
    zones: ZONES,
    platforms: collisionSafePlatforms,
    chunks,
  };
}

function traversalForZone(zoneId: ZoneId): {
  archetype: TraversalArchetype;
  minHorizontalStep: number;
  maxHorizontalStep: number;
} {
  switch (zoneId) {
    case 'orbital_scrapyard':
    case 'dying_star_garden':
      return {
        archetype: 'switchback',
        minHorizontalStep: 78,
        maxHorizontalStep: 132,
      };
    case 'crater_foundry':
    case 'neutron_forge':
      return {
        archetype: 'narrow_shelf',
        minHorizontalStep: 96,
        maxHorizontalStep: 145,
      };
    case 'comet_reef':
    case 'galaxy_reef':
      return {
        archetype: 'orbit_gap',
        minHorizontalStep: 88,
        maxHorizontalStep: 140,
      };
    case 'nebula_vault':
    case 'dwarf_garden':
      return {
        archetype: 'recovery_bowl',
        minHorizontalStep: 68,
        maxHorizontalStep: 112,
      };
    case 'pulsar_spine':
    case 'black_hole_chapel':
      return {
        archetype: 'chimney',
        minHorizontalStep: 68,
        maxHorizontalStep: 96,
      };
    case 'ring_citadel':
    case 'event_horizon_crown':
      return {
        archetype: 'checkpoint_approach',
        minHorizontalStep: 74,
        maxHorizontalStep: 124,
      };
  }
}

function platformKindForZone(zoneId: ZoneId): PlatformKind {
  const index = ZONE_IDS.indexOf(zoneId);
  if (index >= 8) return 'moon';
  if (index >= 4) return 'metal';
  return 'stone';
}

function checkpointCenterForApproach(
  previousCenter: number,
  checkpointWidth: number
): number {
  const respawnMargin = 15;
  const offset = checkpointWidth / 2 - respawnMargin;
  return previousCenter <= CHECKPOINT_RESPAWN_CENTER_X
    ? CHECKPOINT_RESPAWN_CENTER_X + offset
    : CHECKPOINT_RESPAWN_CENTER_X - offset;
}

export const CHUNK_LIBRARY: TowerChunk[] =
  generateDailyTower(KNOWN_GOOD_SEED).chunks;
export const PLATFORMS = generateDailyTower(KNOWN_GOOD_SEED).platforms;

export function isRoutePlatform(platform: Platform): boolean {
  return platform.kind !== 'obstacle';
}

function removeRouteBlockingObstacles(platforms: Platform[]): Platform[] {
  const route = platforms.filter(isRoutePlatform);
  const blockedIds = new Set<string>();
  for (const obstacle of platforms.filter(
    (platform) => platform.kind === 'obstacle'
  )) {
    if (!route.some((platform) => rectanglesOverlap(obstacle, platform)))
      continue;
    if (obstacle.id.startsWith('ricochet-')) {
      const pairPrefix = obstacle.id.replace(/-(?:left|right)$/, '');
      for (const candidate of platforms) {
        if (candidate.id.startsWith(`${pairPrefix}-`))
          blockedIds.add(candidate.id);
      }
    } else {
      blockedIds.add(obstacle.id);
    }
  }
  return platforms.filter((platform) => !blockedIds.has(platform.id));
}

export function validateTower(tower: GeneratedTower): boolean {
  const byZone = new Map<ZoneId, Platform[]>();
  for (const zone of ZONES) byZone.set(zone.id, []);

  for (const platform of tower.platforms) {
    if (platform.x < 0 || platform.x + platform.width > WORLD_WIDTH)
      return false;
    if (platform.y < 0 || platform.y + platform.height > WORLD_HEIGHT)
      return false;
    if (isRoutePlatform(platform)) byZone.get(platform.zoneId)?.push(platform);
  }

  const routePlatforms = tower.platforms.filter(isRoutePlatform);
  if (
    tower.platforms
      .filter((platform) => platform.kind === 'obstacle')
      .some((obstacle) =>
        routePlatforms.some((platform) =>
          rectanglesOverlap(obstacle, platform)
        )
      )
  )
    return false;

  if (
    !tower.platforms.some(
      (platform) => platform.id === 'summit' && platform.kind === 'summit'
    )
  )
    return false;

  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y);
  for (let i = 0; i < route.length - 1; i += 1) {
    if (!isReachable(route[i]!, route[i + 1]!)) return false;
  }

  for (const platforms of byZone.values()) {
    if (platforms.length === 0) return false;
    const ordered = [...platforms].sort((a, b) => b.y - a.y);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (!isReachable(ordered[i]!, ordered[i + 1]!)) return false;
    }
  }

  return true;
}

function rectanglesOverlap(left: Platform, right: Platform): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function isReachable(from: Platform, to: Platform): boolean {
  const fromCenter = from.x + from.width / 2;
  const toCenter = to.x + to.width / 2;
  const horizontal = Math.abs(toCenter - fromCenter);
  const vertical = from.y - to.y;

  return (
    horizontal <= MOVEMENT_TUNING.reachableHorizontal &&
    vertical >= 0 &&
    vertical <= MOVEMENT_TUNING.reachableVertical
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chooseNextCenter(args: {
  centerTarget: number;
  maxOffset: number;
  minOffset: number;
  platformWidth: number;
  prevCenter: number;
  sideMargin: number;
  prng: () => number;
}): number {
  const minBound = args.sideMargin + args.platformWidth / 2;
  const maxBound = WORLD_WIDTH - args.sideMargin - args.platformWidth / 2;
  const left = {
    min: Math.max(
      minBound,
      args.centerTarget - args.maxOffset,
      args.prevCenter - args.maxOffset
    ),
    max: Math.min(
      maxBound,
      args.centerTarget + args.maxOffset,
      args.prevCenter - args.minOffset
    ),
  };
  const right = {
    min: Math.max(
      minBound,
      args.centerTarget - args.maxOffset,
      args.prevCenter + args.minOffset
    ),
    max: Math.min(
      maxBound,
      args.centerTarget + args.maxOffset,
      args.prevCenter + args.maxOffset
    ),
  };
  const ranges = args.prng() < 0.5 ? [left, right] : [right, left];
  const range = ranges.find((candidate) => candidate.max >= candidate.min);

  if (!range) {
    return Math.round(clamp(args.centerTarget, minBound, maxBound));
  }

  return Math.round(range.min + args.prng() * (range.max - range.min));
}

function createPrng(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
