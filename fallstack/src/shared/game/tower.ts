import type { ZoneId } from './mutation';
import { MOVEMENT_TUNING } from './movement.js';

export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 6000;
export const KNOWN_GOOD_SEED = 'fallstack-known-good';

export type PlatformKind = 'stone' | 'metal' | 'moon' | 'summit';

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
  difficultyMin: number;
  difficultyMax: number;
  height: number;
  entranceConnector: Connector;
  exitConnector: Connector;
  ledges: Platform[];
};

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

export const ZONES: ZoneDefinition[] = [
  {
    id: 'moon_roof',
    name: 'Moon Roof',
    yTop: 0,
    yBottom: 2000,
    recoveryY: 2040,
    checkpointY: 2000,
  },
  {
    id: 'bell_shaft',
    name: 'Bell Shaft',
    yTop: 2000,
    yBottom: 4000,
    recoveryY: 4040,
    checkpointY: 4000,
  },
  {
    id: 'lower_ruins',
    name: 'Lower Ruins',
    yTop: 4000,
    yBottom: 6000,
    recoveryY: 6040,
    checkpointY: 6000,
  },
];

// Helper to check if a y coordinate is in a zone
export function zoneForY(y: number): ZoneDefinition {
  return ZONES.find((zone) => y >= zone.yTop && y < zone.yBottom) ?? ZONES[ZONES.length - 1]!;
}

export function zoneById(zoneId: ZoneId): ZoneDefinition {
  return ZONES.find((zone) => zone.id === zoneId) ?? ZONES[ZONES.length - 1]!;
}

export function nextZoneId(zoneId: ZoneId): ZoneId | null {
  if (zoneId === 'lower_ruins') return 'bell_shaft';
  if (zoneId === 'bell_shaft') return 'moon_roof';
  return null;
}

// Generate procedurally stitched tower platforms based on a seed
export function generateDailyTower(seed: string): GeneratedTower {
  const prng = createPrng(seed);
  const platforms: Platform[] = [];

  // Start platform at the bottom
  let prevY = 5940;
  const prevX = 180;
  const prevW = 120;
  let prevCenter = prevX + prevW / 2;

  platforms.push({
    id: 'start',
    zoneId: 'lower_ruins',
    x: prevX,
    y: prevY,
    width: prevW,
    height: 28,
    kind: 'stone',
  });

  // Climb up procedurally to the top
  let count = 1;
  const checkpointYLevels = [4000, 2000];

  while (prevY > MOVEMENT_TUNING.topConnectorY + MOVEMENT_TUNING.reachableVertical - 10) {
    // Determine target Y for the next platform
    let nextY = prevY - Math.round(115 + prng() * 32);

    // If crossing a checkpoint level, force a checkpoint platform there
    for (const cpY of checkpointYLevels) {
      if (prevY > cpY && nextY <= cpY) {
        nextY = cpY;
        break;
      }
    }

    const zone = zoneForY(nextY);
    let pWidth = Math.round(80 + prng() * 25);
    
    // Checkpoints are wider/more forgiving
    const isCP = checkpointYLevels.includes(nextY);
    if (isCP) {
      pWidth = 136;
    }

    // Set horizontal coordinate based on the shared movement reachability budget.
    const maxOffset = MOVEMENT_TUNING.generatedHorizontalStep;
    
    // As we get close to the summit, gradually pull the target center towards 240
    let centerTarget = prevCenter;
    if (nextY < 800) {
      const pull = Math.min(1, (800 - nextY) / 450);
      centerTarget = prevCenter + (240 - prevCenter) * pull;
    }

    const minCenter = Math.max(
      30 + pWidth / 2,
      centerTarget - maxOffset,
      prevCenter - maxOffset
    );
    const maxCenter = Math.min(
      WORLD_WIDTH - 30 - pWidth / 2,
      centerTarget + maxOffset,
      prevCenter + maxOffset
    );
    const nextCenter = Math.round(minCenter + prng() * (maxCenter - minCenter));
    const nextX = nextCenter - pWidth / 2;

    const kind: PlatformKind = zone.id === 'lower_ruins' ? 'stone' : zone.id === 'bell_shaft' ? 'metal' : 'moon';
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

    prevY = nextY;
    prevCenter = nextCenter;
    count++;
  }

  // Bridge the last generated ledge to the fixed summit without breaking reachability.
  const transitionW = 90;
  const transitionCenter = clamp(
    240,
    prevCenter - MOVEMENT_TUNING.generatedHorizontalStep,
    prevCenter + MOVEMENT_TUNING.generatedHorizontalStep
  );
  const transitionX = transitionCenter - transitionW / 2;
  platforms.push({
    id: 'ledge-moon_roof-summit-connector',
    zoneId: 'moon_roof',
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
    zoneId: 'moon_roof',
    x: summitX,
    y: summitY,
    width: summitW,
    height: 26,
    kind: 'summit',
  });

  // Expose generated zone chunks for validation and downstream metadata.
  const chunks: TowerChunk[] = ZONES.map((zone) => {
    const zoneLedges = platforms.filter((p) => p.zoneId === zone.id);
    const entrance = zoneLedges[0] ?? platforms[0]!;
    const exit = zoneLedges[zoneLedges.length - 1] ?? platforms[platforms.length - 1]!;
    return {
      id: `${zone.id}-chunk-gen`,
      theme: zone.id,
      difficultyMin: 2,
      difficultyMax: 6,
      height: Math.abs(exit.y - entrance.y),
      entranceConnector: { xMin: entrance.x, xMax: entrance.x + entrance.width, y: entrance.y },
      exitConnector: { xMin: exit.x, xMax: exit.x + exit.width, y: exit.y },
      ledges: zoneLedges,
    };
  });

  return {
    seed,
    zones: ZONES,
    platforms,
    chunks,
  };
}

export const CHUNK_LIBRARY: TowerChunk[] = generateDailyTower(KNOWN_GOOD_SEED).chunks;
export const PLATFORMS = generateDailyTower(KNOWN_GOOD_SEED).platforms;

export function validateTower(tower: GeneratedTower): boolean {
  const byZone = new Map<ZoneId, Platform[]>();
  for (const zone of ZONES) byZone.set(zone.id, []);

  for (const platform of tower.platforms) {
    if (platform.x < 0 || platform.x + platform.width > WORLD_WIDTH) return false;
    if (platform.y < 0 || platform.y + platform.height > WORLD_HEIGHT) return false;
    byZone.get(platform.zoneId)?.push(platform);
  }

  if (!tower.platforms.some((platform) => platform.id === 'summit' && platform.kind === 'summit')) return false;

  const route = [...tower.platforms].sort((a, b) => b.y - a.y);
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
