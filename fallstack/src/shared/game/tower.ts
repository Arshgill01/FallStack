import type { ZoneId } from './mutation';

export const WORLD_WIDTH = 480;
export const WORLD_HEIGHT = 2280;

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

export const PLATFORMS: Platform[] = [
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
