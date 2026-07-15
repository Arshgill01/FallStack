/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chargePowerForHeldMs,
  chargeRatioForHeldMs,
  jumpArcForHeldMs,
  MOVEMENT_TUNING,
} from './movement.js';
import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
} from './mutation.js';
import {
  CHUNK_LIBRARY,
  CHECKPOINT_RESPAWN_CENTER_X,
  KNOWN_GOOD_SEED,
  PLATFORMS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
  generateDailyTower,
  isRoutePlatform,
  nextZoneId,
  validateTower,
  zoneForY,
  type Platform,
} from './tower.js';

void test('known-good tower has finite dimensions and a summit', () => {
  assert.equal(WORLD_WIDTH, 480);
  assert.equal(WORLD_HEIGHT, 17_280);
  assert.equal(ZONES.length, 12);
  assert.equal(WORLD_HEIGHT, ZONE_IDS.length * ZONE_HEIGHT);
  assert.ok(PLATFORMS.length >= 160 && PLATFORMS.length <= 220);
  assert.ok(
    PLATFORMS.filter(isRoutePlatform).length >= 150 &&
      PLATFORMS.filter(isRoutePlatform).length <= 175
  );
  assert.ok(
    PLATFORMS.some(
      (platform) => platform.id === 'summit' && platform.kind === 'summit'
    )
  );
  assert.ok(
    PLATFORMS.filter((platform) => platform.kind === 'obstacle').length >= 10
  );
});

void test('movement tuning supports generated tower reachability', () => {
  assert.ok(
    MOVEMENT_TUNING.generatedHorizontalStep <
      MOVEMENT_TUNING.reachableHorizontal
  );
  assert.ok(MOVEMENT_TUNING.generatedMinHorizontalStep > 0);
  assert.ok(
    MOVEMENT_TUNING.generatedMinHorizontalStep <
      MOVEMENT_TUNING.generatedHorizontalStep
  );
  assert.ok(MOVEMENT_TUNING.reachableVertical >= 147);
  assert.ok(MOVEMENT_TUNING.minChargePercent > 0);
  assert.ok(MOVEMENT_TUNING.minChargePercent < 1);
  assert.ok(
    MOVEMENT_TUNING.minLaunchVelocityX < MOVEMENT_TUNING.maxLaunchVelocityX
  );
  assert.ok(
    MOVEMENT_TUNING.maxLaunchVelocityY < MOVEMENT_TUNING.minLaunchVelocityY
  );
  assert.ok(
    MOVEMENT_TUNING.airSteerAccelerationX < MOVEMENT_TUNING.groundDragX
  );
  assert.ok(
    MOVEMENT_TUNING.wallBounceVelocityX > MOVEMENT_TUNING.wallBounceMinVelocityX
  );
  assert.equal(chargePowerForHeldMs(0), 0);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs * 2), 1);
  assert.equal(chargeRatioForHeldMs(0), MOVEMENT_TUNING.minChargePercent);
  assert.equal(chargeRatioForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
});

void test('the responsive controller produces quick useful arcs', () => {
  const tap = jumpArcForHeldMs(0);
  const half = jumpArcForHeldMs(MOVEMENT_TUNING.chargeMs / 2);
  const full = jumpArcForHeldMs(MOVEMENT_TUNING.chargeMs);

  assert.equal(MOVEMENT_TUNING.chargeMs, 600);
  assert.ok(tap.rise > 110);
  assert.ok(full.rise > 260);
  assert.ok(full.sameHeightDistance > 400);
  assert.ok(full.sameHeightDurationMs < 1200);
  assert.ok(tap.rise < half.rise && half.rise < full.rise);
});

void test('all platforms live inside the logical world', () => {
  for (const platform of PLATFORMS) {
    assert.ok(platform.x >= 0, platform.id);
    assert.ok(platform.x + platform.width <= WORLD_WIDTH, platform.id);
    assert.ok(platform.y >= 0, platform.id);
    assert.ok(platform.y + platform.height <= WORLD_HEIGHT, platform.id);
  }
});

void test('daily tower generation is deterministic by seed', () => {
  const first = generateDailyTower('fallstack-2026-07-08');
  const second = generateDailyTower('fallstack-2026-07-08');
  assert.deepEqual(first.platforms, second.platforms);
  assert.equal(validateTower(first), true);
});

void test('daily tower generation keeps sampled seeds reachable', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    assert.equal(validateTower(tower), true, `seed ${tower.seed}`);
  }
});

void test('generated checkpoints cover the fixed respawn position', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    const checkpoints = tower.platforms.filter((platform) =>
      platform.id.includes('checkpoint')
    );

    assert.equal(checkpoints.length, ZONES.length - 1, tower.seed);
    for (const checkpoint of checkpoints) {
      assert.ok(
        checkpoint.x <= CHECKPOINT_RESPAWN_CENTER_X - 10 &&
          checkpoint.x + checkpoint.width >= CHECKPOINT_RESPAWN_CENTER_X + 10,
        `${tower.seed}: ${checkpoint.id} misses respawn x`
      );
    }
  }
});

void test('daily tower generation avoids near-vertical ledge traps', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    const route = tower.platforms
      .filter(isRoutePlatform)
      .sort((a, b) => b.y - a.y);

    for (let routeIndex = 0; routeIndex < route.length - 1; routeIndex += 1) {
      const from = route[routeIndex]!;
      const to = route[routeIndex + 1]!;
      if (from.id.includes('summit') || to.id.includes('summit')) continue;
      if (from.id.includes('checkpoint') || to.id.includes('checkpoint'))
        continue;
      assert.ok(
        horizontalGap(from, to) >= MOVEMENT_TUNING.generatedMinHorizontalStep,
        `${tower.seed}: ${from.id} to ${to.id}`
      );
    }
  }
});

void test('current first checkpoint does not respawn over empty air', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const firstCheckpoint = tower.platforms.find(
    (platform) => platform.id === `${BOTTOM_ZONE_ID}-checkpoint`
  );
  const bottomZone = ZONES.find((zone) => zone.id === BOTTOM_ZONE_ID);

  assert.ok(firstCheckpoint);
  assert.ok(bottomZone);
  assert.equal(firstCheckpoint.y, bottomZone.yTop);
  assert.ok(firstCheckpoint.x <= CHECKPOINT_RESPAWN_CENTER_X - 10);
  assert.ok(
    firstCheckpoint.x + firstCheckpoint.width >=
      CHECKPOINT_RESPAWN_CENTER_X + 10
  );
});

void test('generated checkpoints leave a horizontal entry lane below their underside', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-checkpoint-entry-${index}`);
    const route = tower.platforms
      .filter(isRoutePlatform)
      .sort((a, b) => b.y - a.y);
    for (let routeIndex = 1; routeIndex < route.length; routeIndex += 1) {
      const checkpoint = route[routeIndex]!;
      if (!checkpoint.id.includes('checkpoint')) continue;
      const approach = route[routeIndex - 1]!;
      assert.ok(
        approach.y - checkpoint.y >= 80,
        `${tower.seed}: ${approach.id} is stacked under ${checkpoint.id}`
      );
      assert.ok(
        horizontalGap(approach, checkpoint) >= 50,
        `${tower.seed}: ${approach.id} to ${checkpoint.id}`
      );
      assert.ok(
        checkpoint.x <= CHECKPOINT_RESPAWN_CENTER_X - 10 &&
          checkpoint.x + checkpoint.width >= CHECKPOINT_RESPAWN_CENTER_X + 10,
        `${tower.seed}: ${checkpoint.id} cannot safely respawn`
      );
    }
  }
});

void test('current opening route gives the first biome meaningful ledge separation', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const lowerRoute = tower.platforms
    .filter(
      (platform) =>
        platform.zoneId === BOTTOM_ZONE_ID && isRoutePlatform(platform)
    )
    .sort((a, b) => b.y - a.y)
    .slice(0, 8);

  for (let index = 0; index < lowerRoute.length - 1; index += 1) {
    const from = lowerRoute[index]!;
    const to = lowerRoute[index + 1]!;
    assert.ok(
      horizontalGap(from, to) >= MOVEMENT_TUNING.generatedMinHorizontalStep,
      `${from.id} to ${to.id}`
    );
    assert.ok(from.y - to.y <= 124, `${from.id} to ${to.id}`);
  }
});

void test('checkpoint pacing stays compact without changing the known opening route', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y);
  const firstCheckpointIndex = route.findIndex(
    (platform) => platform.id === `${BOTTOM_ZONE_ID}-checkpoint`
  );
  const opening = route.slice(0, 8).map((platform) => ({
    id: platform.id,
    x: platform.x,
    width: platform.width,
    fromFloor: WORLD_HEIGHT - platform.y,
  }));

  assert.ok(firstCheckpointIndex >= 10 && firstCheckpointIndex <= 15);
  assert.deepEqual(opening, [
    { id: 'start', x: 180, width: 120, fromFloor: 60 },
    { id: 'ledge-orbital_scrapyard-1', x: 53, width: 116, fromFloor: 159 },
    { id: 'ledge-orbital_scrapyard-2', x: 152, width: 98, fromFloor: 275 },
    { id: 'ledge-orbital_scrapyard-3', x: 276.5, width: 95, fromFloor: 381 },
    { id: 'ledge-orbital_scrapyard-4', x: 180.5, width: 95, fromFloor: 487 },
    { id: 'ledge-orbital_scrapyard-5', x: 48, width: 110, fromFloor: 588 },
    { id: 'ledge-orbital_scrapyard-6', x: 135, width: 104, fromFloor: 686 },
    { id: 'ledge-orbital_scrapyard-7', x: 221.5, width: 101, fromFloor: 787 },
  ]);
});

void test('summit approach stays reachable without underside traps', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-summit-approach-${index}`);
    const route = tower.platforms
      .filter(isRoutePlatform)
      .sort((a, b) => b.y - a.y);
    const connectorIndex = route.findIndex(
      (platform) => platform.id === `ledge-${TOP_ZONE_ID}-summit-connector`
    );
    const previous = route[connectorIndex - 1];
    const connector = route[connectorIndex];
    const summit = route[connectorIndex + 1];

    assert.ok(previous, tower.seed);
    assert.ok(connector, tower.seed);
    assert.equal(summit?.id, 'summit', tower.seed);
    assert.equal(validateTower(tower), true, tower.seed);
    assert.ok(
      previous.y - connector.y >= 80 &&
        previous.y - connector.y <= MOVEMENT_TUNING.reachableVertical,
      `${tower.seed}: ${previous.id} is stacked under the connector`
    );
    assert.ok(
      connector.y - summit.y >= 80 &&
        connector.y - summit.y <= MOVEMENT_TUNING.reachableVertical,
      `${tower.seed}: connector is stacked under the summit`
    );
    assert.ok(
      horizontalGap(previous, connector) >= 50 &&
        horizontalGap(previous, connector) <=
          MOVEMENT_TUNING.reachableHorizontal,
      `${tower.seed}: ${previous.id} to connector`
    );
    assert.ok(
      horizontalGap(connector, summit) >= 100 &&
        horizontalGap(connector, summit) <=
          MOVEMENT_TUNING.reachableHorizontal,
      `${tower.seed}: connector to summit`
    );
  }
});

void test('summit pull keeps top-zone ledges within horizontal reach', () => {
  const tower = generateDailyTower('fallstack-2026-07-20-215');
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y);
  const hardest = route
    .slice(0, -1)
    .map((platform, index) => ({
      from: platform,
      to: route[index + 1]!,
      gap: horizontalGap(platform, route[index + 1]!),
    }))
    .sort((a, b) => b.gap - a.gap)[0];

  assert.ok(hardest);
  assert.equal(validateTower(tower), true);
  assert.ok(
    hardest.gap <= MOVEMENT_TUNING.reachableHorizontal,
    `${hardest.from.id} to ${hardest.to.id}`
  );
});

void test('tower validation catches unreachable zone stitches', () => {
  const tower = generateDailyTower('fallstack-2026-07-08');
  const secondZone = ZONE_IDS[1]!;
  const firstUpperPlatform = tower.platforms
    .filter((platform) => platform.zoneId === secondZone)
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y)[0];

  assert.ok(firstUpperPlatform);
  firstUpperPlatform.x = 400;
  assert.equal(validateTower(tower), false);
});

void test('generated towers include optional ricochet chimneys without changing the clear route', () => {
  const tower = generateDailyTower(KNOWN_GOOD_SEED);
  const ricochetWalls = tower.platforms.filter((platform) =>
    platform.id.startsWith('ricochet-')
  );

  assert.ok(ricochetWalls.length >= 2);
  assert.equal(ricochetWalls.length % 2, 0);
  assert.ok(ricochetWalls.every((platform) => platform.kind === 'obstacle'));
  for (const wall of ricochetWalls) {
    const parts = wall.id.split('-');
    const count = parts.at(-2);
    const landing = tower.platforms.find((platform) =>
      platform.id.endsWith(`-${count}`)
    );
    assert.ok(landing, `${wall.id} has no landing`);
    assert.ok(
      wall.y + wall.height <= landing.y - 40,
      `${wall.id} seals the baseline landing lane`
    );
  }
  assert.equal(validateTower(tower), true);
});

void test('optional obstacles never overlap a baseline route surface', () => {
  for (let index = 0; index < 240; index += 1) {
    const tower = generateDailyTower(`fallstack-obstacle-overlap-${index}`);
    const route = tower.platforms.filter(isRoutePlatform);
    for (const obstacle of tower.platforms.filter(
      (platform) => platform.kind === 'obstacle'
    )) {
      assert.equal(
        route.some((platform) => rectanglesOverlap(obstacle, platform)),
        false,
        `${tower.seed}: ${obstacle.id} overlaps the baseline route`
      );
    }
  }
});

void test('tower validation rejects a decorative post inside a route landing', () => {
  const tower = generateDailyTower('fallstack-route-overlap-validation');
  const landing = tower.platforms.find(isRoutePlatform);
  assert.ok(landing);
  tower.platforms.push({
    id: 'forged-route-obstacle',
    zoneId: landing.zoneId,
    x: landing.x + 10,
    y: landing.y,
    width: 16,
    height: 60,
    kind: 'obstacle',
  });
  assert.equal(validateTower(tower), false);
});

void test('decorative obstacle posts stay on the outer side of their landing', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-obstacle-side-${index}`);
    const route = tower.platforms
      .filter(isRoutePlatform)
      .sort((a, b) => b.y - a.y);
    const routeById = new Map(route.map((platform) => [platform.id, platform]));

    for (const obstacle of tower.platforms.filter((platform) =>
      platform.id.startsWith('obstacle-')
    )) {
      const count = obstacle.id.split('-').at(-1);
      const landing = route.find((platform) => platform.id.endsWith(`-${count}`));
      assert.ok(landing, `${tower.seed}: missing landing for ${obstacle.id}`);
      const landingIndex = routeById.get(landing.id)
        ? route.findIndex((platform) => platform.id === landing.id)
        : -1;
      const approach = route[landingIndex - 1];
      assert.ok(approach, `${tower.seed}: missing approach for ${obstacle.id}`);
      const movesRight = centerXForTest(landing) > centerXForTest(approach);
      if (movesRight) {
        assert.ok(
          obstacle.x >= landing.x + landing.width,
          `${tower.seed}: ${obstacle.id} blocks the rightward approach`
        );
      } else {
        assert.ok(
          obstacle.x + obstacle.width <= landing.x,
          `${tower.seed}: ${obstacle.id} blocks the leftward approach`
        );
      }
    }
  }
});

function rectanglesOverlap(left: Platform, right: Platform): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

void test('different daily seeds can vary the known-good tower subtly', () => {
  const first = generateDailyTower('fallstack-2026-07-08');
  const second = generateDailyTower('fallstack-2026-07-09');
  assert.notDeepEqual(first.platforms, second.platforms);
  assert.equal(validateTower(second), true);
});

void test('known-good seed reproduces the reference route', () => {
  const knownGood = generateDailyTower(KNOWN_GOOD_SEED);
  assert.deepEqual(knownGood.platforms, PLATFORMS);
  assert.equal(knownGood.chunks.length, ZONES.length);
  assert.equal(
    CHUNK_LIBRARY.every((chunk) => chunk.ledges.length > 0),
    true
  );
  assert.equal(new Set(CHUNK_LIBRARY.map((chunk) => chunk.archetype)).size, 6);
});

void test('zone progression is finite and ordered', () => {
  for (let index = 0; index < ZONE_IDS.length - 1; index += 1) {
    assert.equal(nextZoneId(ZONE_IDS[index]!), ZONE_IDS[index + 1]);
  }
  assert.equal(nextZoneId(TOP_ZONE_ID), null);
  assert.equal(zoneForY(WORLD_HEIGHT - 1000).id, BOTTOM_ZONE_ID);
  assert.equal(zoneForY(1000).id, TOP_ZONE_ID);
  assert.equal(ZONES.length, ZONE_IDS.length);
});

function horizontalGap(
  from: { x: number; width: number },
  to: { x: number; width: number }
): number {
  return Math.abs(from.x + from.width / 2 - (to.x + to.width / 2));
}

function centerXForTest(platform: { x: number; width: number }): number {
  return platform.x + platform.width / 2;
}
