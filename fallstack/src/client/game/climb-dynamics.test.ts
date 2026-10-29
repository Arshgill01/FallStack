/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BIOME_FOR_ZONE,
  GUST_TUNING,
  LOW_GRAVITY_SCALE,
  SLICK_GROUND_SETTLE,
  ventStrengthAt,
  zonesForBiome,
} from '../../shared/game/biomes.js';
import { MOVEMENT_TUNING } from '../../shared/game/movement.js';
import { POWER_UP_TUNING } from '../../shared/game/powerups.js';
import { generateDailyTower } from '../../shared/game/tower.js';
import { ClimbDynamics } from './climb-dynamics.js';

const SEED = 'fallstack-2026-10-29';

function dynamicsFor(climber: 'pilgrim' | 'wick' | 'kite' | 'diver' = 'pilgrim') {
  const tower = generateDailyTower(SEED);
  const dynamics = new ClimbDynamics();
  dynamics.setTower(SEED, tower.platforms);
  dynamics.setClimber(climber);
  return { dynamics, tower };
}

void test('only the Crown changes gravity and only the Archive skids', () => {
  const { dynamics } = dynamicsFor();
  const crown = zonesForBiome('orrery_crown')[0]!;
  const archive = zonesForBiome('rime_archive')[0]!;
  const loom = zonesForBiome('gale_loom')[0]!;
  const still = { x: 240, y: 0, velocityY: 0, airborne: false, nowMs: 0 };
  assert.equal(
    dynamics.airForces({ ...still, zoneId: crown }).extraGravityY,
    (LOW_GRAVITY_SCALE - 1) * MOVEMENT_TUNING.gravityY
  );
  assert.equal(dynamics.airForces({ ...still, zoneId: loom }).extraGravityY, 0);
  assert.equal(dynamics.groundSettle(archive), SLICK_GROUND_SETTLE);
});

void test('gusts push only airborne climbers inside the Gale Loom', () => {
  const { dynamics } = dynamicsFor();
  const loom = zonesForBiome('gale_loom')[0]!;
  const kiln = zonesForBiome('kiln_hollow')[0]!;
  const during = GUST_TUNING.gustStartMs + 200;
  const air = { x: 240, y: 0, velocityY: 0, airborne: true, nowMs: during };
  assert.notEqual(dynamics.airForces({ ...air, zoneId: loom }).accelerationX, 0);
  assert.equal(dynamics.airForces({ ...air, zoneId: kiln }).accelerationX, 0);
  assert.equal(
    dynamics.airForces({ ...air, zoneId: loom, airborne: false }).accelerationX,
    0
  );
});

void test('an active vent lifts an airborne climber inside its column', () => {
  const { dynamics } = dynamicsFor();
  const vent = dynamics.vents[0]!;
  let now = 0;
  while (ventStrengthAt(now, vent) < 1) now += 10;
  const forces = dynamics.airForces({
    zoneId: vent.zoneId,
    x: vent.centerX,
    y: (vent.yTop + vent.yBottom) / 2,
    velocityY: 0,
    airborne: true,
    nowMs: now,
  });
  assert.equal(forces.ventId, vent.id);
  assert.ok(forces.extraGravityY < -MOVEMENT_TUNING.gravityY, 'net lift');
});

void test('Updraft only softens a descent', () => {
  const { dynamics } = dynamicsFor('kite');
  dynamics.loadout.timedUntil.updraft = 10_000;
  const zoneId = zonesForBiome('tidewell')[0]!;
  const base = { zoneId, x: 240, y: 0, airborne: true, nowMs: 100 };
  const falling = dynamics.airForces({ ...base, velocityY: 300 });
  const rising = dynamics.airForces({ ...base, velocityY: -300 });
  assert.equal(falling.maxFallVelocityY, POWER_UP_TUNING.updraftMaxFallVelocityY);
  assert.ok(falling.extraGravityY < 0);
  assert.equal(rising.maxFallVelocityY, null);
  assert.equal(rising.extraGravityY, 0);
});

void test('springs answer only their own ledges', () => {
  const { dynamics, tower } = dynamicsFor();
  const spring = [...dynamics.springs][0]!;
  const plain = tower.platforms.find(
    (p) => BIOME_FOR_ZONE[p.zoneId] === 'tidewell' && !dynamics.springs.has(p.id)
  )!;
  assert.ok(dynamics.springRebound(spring, 800, false)! < 0);
  assert.equal(dynamics.springRebound(spring, 800, true), null);
  assert.equal(dynamics.springRebound(plain.id, 800, false), null);
  assert.equal(dynamics.springRebound(null, 800, false), null);
});

void test('Second Wind and Safety Thread spend held charges', () => {
  const { dynamics } = dynamicsFor();
  assert.equal(dynamics.trySecondWind(1), null);
  dynamics.loadout.held.second_wind = 1;
  const hop = dynamics.trySecondWind(-1)!;
  assert.equal(hop.y, POWER_UP_TUNING.secondWindVelocityY);
  assert.equal(hop.x, -POWER_UP_TUNING.secondWindSteerVelocityX);
  assert.equal(dynamics.trySecondWind(0), null);

  dynamics.noteSafeLanding(200, 5000);
  assert.equal(dynamics.tryThreadCatch(5100, 400, true), null, 'no thread held');
  dynamics.loadout.held.thread = 1;
  assert.equal(dynamics.tryThreadCatch(5100, 400, false), null, 'not far enough');
  assert.deepEqual(dynamics.tryThreadCatch(5100, 400, true), { x: 200, y: 5000 });
  assert.equal(dynamics.loadout.held.thread, 0);
});

void test('pickups are collected once, only in active zones, and re-arm on respawn', () => {
  const { dynamics } = dynamicsFor();
  const pickup = dynamics.pickups[0]!;
  const player = { x: pickup.x, y: pickup.y, width: 20, height: 28 };
  assert.deepEqual(dynamics.collectTouching(player, new Set(), 0), []);
  const zones = new Set([pickup.zoneId]);
  assert.equal(dynamics.collectTouching(player, zones, 0).length, 1);
  assert.equal(dynamics.collectTouching(player, zones, 0).length, 0);
  dynamics.onRespawn({ x: 240, y: 0 });
  assert.equal(dynamics.collectTouching(player, zones, 0).length, 1);
});
