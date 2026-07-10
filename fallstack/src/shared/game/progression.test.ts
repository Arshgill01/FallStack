/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { fallZoneForRespawn, shouldEndRunAtY } from './progression.js';

void test('fall recovery is anchored to the latest checkpoint zone', () => {
  assert.equal(shouldEndRunAtY(6039, 'lower_ruins'), false);
  assert.equal(shouldEndRunAtY(6040, 'lower_ruins'), true);
  assert.equal(shouldEndRunAtY(4039, 'bell_shaft'), false);
  assert.equal(shouldEndRunAtY(4040, 'bell_shaft'), true);
  assert.equal(shouldEndRunAtY(2040, 'moon_roof'), true);
});

void test('fall mutation is recorded against the active checkpoint zone', () => {
  assert.equal(fallZoneForRespawn('lower_ruins'), 'lower_ruins');
  assert.equal(fallZoneForRespawn('bell_shaft'), 'bell_shaft');
  assert.equal(fallZoneForRespawn('moon_roof'), 'moon_roof');
});
