/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from './events.js';

const now = Date.parse('2026-07-10T12:00:00Z');
const base = {
  dailySeed: 'fallstack-2026-07-10',
  attemptId: 'attempt_abc12345',
  timestamp: now,
};

void test('fall event validation accepts bounded structured payloads', () => {
  const result = validateRecordFallRequest(
    {
      ...base,
      zoneId: 'lower_ruins',
      failureBucket: 'short_jump',
      chargePercent: 74,
      highestY: 5420,
    },
    now
  );

  assert.equal(result.ok, true);
});

void test('fall event validation rejects forged numeric fields', () => {
  const result = validateRecordFallRequest(
    {
      ...base,
      zoneId: 'lower_ruins',
      failureBucket: 'short_jump',
      chargePercent: 740,
      highestY: -100,
    },
    now
  );

  assert.equal(result.ok, false);
});

void test('clear event validation only accepts playable checkpoint transitions', () => {
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: 'lower_ruins', highestY: 3998 },
      now
    ).ok,
    true
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: 'moon_roof', highestY: 0 },
      now
    ).ok,
    false
  );
  assert.equal(
    validateRecordClearRequest(
      { ...base, zoneId: 'bell_shaft', highestY: 2500 },
      now
    ).ok,
    false
  );
});

void test('summit event validation requires a fresh seed and attempt identity', () => {
  assert.equal(validateRecordSummitRequest(base, now).ok, true);
  assert.equal(
    validateRecordSummitRequest(
      { ...base, dailySeed: '', attemptId: 'bad space' },
      now
    ).ok,
    false
  );
});
