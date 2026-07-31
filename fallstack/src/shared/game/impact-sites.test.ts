/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveImpactSites } from './impact-sites.js';
import { ZONE_IDS } from './mutation.js';
import {
  WORLD_WIDTH,
  generateDailyTower,
  isRoutePlatform,
  validateTower,
  zoneById,
} from './tower.js';

void test('daily tower exposes stable impact sites on route jumps', () => {
  const tower = generateDailyTower('fallstack-2026-07-13');
  const sites = deriveImpactSites(tower);
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((left, right) => right.y - left.y);

  assert.ok(sites.length > 0);
  assert.deepEqual(sites, deriveImpactSites(tower));
  assert.equal(sites[0]?.approachPlatformId, 'start');
  assert.equal(sites[0]?.anchorPlatformId, route[1]?.id);
});

void test('each zone gets three impact sites anchored to real route pairs', () => {
  const tower = generateDailyTower('fallstack-2026-07-13');
  const sites = deriveImpactSites(tower);
  const platformsById = new Map(
    tower.platforms.map((platform) => [platform.id, platform])
  );

  assert.equal(sites.length, ZONE_IDS.length * 3);
  for (const zoneId of ZONE_IDS) {
    assert.equal(
      sites.filter((site) => site.zoneId === zoneId).length,
      3,
      zoneId
    );
  }

  for (const site of sites) {
    const approach = platformsById.get(site.approachPlatformId);
    const anchor = platformsById.get(site.anchorPlatformId);

    assert.ok(approach, site.id);
    assert.ok(anchor, site.id);
    assert.equal(approach.zoneId, site.zoneId, site.id);
    assert.equal(anchor.zoneId, site.zoneId, site.id);
    assert.equal(isRoutePlatform(approach), true, site.id);
    assert.equal(isRoutePlatform(anchor), true, site.id);
    assert.deepEqual(site.baselinePathIds, [approach.id, anchor.id], site.id);
  }
});

void test('impact slots stay inside their owning zone across daily seeds', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-impact-sites-${index}`);

    for (const site of deriveImpactSites(tower)) {
      const zone = zoneById(site.zoneId);
      for (const slot of [site.helperSlot, site.hazardSlot, site.ghostSlot]) {
        assert.ok(slot.x >= 0, `${tower.seed}: ${site.id}`);
        assert.ok(
          slot.x + slot.width <= WORLD_WIDTH,
          `${tower.seed}: ${site.id}`
        );
        assert.ok(slot.y >= zone.yTop, `${tower.seed}: ${site.id}`);
        assert.ok(
          slot.y + slot.height <= zone.yBottom,
          `${tower.seed}: ${site.id}`
        );
      }
    }
  }
});

void test('impact slots never cover the baseline route', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-impact-overlap-${index}`);
    const route = tower.platforms.filter(isRoutePlatform);

    for (const site of deriveImpactSites(tower)) {
      for (const slot of [site.helperSlot, site.hazardSlot, site.ghostSlot]) {
        for (const platform of route) {
          assert.equal(
            overlaps(slot, platform),
            false,
            `${tower.seed}: ${site.id} covers ${platform.id}`
          );
        }
      }
    }
  }
});

void test('solid helper slots stay outside the baseline jump corridor', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-helper-clearance-${index}`);
    const platformsById = new Map(
      tower.platforms.map((platform) => [platform.id, platform])
    );

    for (const site of deriveImpactSites(tower)) {
      const approach = platformsById.get(site.approachPlatformId);
      const landing = platformsById.get(site.anchorPlatformId);
      assert.ok(approach, `${tower.seed}: ${site.id}`);
      assert.ok(landing, `${tower.seed}: ${site.id}`);
      assert.equal(
        horizontalOverlap(site.helperSlot, landing),
        0,
        `${tower.seed}: ${site.id} creates a landing head-bonk pocket`
      );
      assert.equal(
        horizontalOverlap(site.helperSlot, approach),
        0,
        `${tower.seed}: ${site.id} creates a launch ceiling`
      );
    }
  }
});

void test('baseline route stays valid with no helpers and every hazard active', () => {
  for (let index = 0; index < 120; index += 1) {
    const tower = generateDailyTower(`fallstack-impact-fairness-${index}`);
    const hazards = deriveImpactSites(tower).map((site) => ({
      id: `${site.id}:hazard-proof`,
      zoneId: site.zoneId,
      ...site.hazardSlot,
      kind: 'obstacle' as const,
    }));

    assert.equal(validateTower(tower), true, `${tower.seed}: no helpers`);
    assert.equal(
      validateTower({
        ...tower,
        platforms: [...tower.platforms, ...hazards],
      }),
      true,
      `${tower.seed}: every hazard active`
    );
  }
});

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function horizontalOverlap(
  left: { x: number; width: number },
  right: { x: number; width: number }
): number {
  return Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) -
      Math.max(left.x, right.x)
  );
}
