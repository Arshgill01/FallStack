import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIO_LEVELS,
  MUSIC_START_DELAY_MS,
  shouldResumeAudioContext,
  shouldScheduleMusicStart,
} from './sound.js';

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

void test('mobile audio resumes every recoverable non-running context state', () => {
  assert.equal(shouldResumeAudioContext('running'), false);
  assert.equal(shouldResumeAudioContext('closed'), false);
  assert.equal(shouldResumeAudioContext('suspended'), true);
  assert.equal(shouldResumeAudioContext('interrupted'), true);
});

void test('music starts promptly at a perceptible output level', () => {
  assert.ok(MUSIC_START_DELAY_MS <= 100);
  assert.ok(
    AUDIO_LEVELS.musicStart *
      AUDIO_LEVELS.musicBellPrimary *
      AUDIO_LEVELS.master >=
      0.025
  );
  assert.ok(
    AUDIO_LEVELS.launchPrimary *
      AUDIO_LEVELS.gameplay *
      AUDIO_LEVELS.master >=
      0.07
  );
});
