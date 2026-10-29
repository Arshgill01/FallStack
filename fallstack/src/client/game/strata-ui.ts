import {
  BIOME_IDS,
  BIOMES,
  biomeForZone,
  zonesForBiome,
  type BiomeId,
  type GustPhase,
} from '../../shared/game/biomes.js';
import {
  DEFAULT_CLIMBER_ID,
  parseClimberId,
  type ClimberId,
} from '../../shared/game/climbers.js';
import type { LoadoutChip, PowerUpKind } from '../../shared/game/powerups.js';
import { ZONE_IDS, type ZoneId } from '../../shared/game/zones.js';

declare global {
  interface Window {
    fallstackClimber?: ClimberId;
  }
}

export type ClimberEventDetail = { climberId: ClimberId };
export type LoadoutEventDetail = { chips: LoadoutChip[] };
export type PickupEventDetail = { kind: PowerUpKind };
export type GustEventDetail = { phase: GustPhase; direction: -1 | 1 } | null;
export type StrataMomentDetail = { kind: 'spring' | 'hop' | 'thread' };

export const CLIMBER_STORAGE_KEY = 'fallstack:climber';

// The choice is a per-device convenience; storage can be missing in private
// windows or locked-down webviews, so every access is guarded.
export function readStoredClimber(): ClimberId {
  try {
    return parseClimberId(localStorage.getItem(CLIMBER_STORAGE_KEY)) ?? DEFAULT_CLIMBER_ID;
  } catch {
    return DEFAULT_CLIMBER_ID;
  }
}

export function hasStoredClimber(): boolean {
  try {
    return parseClimberId(localStorage.getItem(CLIMBER_STORAGE_KEY)) !== null;
  } catch {
    return true;
  }
}

export function storeClimber(climberId: ClimberId): void {
  try {
    localStorage.setItem(CLIMBER_STORAGE_KEY, climberId);
  } catch {
    // Choice still applies for this session.
  }
}

export function zoneNumber(zoneId: ZoneId): number {
  return ZONE_IDS.indexOf(zoneId) + 1;
}

export function zoneDisplayName(zoneId: ZoneId): string {
  return biomeForZone(zoneId).name;
}

export type AltimeterBand = {
  biomeId: BiomeId;
  name: string;
  accent: string;
  zones: number;
  current: boolean;
};

// Top-down bands for the side altimeter, plus where the player sits in it.
export function altimeterFor(zoneId: ZoneId): {
  bands: AltimeterBand[];
  markerFromTop: number;
} {
  const current = biomeForZone(zoneId).id;
  const bands = [...BIOME_IDS].reverse().map((biomeId) => ({
    biomeId,
    name: BIOMES[biomeId].name,
    accent: BIOMES[biomeId].css.accent,
    zones: zonesForBiome(biomeId).length,
    current: biomeId === current,
  }));
  const index = ZONE_IDS.indexOf(zoneId);
  const markerFromTop = 1 - (index + 0.5) / ZONE_IDS.length;
  return { bands, markerFromTop };
}
