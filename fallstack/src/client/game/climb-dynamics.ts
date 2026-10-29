import {
  biomeFeel,
  biomeForZone,
  gustAccelerationX,
  gustStateAt,
  springLedgeIds,
  springReboundVelocityY,
  ventColumnsForTower,
  ventContains,
  ventStrengthAt,
  VENT_TUNING,
  type GustState,
  type VentColumn,
} from '../../shared/game/biomes.js';
import {
  DEFAULT_CLIMBER_ID,
  type ClimberId,
} from '../../shared/game/climbers.js';
import { MOVEMENT_TUNING } from '../../shared/game/movement.js';
import {
  collectPowerUp,
  consumeHeld,
  effectiveChargeHeldMs,
  emptyLoadout,
  isPowerUpActive,
  loadoutAfterRespawn,
  loadoutChips,
  pickupTouchesPlayer,
  placePowerUps,
  POWER_UP_TUNING,
  shouldThreadCatch,
  type Loadout,
  type LoadoutChip,
  type PowerUpPickup,
} from '../../shared/game/powerups.js';
import type { Platform } from '../../shared/game/tower.js';
import type { ZoneId } from '../../shared/game/zones.js';

export type AirForces = {
  // Added to world gravity through body.setGravityY.
  extraGravityY: number;
  accelerationX: number;
  maxFallVelocityY: number | null;
  ventId: string | null;
};

// Everything that makes a climb move under the player, kept out of the Phaser
// scene so it can be exercised without a renderer. Coordinates are route-space
// (0..WORLD_WIDTH), matching tower platforms and pickups.
export class ClimbDynamics {
  climberId: ClimberId = DEFAULT_CLIMBER_ID;
  loadout: Loadout = emptyLoadout();
  pickups: PowerUpPickup[] = [];
  vents: VentColumn[] = [];
  springs = new Set<string>();
  collected = new Set<string>();
  lastSafe: { x: number; y: number } | null = null;
  private seed = '';

  setTower(seed: string, platforms: Platform[]) {
    this.seed = seed;
    this.pickups = placePowerUps(seed, platforms);
    this.vents = ventColumnsForTower(seed, platforms);
    this.springs = springLedgeIds(seed, platforms);
    this.collected.clear();
  }

  setClimber(climberId: ClimberId) {
    this.climberId = climberId;
  }

  gust(nowMs: number, zoneId: ZoneId): GustState | null {
    if (biomeForZone(zoneId).mechanic !== 'gusts') return null;
    return gustStateAt(nowMs, this.seed);
  }

  airForces(input: {
    zoneId: ZoneId;
    x: number;
    y: number;
    velocityY: number;
    airborne: boolean;
    nowMs: number;
  }): AirForces {
    const feel = biomeFeel(input.zoneId);
    let extraGravityY = (feel.gravityScale - 1) * MOVEMENT_TUNING.gravityY;
    let maxFallVelocityY: number | null = null;
    let ventId: string | null = null;

    if (input.airborne) {
      for (const vent of this.vents) {
        if (vent.zoneId !== input.zoneId) continue;
        if (!ventContains(vent, input)) continue;
        const strength = ventStrengthAt(input.nowMs, vent);
        if (strength <= 0) continue;
        extraGravityY += VENT_TUNING.liftAccelerationY * strength;
        ventId = vent.id;
        break;
      }
      if (
        input.velocityY > 0 &&
        isPowerUpActive(this.loadout, 'updraft', input.nowMs)
      ) {
        extraGravityY -=
          (1 - POWER_UP_TUNING.updraftGravityScale) *
          MOVEMENT_TUNING.gravityY *
          feel.gravityScale;
        maxFallVelocityY = POWER_UP_TUNING.updraftMaxFallVelocityY;
      }
    }

    const gust = this.gust(input.nowMs, input.zoneId);
    return {
      extraGravityY,
      accelerationX: gust ? gustAccelerationX(gust, input.airborne) : 0,
      maxFallVelocityY,
      ventId,
    };
  }

  scaleLaunch(
    launch: { x: number; y: number },
    zoneId: ZoneId
  ): { x: number; y: number } {
    const scale = biomeFeel(zoneId).launchScale;
    return { x: launch.x * scale, y: launch.y * scale };
  }

  groundSettle(zoneId: ZoneId): number {
    return biomeFeel(zoneId).groundSettle;
  }

  effectiveChargeMs(heldMs: number, nowMs: number): number {
    return effectiveChargeHeldMs(heldMs, this.loadout, nowMs);
  }

  springRebound(
    platformId: string | null,
    impactSpeed: number,
    plant: boolean
  ): number | null {
    if (!platformId || !this.springs.has(platformId)) return null;
    return springReboundVelocityY(impactSpeed, plant);
  }

  // Returns the hop velocity when a held Second Wind fires.
  trySecondWind(steer: -1 | 0 | 1): { x: number | null; y: number } | null {
    const next = consumeHeld(this.loadout, 'second_wind');
    if (!next) return null;
    this.loadout = next;
    return {
      x: steer === 0 ? null : steer * POWER_UP_TUNING.secondWindSteerVelocityX,
      y: POWER_UP_TUNING.secondWindVelocityY,
    };
  }

  noteSafeLanding(x: number, y: number) {
    this.lastSafe = { x, y };
  }

  // `runEnding` lets a held thread save a fall that reaches the recovery line
  // before it has dropped far enough to trip the normal catch.
  tryThreadCatch(
    playerY: number,
    velocityY: number,
    runEnding: boolean
  ): { x: number; y: number } | null {
    const dropped = shouldThreadCatch({
      playerY,
      velocityY,
      lastSafeY: this.lastSafe?.y ?? null,
      threads: this.loadout.held.thread,
    });
    if (!dropped && !runEnding) return null;
    const next = consumeHeld(this.loadout, 'thread');
    if (!next || !this.lastSafe) return null;
    this.loadout = next;
    return this.lastSafe;
  }

  collectTouching(
    player: { x: number; y: number; width: number; height: number },
    zoneIds: Set<ZoneId>,
    nowMs: number
  ): PowerUpPickup[] {
    const taken: PowerUpPickup[] = [];
    for (const pickup of this.pickups) {
      if (this.collected.has(pickup.id) || !zoneIds.has(pickup.zoneId)) continue;
      if (!pickupTouchesPlayer(pickup, player)) continue;
      this.collected.add(pickup.id);
      this.loadout = collectPowerUp(
        this.loadout,
        pickup.kind,
        this.climberId,
        nowMs
      );
      taken.push(pickup);
    }
    return taken;
  }

  onRespawn(checkpoint: { x: number; y: number }) {
    this.loadout = loadoutAfterRespawn(this.loadout);
    this.collected.clear();
    this.lastSafe = checkpoint;
  }

  chips(nowMs: number): LoadoutChip[] {
    return loadoutChips(this.loadout, this.climberId, nowMs);
  }
}

export function loadoutChipsKey(chips: LoadoutChip[]): string {
  return chips.map((chip) => `${chip.kind}:${chip.value}`).join('|');
}
