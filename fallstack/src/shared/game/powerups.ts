import { CLIMBERS, type ClimberId } from './climbers.js';
import { BIOME_FOR_ZONE, hashString, routeLedges } from './biomes.js';
import { WORLD_WIDTH, type Platform } from './tower.js';
import { ZONE_IDS, type ZoneId } from './zones.js';

// Pickups are a solo-run layer. They are placed deterministically from the
// daily seed so everyone sees the same detours, they never sit on the only
// route, and nothing about them is persisted or sent to the server.
export const POWER_UP_KINDS = [
  'spark',
  'updraft',
  'second_wind',
  'thread',
] as const;

export type PowerUpKind = (typeof POWER_UP_KINDS)[number];
export type TimedPowerUpKind = Extract<PowerUpKind, 'spark' | 'updraft'>;
export type HeldPowerUpKind = Extract<PowerUpKind, 'second_wind' | 'thread'>;

export type PowerUpDefinition = {
  kind: PowerUpKind;
  name: string;
  hint: string;
  css: { fill: string };
};

export const POWER_UPS: Record<PowerUpKind, PowerUpDefinition> = {
  spark: {
    kind: 'spark',
    name: 'Spark',
    hint: 'Quick charge — a full leap in a quarter second',
    css: { fill: '#FF7A3D' },
  },
  updraft: {
    kind: 'updraft',
    name: 'Updraft',
    hint: 'Your fall slows to a steerable drift',
    css: { fill: '#8FA8FF' },
  },
  second_wind: {
    kind: 'second_wind',
    name: 'Second Wind',
    hint: 'Tap Jump in mid-air for one hop',
    css: { fill: '#3FD1B5' },
  },
  thread: {
    kind: 'thread',
    name: 'Safety Thread',
    hint: 'Catches one fall and reels you to your last ledge',
    css: { fill: '#E8C35A' },
  },
};

export const POWER_UP_TUNING = {
  sparkDurationMs: 10_000,
  // chargeMs is 600; Spark makes a full charge take 250ms.
  sparkChargeMultiplier: 2.4,
  updraftDurationMs: 6_000,
  updraftGravityScale: 0.38,
  updraftMaxFallVelocityY: 230,
  secondWindVelocityY: -760,
  secondWindSteerVelocityX: 240,
  // Falling this far below the last ledge you stood on counts as a fall for
  // Safety Thread, so it catches you before the run-ending recovery line.
  threadCatchDrop: 320,
  affinityDurationMultiplier: 1.6,
  affinityHeldCap: 2,
  defaultHeldCap: 1,
  pickupRadius: 13,
  pickupsPerZone: 2,
} as const;

export type PowerUpPickup = {
  id: string;
  kind: PowerUpKind;
  zoneId: ZoneId;
  x: number;
  y: number;
  placement: 'arc' | 'ledge_edge';
};

export function placePowerUps(
  seed: string,
  platforms: Platform[]
): PowerUpPickup[] {
  const pickups: PowerUpPickup[] = [];
  const route = routeLedges(platforms);
  for (const zoneId of ZONE_IDS) {
    const zoneRoute = route.filter((platform) => platform.zoneId === zoneId);
    if (zoneRoute.length < 3) continue;
    const zoneHash = hashString(`${seed}:pickups:${zoneId}`);
    const kinds = zoneKinds(zoneId, zoneHash);

    // An in-arc pickup hangs above the landing ledge of a mid-zone jump, so
    // grabbing it rewards a committed, slightly higher leap.
    const arcIndex = 1 + (zoneHash % Math.max(1, zoneRoute.length - 2));
    const lower = zoneRoute[arcIndex - 1]!;
    const upper = zoneRoute[arcIndex]!;
    pickups.push({
      id: `pickup:${zoneId}:arc`,
      kind: kinds[0],
      zoneId,
      x: clampX(
        (lower.x + lower.width / 2) * 0.35 + (upper.x + upper.width / 2) * 0.65
      ),
      y: upper.y - 58,
      placement: 'arc',
    });

    // A ledge-edge pickup sits at the far lip of a ledge: free if you walk
    // out to it, and a small risk because the lip is where people slip.
    const edgeIndex =
      (arcIndex + 1 + ((zoneHash >>> 8) % Math.max(1, zoneRoute.length - 2))) %
      zoneRoute.length;
    const edge = zoneRoute[edgeIndex === arcIndex ? (edgeIndex + 1) % zoneRoute.length : edgeIndex]!;
    const ledgeCenter = edge.x + edge.width / 2;
    const towardOuterWall = ledgeCenter < WORLD_WIDTH / 2 ? -1 : 1;
    pickups.push({
      id: `pickup:${zoneId}:edge`,
      kind: kinds[1],
      zoneId,
      x: clampX(ledgeCenter + towardOuterWall * (edge.width / 2 - 12)),
      y: edge.y - 20,
      placement: 'ledge_edge',
    });
  }
  return pickups;
}

// Biomes lean toward the pickup that answers their mechanic, without making
// any pickup biome-exclusive.
const BIOME_LEAN: Record<string, PowerUpKind> = {
  kiln_hollow: 'spark',
  tidewell: 'second_wind',
  gale_loom: 'updraft',
  rime_archive: 'thread',
  orrery_crown: 'second_wind',
};

function zoneKinds(zoneId: ZoneId, zoneHash: number): [PowerUpKind, PowerUpKind] {
  const lean = BIOME_LEAN[BIOME_FOR_ZONE[zoneId]] ?? 'spark';
  const others = POWER_UP_KINDS.filter((kind) => kind !== lean);
  const other = others[zoneHash % others.length]!;
  return zoneHash % 2 === 0 ? [lean, other] : [other, lean];
}

function clampX(x: number): number {
  return Math.round(Math.max(36, Math.min(WORLD_WIDTH - 36, x)));
}

export function pickupTouchesPlayer(
  pickup: Pick<PowerUpPickup, 'x' | 'y'>,
  player: { x: number; y: number; width: number; height: number }
): boolean {
  const r = POWER_UP_TUNING.pickupRadius;
  const nearestX = Math.max(
    player.x - player.width / 2,
    Math.min(pickup.x, player.x + player.width / 2)
  );
  const nearestY = Math.max(
    player.y - player.height / 2,
    Math.min(pickup.y, player.y + player.height / 2)
  );
  const dx = pickup.x - nearestX;
  const dy = pickup.y - nearestY;
  return dx * dx + dy * dy <= r * r;
}

// ── Loadout ──────────────────────────────────────────────────────────────────

export type Loadout = {
  timedUntil: Record<TimedPowerUpKind, number>;
  held: Record<HeldPowerUpKind, number>;
};

export function emptyLoadout(): Loadout {
  return {
    timedUntil: { spark: 0, updraft: 0 },
    held: { second_wind: 0, thread: 0 },
  };
}

export function isTimedKind(kind: PowerUpKind): kind is TimedPowerUpKind {
  return kind === 'spark' || kind === 'updraft';
}

export function powerUpDurationMs(
  kind: TimedPowerUpKind,
  climberId: ClimberId
): number {
  const base =
    kind === 'spark'
      ? POWER_UP_TUNING.sparkDurationMs
      : POWER_UP_TUNING.updraftDurationMs;
  return CLIMBERS[climberId].affinity === kind
    ? Math.round(base * POWER_UP_TUNING.affinityDurationMultiplier)
    : base;
}

export function heldCap(kind: HeldPowerUpKind, climberId: ClimberId): number {
  return CLIMBERS[climberId].affinity === kind
    ? POWER_UP_TUNING.affinityHeldCap
    : POWER_UP_TUNING.defaultHeldCap;
}

export function collectPowerUp(
  loadout: Loadout,
  kind: PowerUpKind,
  climberId: ClimberId,
  nowMs: number
): Loadout {
  if (isTimedKind(kind)) {
    // Refresh rather than stack, so a second pickup tops the timer back up.
    return {
      ...loadout,
      timedUntil: {
        ...loadout.timedUntil,
        [kind]: nowMs + powerUpDurationMs(kind, climberId),
      },
    };
  }
  return {
    ...loadout,
    held: {
      ...loadout.held,
      [kind]: Math.min(heldCap(kind, climberId), loadout.held[kind] + 1),
    },
  };
}

export function isPowerUpActive(
  loadout: Loadout,
  kind: TimedPowerUpKind,
  nowMs: number
): boolean {
  return loadout.timedUntil[kind] > nowMs;
}

export function consumeHeld(
  loadout: Loadout,
  kind: HeldPowerUpKind
): Loadout | null {
  if (loadout.held[kind] <= 0) return null;
  return {
    ...loadout,
    held: { ...loadout.held, [kind]: loadout.held[kind] - 1 },
  };
}

// Respawning clears timers (they belonged to that attempt) but keeps held
// charges, which are already capped so falling cannot farm them.
export function loadoutAfterRespawn(loadout: Loadout): Loadout {
  return { ...loadout, timedUntil: { spark: 0, updraft: 0 } };
}

export function effectiveChargeHeldMs(
  heldMs: number,
  loadout: Loadout,
  nowMs: number
): number {
  return isPowerUpActive(loadout, 'spark', nowMs)
    ? heldMs * POWER_UP_TUNING.sparkChargeMultiplier
    : heldMs;
}

export function shouldThreadCatch(input: {
  playerY: number;
  velocityY: number;
  lastSafeY: number | null;
  threads: number;
}): boolean {
  return (
    input.threads > 0 &&
    input.lastSafeY !== null &&
    input.velocityY > 0 &&
    input.playerY - input.lastSafeY > POWER_UP_TUNING.threadCatchDrop
  );
}

export type LoadoutChip = {
  kind: PowerUpKind;
  name: string;
  // Tenths of a second remaining for timed pickups; held count otherwise.
  value: number;
  timed: boolean;
  fraction: number;
};

export function loadoutChips(
  loadout: Loadout,
  climberId: ClimberId,
  nowMs: number
): LoadoutChip[] {
  const chips: LoadoutChip[] = [];
  for (const kind of ['spark', 'updraft'] as const) {
    const remaining = loadout.timedUntil[kind] - nowMs;
    if (remaining <= 0) continue;
    chips.push({
      kind,
      name: POWER_UPS[kind].name,
      value: Math.ceil(remaining / 100),
      timed: true,
      fraction: Math.min(1, remaining / powerUpDurationMs(kind, climberId)),
    });
  }
  for (const kind of ['second_wind', 'thread'] as const) {
    const count = loadout.held[kind];
    if (count <= 0) continue;
    chips.push({
      kind,
      name: POWER_UPS[kind].name,
      value: count,
      timed: false,
      fraction: count / heldCap(kind, climberId),
    });
  }
  return chips;
}
