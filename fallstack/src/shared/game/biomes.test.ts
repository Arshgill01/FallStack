/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BIOME_FOR_ZONE,
  BIOME_IDS,
  BIOMES,
  biomeFeel,
  biomeForZone,
  DEFAULT_GROUND_SETTLE,
  gustAccelerationX,
  gustStateAt,
  GUST_TUNING,
  isBiomeEntryZone,
  LOW_GRAVITY_SCALE,
  routeLedges,
  SLICK_GROUND_SETTLE,
  springLedgeIds,
  springReboundVelocityY,
  SPRING_TUNING,
  ventColumnsForTower,
  ventContains,
  ventStrengthAt,
  VENT_TUNING,
  zonesForBiome,
} from './biomes.js';
import { generateDailyTower, KNOWN_GOOD_SEED } from './tower.js';
import { BOTTOM_ZONE_ID, TOP_ZONE_ID, ZONE_IDS } from './zones.js';

const SEEDS = [KNOWN_GOOD_SEED, 'fallstack-2026-10-29', 'fallstack-2026-11-02'];

void test('every zone belongs to exactly one of five biomes, in climb order', () => {
  assert.equal(BIOME_IDS.length, 5);
  const ordinals = ZONE_IDS.map((zoneId) => biomeForZone(zoneId).ordinal);
  assert.deepEqual(
    ordinals,
    [...ordinals].sort((a, b) => a - b),
    'biomes never go back down the tower'
  );
  for (const biomeId of BIOME_IDS) {
    assert.ok(zonesForBiome(biomeId).length >= 2, `${biomeId} spans 2+ zones`);
  }
  assert.equal(BIOME_FOR_ZONE[BOTTOM_ZONE_ID], 'kiln_hollow');
  assert.equal(BIOME_FOR_ZONE[TOP_ZONE_ID], 'orrery_crown');
  assert.equal(new Set(BIOME_IDS.map((id) => BIOMES[id].mechanic)).size, 5);
});

void test('biome entry zones are the first zone of each biome only', () => {
  const entries = ZONE_IDS.filter(isBiomeEntryZone);
  assert.equal(entries.length, 5);
  assert.equal(entries[0], BOTTOM_ZONE_ID);
});

void test('vents only breathe inside Kiln Hollow and between real jumps', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    const vents = ventColumnsForTower(seed, tower.platforms);
    assert.ok(vents.length >= 2, `${seed} has vents`);
    for (const vent of vents) {
      assert.equal(BIOME_FOR_ZONE[vent.zoneId], 'kiln_hollow');
      assert.ok(vent.yTop < vent.yBottom);
      assert.ok(vent.centerX > 0 && vent.centerX < 480);
    }
    assert.deepEqual(vents, ventColumnsForTower(seed, tower.platforms));
  }
});

void test('no jump corridor in the tower passes through a vent', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    const route = routeLedges(tower.platforms);
    const vents = ventColumnsForTower(seed, tower.platforms);
    for (let index = 0; index < route.length - 1; index++) {
      const lower = route[index]!;
      const upper = route[index + 1]!;
      const fromX = lower.x + lower.width / 2;
      const toX = upper.x + upper.width / 2;
      for (let t = 0.15; t <= 0.85; t += 0.05) {
        const point = {
          x: fromX + (toX - fromX) * t,
          y: lower.y - 14 + (upper.y - lower.y) * t,
        };
        for (const vent of vents)
          assert.equal(
            ventContains(vent, point),
            false,
            `${seed} ${lower.id}->${upper.id} crosses ${vent.id}`
          );
      }
    }
  }
});

void test('vent strength ramps within a beat and rests most of the cycle', () => {
  const vent = {
    id: 'v',
    zoneId: BOTTOM_ZONE_ID,
    centerX: 200,
    yTop: 0,
    yBottom: 300,
    phaseMs: 0,
  };
  let active = 0;
  for (let t = 0; t < VENT_TUNING.periodMs; t += 10) {
    const strength = ventStrengthAt(t, vent);
    assert.ok(strength >= 0 && strength <= 1);
    if (strength > 0) active++;
  }
  assert.ok(active / (VENT_TUNING.periodMs / 10) < 0.5);
  assert.equal(ventStrengthAt(VENT_TUNING.activeMs / 2, vent), 1);
  assert.equal(ventContains(vent, { x: 200, y: 150 }), true);
  assert.equal(ventContains(vent, { x: 200 + VENT_TUNING.width, y: 150 }), false);
});

void test('springs live on Tidewell ledges and only answer hard, unplanted landings', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    const springs = springLedgeIds(seed, tower.platforms);
    assert.ok(springs.size >= 2);
    for (const platform of tower.platforms.filter((p) => springs.has(p.id))) {
      assert.equal(BIOME_FOR_ZONE[platform.zoneId], 'tidewell');
      assert.ok(!platform.id.includes('checkpoint'));
    }
  }
  assert.equal(springReboundVelocityY(SPRING_TUNING.minImpactSpeed - 1, false), null);
  assert.equal(springReboundVelocityY(900, true), null);
  const soft = springReboundVelocityY(SPRING_TUNING.minImpactSpeed, false)!;
  const hard = springReboundVelocityY(5000, false)!;
  assert.ok(soft < 0 && soft >= SPRING_TUNING.maxReboundVelocityY);
  assert.equal(hard, SPRING_TUNING.maxReboundVelocityY);
});

void test('gusts are telegraphed in the same direction before they push', () => {
  const seed = 'fallstack-2026-10-29';
  for (let cycle = 0; cycle < 6; cycle++) {
    const base = cycle * GUST_TUNING.cycleMs;
    const warning = gustStateAt(base + GUST_TUNING.warningStartMs + 10, seed);
    const gust = gustStateAt(base + GUST_TUNING.gustStartMs + 10, seed);
    assert.equal(warning.phase, 'warning');
    assert.equal(gust.phase, 'gust');
    assert.equal(warning.direction, gust.direction);
    assert.equal(gustAccelerationX(warning, true), 0);
    assert.equal(gustAccelerationX(gust, false), 0, 'ground is sheltered');
    assert.ok(
      Math.abs(gustAccelerationX(gust, true)) <= GUST_TUNING.accelerationX
    );
  }
});

void test('biome feel only bends gravity in the Crown and friction in the Archive', () => {
  for (const zoneId of ZONE_IDS) {
    const feel = biomeFeel(zoneId);
    const mechanic = biomeForZone(zoneId).mechanic;
    assert.equal(feel.gravityScale, mechanic === 'low_gravity' ? LOW_GRAVITY_SCALE : 1);
    assert.equal(
      feel.groundSettle,
      mechanic === 'slick' ? SLICK_GROUND_SETTLE : DEFAULT_GROUND_SETTLE
    );
  }
});
