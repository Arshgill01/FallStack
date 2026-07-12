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

export function reliquaryZoneFor(zoneId: ZoneId): ReliquaryZone {
  const index = Math.max(0, ZONE_IDS.indexOf(zoneId));
  if (index < 4) return 'lower_ruins';
  if (index < 8) return 'bell_shaft';
  return 'moon_roof';
}

export function reliquaryZoneName(zoneId: ZoneId): string {
  return RELIQUARY_ZONE_NAMES[reliquaryZoneFor(zoneId)];
}
