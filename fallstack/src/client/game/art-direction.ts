import {
  ZONE_IDS,
  type ArtifactType,
  type ZoneId,
} from '../../shared/game/mutation.js';

export const RELIQUARY_COLORS = {
  washi: 0xf4efe2,
  washiDim: 0xd8cdb7,
  ink: 0x180d18,
  indigoDeep: 0x171426,
  indigo: 0x29243f,
  indigoLit: 0x45405f,
  burgundyDeep: 0x2b111d,
  burgundy: 0x592337,
  persimmon: 0xe95f45,
  persimmonDeep: 0x8e302b,
  gold: 0xd9b45c,
  goldDeep: 0x75552a,
  ghost: 0xbde5d9,
  ghostDeep: 0x397a70,
  danger: 0xf29a73,
} as const;

export type PlayerVisualState =
  | 'grounded'
  | 'charge'
  | 'airborne'
  | 'fall';

export function playerVisualDimensions(state: PlayerVisualState): {
  width: number;
  height: number;
} {
  if (state === 'charge') return { width: 32, height: 36 };
  if (state === 'airborne') return { width: 28, height: 44 };
  if (state === 'fall') return { width: 34, height: 38 };
  return { width: 30, height: 42 };
}

export type ArtifactVisualTier = 'base' | 'remembered' | 'saturated';

export function artifactVisualTier(count: number): ArtifactVisualTier {
  if (count >= 12) return 'saturated';
  if (count >= 6) return 'remembered';
  return 'base';
}

export function clampedArtifactLabelCenter(
  centerX: number,
  gameWidth: number,
  labelWidth = 148,
  gutter = 6
): number {
  const minimum = labelWidth / 2 + gutter;
  const maximum = Math.max(minimum, gameWidth - labelWidth / 2 - gutter);
  return Math.min(maximum, Math.max(minimum, centerX));
}

export type MotionDecision = {
  parallax: boolean;
  particles: boolean;
  idleOscillation: boolean;
  stateTweenMs: number;
};

export function motionDecision(reducedMotion: boolean): MotionDecision {
  return reducedMotion
    ? {
        parallax: false,
        particles: false,
        idleOscillation: false,
        stateTweenMs: 0,
      }
    : {
        parallax: true,
        particles: true,
        idleOscillation: true,
        stateTweenMs: 120,
      };
}

export function playerVisualState(input: {
  charging: boolean;
  grounded: boolean;
  velocityY: number;
}): PlayerVisualState {
  if (input.charging) return 'charge';
  if (input.grounded) return 'grounded';
  return input.velocityY > 160 ? 'fall' : 'airborne';
}

export const ARTIFACT_COLLISION_CLASS: Record<
  ArtifactType,
  'solid' | 'narrow-solid' | 'semi-solid' | 'hazardous' | 'visual-only'
> = {
  corpse_stack: 'solid',
  mercy_nail: 'narrow-solid',
  ghost_platform: 'semi-solid',
  cursed_brick: 'hazardous',
  lantern_trail: 'visual-only',
};

export function shouldAnimateArtifact(
  type: ArtifactType,
  reducedMotion: boolean
): boolean {
  if (reducedMotion) return false;
  return type === 'ghost_platform' || type === 'cursed_brick' || type === 'lantern_trail';
}

export type ReliquaryZone = 'lower_ruins' | 'bell_shaft' | 'moon_roof';

export const RELIQUARY_ZONE_NAMES: Record<ReliquaryZone, string> = {
  lower_ruins: 'Lower Ruins',
  bell_shaft: 'Bell Shaft',
  moon_roof: 'Moon Roof',
};

export type ReliquaryZonePalette = {
  outer: number;
  cavity: number;
  wall: number;
  wallLit: number;
  trim: number;
  trimLit: number;
  platform: number;
  platformLit: number;
  edge: number;
};

export const RELIQUARY_ZONE_PALETTES = {
  lower_ruins: {
    outer: 0x1c1422,
    cavity: 0x35171f,
    wall: 0x4a2730,
    wallLit: 0x704139,
    trim: 0x76512c,
    trimLit: 0xd9a453,
    platform: 0x4a3037,
    platformLit: 0x75504b,
    edge: 0xd8cdb7,
  },
  bell_shaft: {
    outer: 0x10191d,
    cavity: 0x17272a,
    wall: 0x263d3c,
    wallLit: 0x46645b,
    trim: 0x725d35,
    trimLit: 0xc69d4e,
    platform: 0x293c3b,
    platformLit: 0x567068,
    edge: 0xb89b55,
  },
  moon_roof: {
    outer: 0x111427,
    cavity: 0x1d2740,
    wall: 0x303b5a,
    wallLit: 0x596987,
    trim: 0x3f696c,
    trimLit: 0x9bcfc8,
    platform: 0x35405e,
    platformLit: 0x667594,
    edge: 0xbde5d9,
  },
} as const satisfies Record<ReliquaryZone, ReliquaryZonePalette>;

export const RELIQUARY_ZONE_TREATMENTS = {
  lower_ruins: {
    density: 'broad-broken-arches',
    platformMaterial: 'washi-repaired-stone',
    lightEmphasis: 'low-ember',
  },
  bell_shaft: {
    density: 'narrow-bound-piers',
    platformMaterial: 'gold-bound-metal',
    lightEmphasis: 'vertical-bell-glow',
  },
  moon_roof: {
    density: 'open-roof-teeth',
    platformMaterial: 'ghost-edged-moonstone',
    lightEmphasis: 'cold-roof-light',
  },
} as const satisfies Record<
  ReliquaryZone,
  {
    density: string;
    platformMaterial: string;
    lightEmphasis: string;
  }
>;

export function reliquaryZoneFor(zoneId: ZoneId): ReliquaryZone {
  const index = Math.max(0, ZONE_IDS.indexOf(zoneId));
  if (index < 4) return 'lower_ruins';
  if (index < 8) return 'bell_shaft';
  return 'moon_roof';
}

export function reliquaryZoneName(zoneId: ZoneId): string {
  return RELIQUARY_ZONE_NAMES[reliquaryZoneFor(zoneId)];
}
