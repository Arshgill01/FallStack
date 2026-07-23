import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldScheduleMusicStart } from './sound.js';

void test('an initialized output bus does not prevent the music source from starting', () => {
  assert.equal(
    shouldScheduleMusicStart({
      musicMuted: false,
      musicNodeCount: 0,
      startPending: false,
    }),
    true
  );
});

void test('music start stays idempotent while pending, active, or muted', () => {
  assert.equal(
    shouldScheduleMusicStart({
      musicMuted: false,
      musicNodeCount: 0,
      startPending: true,
    }),
    false
  );
  assert.equal(
    shouldScheduleMusicStart({
      musicMuted: false,
      musicNodeCount: 1,
      startPending: false,
    }),
    false
  );
  assert.equal(
    shouldScheduleMusicStart({
      musicMuted: true,
      musicNodeCount: 0,
      startPending: false,
    }),
    false
  );
});
