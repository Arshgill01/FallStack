/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTTOM_ZONE_ID, TOP_ZONE_ID, ZONE_IDS, type ZoneId } from './mutation.js';
import { fallZoneForRespawn, shouldEndRunAtY } from './progression.js';
import { zoneById } from './tower.js';

const MID_ZONE_ID = ZONE_IDS[Math.floor(ZONE_IDS.length / 2)] as ZoneId;

void test('fall recovery is anchored to the latest checkpoint zone', () => {
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const mid = zoneById(MID_ZONE_ID);
  const top = zoneById(TOP_ZONE_ID);
  assert.equal(shouldEndRunAtY(bottom.recoveryY - 1, BOTTOM_ZONE_ID), false);
  assert.equal(shouldEndRunAtY(bottom.recoveryY, BOTTOM_ZONE_ID), true);
  assert.equal(shouldEndRunAtY(mid.recoveryY - 1, MID_ZONE_ID), false);
  assert.equal(shouldEndRunAtY(mid.recoveryY, MID_ZONE_ID), true);
  assert.equal(shouldEndRunAtY(top.recoveryY, TOP_ZONE_ID), true);
});

void test('fall mutation is recorded against the active checkpoint zone', () => {
  assert.equal(fallZoneForRespawn(BOTTOM_ZONE_ID), BOTTOM_ZONE_ID);
  assert.equal(fallZoneForRespawn(MID_ZONE_ID), MID_ZONE_ID);
  assert.equal(fallZoneForRespawn(TOP_ZONE_ID), TOP_ZONE_ID);
});
