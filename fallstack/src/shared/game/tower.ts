import type { ZoneId } from './mutation';

export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 2280;
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
    yTop: 260,
    yBottom: 900,
    recoveryY: 936,
    checkpointY: 900,
  },
  {
    id: 'bell_shaft',
    name: 'Bell Shaft',
    yTop: 900,
    yBottom: 1620,
    recoveryY: 1658,
    checkpointY: 1620,
  },
  {
    id: 'lower_ruins',
    name: 'Lower Ruins',
    yTop: 1620,
    yBottom: 2220,
    recoveryY: 2260,
    checkpointY: 2220,
  },
];

const BASE_PLATFORMS: Platform[] = [
  { id: 'start', zoneId: 'lower_ruins', x: 44, y: 2164, width: 168, height: 28, kind: 'stone' },
  { id: 'first-gap', zoneId: 'lower_ruins', x: 262, y: 2076, width: 130, height: 24, kind: 'stone' },
  { id: 'low-left', zoneId: 'lower_ruins', x: 90, y: 1970, width: 124, height: 24, kind: 'stone' },
  { id: 'low-right', zoneId: 'lower_ruins', x: 272, y: 1878, width: 118, height: 22, kind: 'stone' },
  { id: 'ruin-lip', zoneId: 'lower_ruins', x: 118, y: 1778, width: 144, height: 24, kind: 'stone' },
  { id: 'ruin-checkpoint', zoneId: 'lower_ruins', x: 276, y: 1668, width: 156, height: 24, kind: 'stone' },

  { id: 'bell-entry', zoneId: 'bell_shaft', x: 54, y: 1586, width: 132, height: 22, kind: 'metal' },
  { id: 'bell-right', zoneId: 'bell_shaft', x: 290, y: 1492, width: 100, height: 20, kind: 'metal' },
  { id: 'bell-mid', zoneId: 'bell_shaft', x: 158, y: 1392, width: 92, height: 20, kind: 'metal' },
  { id: 'bell-left', zoneId: 'bell_shaft', x: 50, y: 1294, width: 94, height: 20, kind: 'metal' },
  { id: 'bell-narrow', zoneId: 'bell_shaft', x: 268, y: 1196, width: 88, height: 20, kind: 'metal' },
  { id: 'bell-checkpoint', zoneId: 'bell_shaft', x: 124, y: 1076, width: 128, height: 22, kind: 'metal' },

  { id: 'moon-entry', zoneId: 'moon_roof', x: 302, y: 982, width: 104, height: 20, kind: 'moon' },
  { id: 'moon-left', zoneId: 'moon_roof', x: 92, y: 882, width: 92, height: 20, kind: 'moon' },
  { id: 'moon-right', zoneId: 'moon_roof', x: 288, y: 778, width: 84, height: 20, kind: 'moon' },
  { id: 'moon-shelf', zoneId: 'moon_roof', x: 126, y: 664, width: 86, height: 20, kind: 'moon' },
  { id: 'moon-last', zoneId: 'moon_roof', x: 276, y: 548, width: 86, height: 20, kind: 'moon' },
  { id: 'summit', zoneId: 'moon_roof', x: 116, y: 392, width: 172, height: 26, kind: 'summit' },
];

export const CHUNK_LIBRARY: TowerChunk[] = [
  makeChunk('lower-ruins-known-good', 'lower_ruins', 1, 3, [
    'start',
    'first-gap',
    'low-left',
    'low-right',
    'ruin-lip',
    'ruin-checkpoint',
  ]),
  makeChunk('bell-shaft-known-good', 'bell_shaft', 3, 5, [
    'bell-entry',
    'bell-right',
    'bell-mid',
    'bell-left',
    'bell-narrow',
    'bell-checkpoint',
  ]),
  makeChunk('moon-roof-known-good', 'moon_roof', 5, 7, [
    'moon-entry',
    'moon-left',
    'moon-right',
    'moon-shelf',
    'moon-last',
    'summit',
  ]),
];

export const PLATFORMS = generateDailyTower(KNOWN_GOOD_SEED).platforms;

export function generateDailyTower(seed: string): GeneratedTower {
  const jitter = seed === KNOWN_GOOD_SEED ? null : createPrng(seed);
  const chunks = ZONES.slice()
    .reverse()
    .map((zone) => {
      const chunk = CHUNK_LIBRARY.find((candidate) => candidate.theme === zone.id);
      if (!chunk) throw new Error(`Missing chunk for ${zone.id}`);
      return chunk;
    });

  const platforms = BASE_PLATFORMS.map((platform) => varyPlatform(platform, jitter));
  const tower = {
    seed,
    zones: ZONES,
    platforms,
    chunks,
  };

  if (validateTower(tower)) return tower;
  if (seed === KNOWN_GOOD_SEED) return tower;
  return generateDailyTower(KNOWN_GOOD_SEED);
}

export function validateTower(tower: GeneratedTower): boolean {
  const byZone = new Map<ZoneId, Platform[]>();
  for (const zone of ZONES) byZone.set(zone.id, []);

  for (const platform of tower.platforms) {
    if (platform.x < 0 || platform.x + platform.width > WORLD_WIDTH) return false;
    if (platform.y < 0 || platform.y + platform.height > WORLD_HEIGHT) return false;
    byZone.get(platform.zoneId)?.push(platform);
  }

  if (!tower.platforms.some((platform) => platform.id === 'summit' && platform.kind === 'summit')) return false;

  for (const platforms of byZone.values()) {
    const ordered = [...platforms].sort((a, b) => b.y - a.y);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      if (!isReachable(ordered[i]!, ordered[i + 1]!)) return false;
    }
  }

  return true;
}

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

function makeChunk(
  id: string,
  theme: ZoneId,
  difficultyMin: number,
  difficultyMax: number,
  ledgeIds: string[]
): TowerChunk {
  const ledges = ledgeIds.map((ledgeId) => {
    const platform = BASE_PLATFORMS.find((candidate) => candidate.id === ledgeId);
    if (!platform) throw new Error(`Missing platform ${ledgeId}`);
    return platform;
  });
  const ordered = [...ledges].sort((a, b) => b.y - a.y);
  const entrance = ordered[0]!;
  const exit = ordered[ordered.length - 1]!;

  return {
    id,
    theme,
    difficultyMin,
    difficultyMax,
    height: Math.abs(exit.y - entrance.y),
    entranceConnector: connectorFor(entrance),
    exitConnector: connectorFor(exit),
    ledges,
  };
}

function connectorFor(platform: Platform): Connector {
  return {
    xMin: platform.x,
    xMax: platform.x + platform.width,
    y: platform.y,
  };
}

function varyPlatform(platform: Platform, random: (() => number) | null): Platform {
  if (!random || platform.id === 'start' || platform.id === 'summit') return { ...platform };

  const xOffset = Math.round((random() - 0.5) * 14);
  const widthOffset = Math.round((random() - 0.5) * 18);
  const width = clamp(platform.width + widthOffset, platform.width - 10, platform.width + 10);
  const x = clamp(platform.x + xOffset, 16, WORLD_WIDTH - width - 16);

  return {
    ...platform,
    x,
    width,
  };
}

function isReachable(from: Platform, to: Platform): boolean {
  const fromCenter = from.x + from.width / 2;
  const toCenter = to.x + to.width / 2;
  const horizontal = Math.abs(toCenter - fromCenter);
  const vertical = from.y - to.y;

  return horizontal <= 275 && vertical >= 0 && vertical <= 170;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
