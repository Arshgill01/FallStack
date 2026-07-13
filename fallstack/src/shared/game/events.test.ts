/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_IDS,
  type ZoneId,
} from './mutation.js';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from './events.js';
import { nextZoneId, WORLD_HEIGHT, zoneById } from './tower.js';

const now = Date.parse('2026-07-10T12:00:00Z');
const base = {
  eventId: 'event_abc12345',
  boardId: 'community:t5_fallstack:2026-07-10:v1',
  boardRevision: 37,
  attemptId: 'attempt_abc12345',
  timestamp: now,
};
const MID_ZONE_ID = ZONE_IDS[Math.floor(ZONE_IDS.length / 2)] as ZoneId;

void test('fall event validation accepts bounded structured payloads', () => {
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const mid = zoneById(MID_ZONE_ID);
  assert.equal(
    validateRecordFallRequest(
      {
        ...base,
        respawnZoneId: BOTTOM_ZONE_ID,
        fallX: 240,
        fallY: bottom.yBottom + 40,
        highestY: bottom.yBottom - 580,
        lastPlatformId: 'start',
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 74,
        launchDirection: -1,
      },
      now
    ).ok,
    true
  );
  assert.equal(
    validateRecordFallRequest(
      {
        ...base,
        respawnZoneId: MID_ZONE_ID,
        fallX: 240,
        fallY: mid.yBottom + 40,
        highestY: mid.yTop + 164,
        lastPlatformId: null,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 58,
        launchDirection: 1,
      },
      now
    ).ok,
    true
  );
});

void test('fall event validation rejects forged cross-zone progress', () => {
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const mid = zoneById(MID_ZONE_ID);
  const top = zoneById(TOP_ZONE_ID);
  assert.equal(
    validateRecordFallRequest(
      {
        ...base,
        respawnZoneId: BOTTOM_ZONE_ID,
        fallX: 240,
        fallY: bottom.yBottom + 40,
        highestY: bottom.yTop - 1,
        lastPlatformId: 'start',
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 74,
        launchDirection: -1,
      },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordFallRequest(
      {
        ...base,
        respawnZoneId: MID_ZONE_ID,
        fallX: 240,
        fallY: mid.yBottom + 40,
        highestY: mid.yTop - 1,
        lastPlatformId: null,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 74,
        launchDirection: -1,
      },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordFallRequest(
      {
        ...base,
        respawnZoneId: TOP_ZONE_ID,
        fallX: 240,
        fallY: top.yBottom + 40,
        highestY: top.yBottom + 1,
        lastPlatformId: null,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 74,
        launchDirection: -1,
      },
      now
    ).ok,
    false
  );
});

void test('fall event validation rejects forged numeric fields', () => {
  const result = validateRecordFallRequest(
      {
        ...base,
      respawnZoneId: BOTTOM_ZONE_ID,
      fallX: 240,
      fallY: WORLD_HEIGHT + 40,
      highestY: -100,
      lastPlatformId: 'start',
      lastHelperArtifactId: null,
      wallBonkPlatformId: null,
      launchChargePercent: 740,
      launchDirection: -1,
    },
    now
  );

  assert.equal(result.ok, false);
});

void test('clear event validation only accepts playable checkpoint transitions', () => {
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const mid = zoneById(MID_ZONE_ID);
  const top = zoneById(TOP_ZONE_ID);
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: BOTTOM_ZONE_ID, highestY: bottom.yTop - 2 },
      now
    ).ok,
    true
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: BOTTOM_ZONE_ID, highestY: bottom.yTop - 165 },
      now
    ).ok,
    true
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: TOP_ZONE_ID, highestY: top.yTop },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: MID_ZONE_ID, highestY: mid.yTop + 500 },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: BOTTOM_ZONE_ID, highestY: bottom.yTop - 166 },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: BOTTOM_ZONE_ID, highestY: 0 },
      now
    ).ok,
    false
  );
});

void test('test fixtures still cover a clearable middle zone', () => {
  assert.ok(nextZoneId(MID_ZONE_ID));
});

void test('summit event validation requires fresh bounded summit progress', () => {
  assert.equal(
    validateRecordSummitRequest({ ...base, highestY: 260 }, now).ok,
    true
  );
  assert.equal(
    validateRecordSummitRequest(
      { ...base, boardId: '', attemptId: 'bad space', highestY: 260 },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordSummitRequest({ ...base, highestY: 301 }, now).ok,
    false
  );
  assert.equal(validateRecordSummitRequest(base, now).ok, false);
});
