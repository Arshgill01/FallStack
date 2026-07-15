import assert from 'node:assert/strict';
import test from 'node:test';
import { BOTTOM_ZONE_ID, ZONE_IDS } from '../../shared/game/mutation.js';
import {
  deviceResumeKey,
  readDeviceResume,
  writeDeviceResume,
} from './resume.js';

void test('practice resume is daily, validated, and monotonic', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const monday = { dateKey: '2026-07-13' };
  const tuesday = { dateKey: '2026-07-14' };

  assert.equal(readDeviceResume(storage, monday), BOTTOM_ZONE_ID);
  assert.equal(writeDeviceResume(storage, monday, ZONE_IDS[3]), ZONE_IDS[3]);
  assert.equal(writeDeviceResume(storage, monday, ZONE_IDS[1]), ZONE_IDS[3]);
  assert.equal(readDeviceResume(storage, monday), ZONE_IDS[3]);
  assert.equal(readDeviceResume(storage, tuesday), BOTTOM_ZONE_ID);

  values.set(deviceResumeKey(tuesday), 'not-a-zone');
  assert.equal(readDeviceResume(storage, tuesday), BOTTOM_ZONE_ID);
});
