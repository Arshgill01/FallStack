import { ZONE_IDS, type ZoneId } from './zones.js';
import type { Platform } from './tower.js';

// Biomes are a presentation and feel layer over the existing zone ladder. Zone
// IDs, tower geometry, and every mutation counter stay keyed exactly as before,
// so the shared board never needs to know which biome a zone belongs to.
export const BIOME_IDS = [
  'kiln_hollow',
  'tidewell',
  'gale_loom',
  'rime_archive',
  'orrery_crown',
] as const;

export type BiomeId = (typeof BIOME_IDS)[number];

export type BiomeMechanic =
  | 'vents'
  | 'springs'
  | 'gusts'
  | 'slick'
  | 'low_gravity';

export type BiomePalette = {
  sky: number;
  far: number;
  near: number;
  ledge: number;
  ledgeLit: number;
  ledgeShade: number;
  accent: number;
  accentLit: number;
  ink: number;
};

export type BiomeDefinition = {
  id: BiomeId;
  name: string;
  ordinal: number;
  mechanic: BiomeMechanic;
  mechanicLabel: string;
  rule: string;
  // CSS tokens the shell uses to tint its HUD to the biome the player is in.
  css: { ground: string; accent: string; accentInk: string };
  palette: BiomePalette;
};

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  kiln_hollow: {
    id: 'kiln_hollow',
    name: 'Kiln Hollow',
    ordinal: 1,
    mechanic: 'vents',
    mechanicLabel: 'Bellows vents',
    rule: 'Vents breathe on a beat. Jump through a puff and it lifts you.',
    css: { ground: '#2A1410', accent: '#FF7A3D', accentInk: '#16111A' },
    palette: {
      sky: 0x2a1410,
      far: 0x3e1e16,
      near: 0x4a2216,
      ledge: 0x8a3b22,
      ledgeLit: 0xf2b36b,
      ledgeShade: 0x5a2414,
      accent: 0xff7a3d,
      accentLit: 0xffb36b,
      ink: 0x16111a,
    },
  },
  tidewell: {
    id: 'tidewell',
    name: 'Tidewell',
    ordinal: 2,
    mechanic: 'springs',
    mechanicLabel: 'Bladder springs',
    rule: 'Land hard on a moss bladder and it springs you up. Hold Jump to plant.',
    css: { ground: '#0B2526', accent: '#3FD1B5', accentInk: '#0B2526' },
    palette: {
      sky: 0x0b2526,
      far: 0x123b3b,
      near: 0x1c5d57,
      ledge: 0x2e8c7a,
      ledgeLit: 0xa8f0de,
      ledgeShade: 0x1a5248,
      accent: 0x3fd1b5,
      accentLit: 0xa8f0de,
      ink: 0x16111a,
    },
  },
  gale_loom: {
    id: 'gale_loom',
    name: 'Gale Loom',
    ordinal: 3,
    mechanic: 'gusts',
    mechanicLabel: 'Crosswind gusts',
    rule: 'Gusts push you mid-flight. Watch the call, then steer into it.',
    css: { ground: '#161B36', accent: '#8FA8FF', accentInk: '#16111A' },
    palette: {
      sky: 0x161b36,
      far: 0x2a3366,
      near: 0x0f1328,
      ledge: 0x3b4680,
      ledgeLit: 0xd7deff,
      ledgeShade: 0x262d5a,
      accent: 0x8fa8ff,
      accentLit: 0xd7deff,
      ink: 0x16111a,
    },
  },
  rime_archive: {
    id: 'rime_archive',
    name: 'Rime Archive',
    ordinal: 4,
    mechanic: 'slick',
    mechanicLabel: 'Slick ledges',
    rule: 'Frozen shelves. You skid after landing — charge early to stop.',
    css: { ground: '#17222D', accent: '#9ED8FF', accentInk: '#16111A' },
    palette: {
      sky: 0x17222d,
      far: 0x22323f,
      near: 0x2f4556,
      ledge: 0x9ed8ff,
      ledgeLit: 0xffffff,
      ledgeShade: 0x5f93b5,
      accent: 0xcfe9ff,
      accentLit: 0xffffff,
      ink: 0x16111a,
    },
  },
  orrery_crown: {
    id: 'orrery_crown',
    name: 'Orrery Crown',
    ordinal: 5,
    mechanic: 'low_gravity',
    mechanicLabel: 'Low gravity',
    rule: 'Brass rings near the summit. Leaps float longer, and so do mistakes.',
    css: { ground: '#160D22', accent: '#E8C35A', accentInk: '#16111A' },
    palette: {
      sky: 0x160d22,
      far: 0x2a1a3c,
      near: 0x22142f,
      ledge: 0x6b4a1e,
      ledgeLit: 0xffe7a3,
      ledgeShade: 0x3f2a10,
      accent: 0xe8c35a,
      accentLit: 0xffe7a3,
      ink: 0x16111a,
    },
  },
};

// Twelve zones over five biomes: the two outer biomes get three zones so the
// first-session climb and the summit approach each have room to establish.
const BIOME_ZONE_SPANS: Record<BiomeId, number> = {
  kiln_hollow: 3,
  tidewell: 2,
  gale_loom: 3,
  rime_archive: 2,
  orrery_crown: 2,
};

export const BIOME_FOR_ZONE: Record<ZoneId, BiomeId> = (() => {
  const map = {} as Record<ZoneId, BiomeId>;
  let index = 0;
  for (const biomeId of BIOME_IDS) {
    for (let i = 0; i < BIOME_ZONE_SPANS[biomeId]; i++) {
      const zoneId = ZONE_IDS[index++];
      if (zoneId) map[zoneId] = biomeId;
    }
  }
  return map;
})();

export function biomeForZone(zoneId: ZoneId): BiomeDefinition {
  return BIOMES[BIOME_FOR_ZONE[zoneId] ?? 'kiln_hollow'];
}

export function zonesForBiome(biomeId: BiomeId): ZoneId[] {
  return ZONE_IDS.filter((zoneId) => BIOME_FOR_ZONE[zoneId] === biomeId);
}

export function isBiomeEntryZone(zoneId: ZoneId): boolean {
  return zonesForBiome(BIOME_FOR_ZONE[zoneId])[0] === zoneId;
}

// ── Kiln Hollow: bellows vents ───────────────────────────────────────────────

export const VENT_TUNING = {
  periodMs: 2400,
  activeMs: 950,
  rampMs: 180,
  width: 58,
  // Cancels most of gravity while airborne inside an active puff.
  liftAccelerationY: -1550,
} as const;

export type VentColumn = {
  id: string;
  zoneId: ZoneId;
  centerX: number;
  yTop: number;
  yBottom: number;
  phaseMs: number;
};

export function ventColumnsForTower(
  seed: string,
  platforms: Platform[]
): VentColumn[] {
  const vents: VentColumn[] = [];
  const route = routeLedges(platforms);
  for (let i = 0; i < route.length - 1; i++) {
    const lower = route[i]!;
    const upper = route[i + 1]!;
    if (BIOME_FOR_ZONE[lower.zoneId] !== 'kiln_hollow') continue;
    if (lower.zoneId !== upper.zoneId) continue;
    // Every third jump breathes, offset per seed so towers differ day to day.
    if ((i + hashString(seed)) % 3 !== 0) continue;
    const lowerCenter = lower.x + lower.width / 2;
    const upperCenter = upper.x + upper.width / 2;
    vents.push({
      id: `vent:${lower.id}`,
      zoneId: lower.zoneId,
      centerX: Math.round((lowerCenter + upperCenter) / 2),
      yTop: upper.y - 150,
      yBottom: lower.y,
      phaseMs: hashString(`${seed}:${lower.id}`) % VENT_TUNING.periodMs,
    });
  }
  return vents;
}

export function ventStrengthAt(timeMs: number, vent: VentColumn): number {
  const t = positiveModulo(timeMs + vent.phaseMs, VENT_TUNING.periodMs);
  if (t >= VENT_TUNING.activeMs) return 0;
  const rampIn = Math.min(1, t / VENT_TUNING.rampMs);
  const rampOut = Math.min(1, (VENT_TUNING.activeMs - t) / VENT_TUNING.rampMs);
  return Math.min(rampIn, rampOut);
}

export function ventContains(
  vent: VentColumn,
  point: { x: number; y: number }
): boolean {
  return (
    Math.abs(point.x - vent.centerX) <= VENT_TUNING.width / 2 &&
    point.y >= vent.yTop &&
    point.y <= vent.yBottom
  );
}

// ── Tidewell: bladder springs ────────────────────────────────────────────────

export const SPRING_TUNING = {
  minImpactSpeed: 430,
  reboundRatio: 0.66,
  minReboundVelocityY: -420,
  maxReboundVelocityY: -700,
} as const;

export function springLedgeIds(seed: string, platforms: Platform[]): Set<string> {
  const ids = new Set<string>();
  const offset = hashString(`${seed}:springs`) % 2;
  routeLedges(platforms).forEach((platform, index) => {
    if (BIOME_FOR_ZONE[platform.zoneId] !== 'tidewell') return;
    if ((index + offset) % 2 === 0) ids.add(platform.id);
  });
  return ids;
}

// Straight-up rebound so a spring returns you to the same ledge instead of
// throwing you off the route. Holding Jump on touchdown plants instead.
export function springReboundVelocityY(
  impactSpeed: number,
  plant: boolean
): number | null {
  if (plant || impactSpeed < SPRING_TUNING.minImpactSpeed) return null;
  const velocity = -impactSpeed * SPRING_TUNING.reboundRatio;
  return Math.max(
    SPRING_TUNING.maxReboundVelocityY,
    Math.min(SPRING_TUNING.minReboundVelocityY, velocity)
  );
}

// ── Gale Loom: crosswind gusts ───────────────────────────────────────────────

export const GUST_TUNING = {
  cycleMs: 5200,
  warningStartMs: 2500,
  gustStartMs: 3200,
  gustEndMs: 4700,
  accelerationX: 140,
} as const;

export type GustPhase = 'calm' | 'warning' | 'gust';

export type GustState = {
  phase: GustPhase;
  direction: -1 | 1;
  strength: number;
  // Milliseconds until the gust starts (warning) or ends (gust).
  msRemaining: number;
};

export function gustStateAt(timeMs: number, seed: string): GustState {
  const cycle = Math.floor(timeMs / GUST_TUNING.cycleMs);
  const t = positiveModulo(timeMs, GUST_TUNING.cycleMs);
  const direction: -1 | 1 = hashString(`${seed}:gust:${cycle}`) % 2 === 0 ? 1 : -1;
  if (t < GUST_TUNING.warningStartMs)
    return {
      phase: 'calm',
      direction,
      strength: 0,
      msRemaining: GUST_TUNING.gustStartMs - t,
    };
  if (t < GUST_TUNING.gustStartMs)
    return {
      phase: 'warning',
      direction,
      strength: 0,
      msRemaining: GUST_TUNING.gustStartMs - t,
    };
  if (t < GUST_TUNING.gustEndMs) {
    const span = GUST_TUNING.gustEndMs - GUST_TUNING.gustStartMs;
    const progress = (t - GUST_TUNING.gustStartMs) / span;
    return {
      phase: 'gust',
      direction,
      strength: Math.sin(Math.PI * Math.min(1, progress * 1.15)) * 0.35 + 0.65,
      msRemaining: GUST_TUNING.gustEndMs - t,
    };
  }
  return {
    phase: 'calm',
    direction,
    strength: 0,
    msRemaining: GUST_TUNING.cycleMs - t + GUST_TUNING.gustStartMs,
  };
}

export function gustAccelerationX(state: GustState, airborne: boolean): number {
  if (!airborne || state.phase !== 'gust') return 0;
  return state.direction * GUST_TUNING.accelerationX * state.strength;
}

// ── Rime Archive: slick ledges ───────────────────────────────────────────────

// Per-frame blend toward zero when grounded with no input. The default climb
// stops almost immediately; ice keeps some momentum so landings skid.
export const DEFAULT_GROUND_SETTLE = 0.32;
export const SLICK_GROUND_SETTLE = 0.12;

// ── Orrery Crown: low gravity ────────────────────────────────────────────────

export const LOW_GRAVITY_SCALE = 0.8;

export type BiomeFeel = {
  gravityScale: number;
  groundSettle: number;
};

export function biomeFeel(zoneId: ZoneId): BiomeFeel {
  const mechanic = biomeForZone(zoneId).mechanic;
  return {
    gravityScale: mechanic === 'low_gravity' ? LOW_GRAVITY_SCALE : 1,
    groundSettle:
      mechanic === 'slick' ? SLICK_GROUND_SETTLE : DEFAULT_GROUND_SETTLE,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function routeLedges(platforms: Platform[]): Platform[] {
  return platforms
    .filter(
      (platform) =>
        platform.kind !== 'obstacle' &&
        platform.kind !== 'summit' &&
        platform.id !== 'start' &&
        !platform.id.includes('checkpoint')
    )
    .sort((a, b) => b.y - a.y);
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}
