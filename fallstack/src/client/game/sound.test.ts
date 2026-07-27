import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIO_LEVELS,
  landingProfile,
  MUSIC_START_DELAY_MS,
  resolveGameplayMuted,
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

void test('the explicit SFX preference supersedes and migrates legacy mute state', () => {
  assert.equal(resolveGameplayMuted('false', 'true'), false);
  assert.equal(resolveGameplayMuted('true', 'false'), true);
  assert.equal(resolveGameplayMuted(null, 'true'), true);
  assert.equal(resolveGameplayMuted(null, null), false);
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
    (AUDIO_LEVELS.launchSnap + AUDIO_LEVELS.launchBody) *
      AUDIO_LEVELS.gameplay *
      AUDIO_LEVELS.master >=
      0.1
  );
});

void test('landing profiles respond to material and bounded impact weight', () => {
  const softStone = landingProfile({
    material: 'stone',
    surface: 'route',
    impactSpeed: 120,
  });
  const hardStone = landingProfile({
    material: 'stone',
    surface: 'route',
    impactSpeed: 1_400,
  });
  const metal = landingProfile({
    material: 'metal',
    surface: 'route',
    impactSpeed: 600,
  });
  const ghost = landingProfile({
    material: 'ghost',
    surface: 'artifact',
    impactSpeed: 600,
  });

  assert.ok(hardStone.weight > softStone.weight);
  assert.ok(hardStone.noiseVolume > softStone.noiseVolume);
  assert.ok(hardStone.resonanceVolume > softStone.resonanceVolume);
  assert.notEqual(metal.resonanceFrequency, softStone.resonanceFrequency);
  assert.notEqual(ghost.noiseFilterFrequency, metal.noiseFilterFrequency);
  assert.ok(hardStone.weight <= 1);
});
