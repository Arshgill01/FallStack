/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACT_COLLISION_CLASS,
  artifactVisualTier,
  clampedArtifactLabelCenter,
  inWorldArtifactLabel,
  RELIQUARY_ZONE_PALETTES,
  RELIQUARY_ZONE_TREATMENTS,
  motionDecision,
  PLAYER_CEREMONY_DURATION_MS,
  playerVisualDimensions,
  playerVisualRotation,
  playerVisualState,
  reliquaryZoneFor,
  reliquaryZoneName,
  shouldAnimateArtifact,
  shouldShowArtifactLabels,
} from './art-direction.js';

void test('every artifact has a distinct collision presentation contract', () => {
  assert.deepEqual(ARTIFACT_COLLISION_CLASS, {
    corpse_stack: 'solid',
    mercy_nail: 'narrow-solid',
    ghost_platform: 'semi-solid',
    cursed_brick: 'hazardous',
    lantern_trail: 'visual-only',
  });
});

void test('artifact counts map to stable visible intensity tiers', () => {
  assert.equal(artifactVisualTier(1), 'base');
  assert.equal(artifactVisualTier(6), 'remembered');
  assert.equal(artifactVisualTier(12), 'saturated');
});

void test('artifact labels stay inside narrow and wide tower bounds', () => {
  assert.equal(clampedArtifactLabelCenter(-20, 375), 80);
  assert.equal(clampedArtifactLabelCenter(500, 375), 295);
  assert.equal(clampedArtifactLabelCenter(240, 480), 240);
});

void test('in-world artifact labels keep causes concise', () => {
  assert.equal(
    inWorldArtifactLabel({ bucket: 'short_jump', count: 5 }),
    '5 short jumps raised this foothold.'
  );
  assert.equal(
    inWorldArtifactLabel({ bucket: 'wall_bonk', count: 1 }),
    '1 wall bonk left this ghost.'
  );
  assert.ok(
    inWorldArtifactLabel({ bucket: 'helper_overuse', count: 12 }).length <= 38
  );
});

void test('artifact explanations clear the active jump corridor', () => {
  assert.equal(
    shouldShowArtifactLabels({
      charging: false,
      dismissed: false,
      grounded: true,
      velocityY: 0,
    }),
    true
  );
  assert.equal(
    shouldShowArtifactLabels({
      charging: true,
      dismissed: false,
      grounded: true,
      velocityY: 0,
    }),
    false
  );
  assert.equal(
    shouldShowArtifactLabels({
      charging: false,
      dismissed: false,
      grounded: false,
      velocityY: -420,
    }),
    false
  );
  assert.equal(
    shouldShowArtifactLabels({
      charging: false,
      dismissed: true,
      grounded: true,
      velocityY: 0,
    }),
    false
  );
});

void test('twelve persistence segments resolve to three visual zones', () => {
  assert.equal(reliquaryZoneFor('orbital_scrapyard'), 'lower_ruins');
  assert.equal(reliquaryZoneName('ring_citadel'), 'Bell Shaft');
  assert.equal(reliquaryZoneName('event_horizon_crown'), 'Moon Roof');
});

void test('each visual zone has a distinct architectural and material contract', () => {
  const treatments = Object.values(RELIQUARY_ZONE_TREATMENTS);
  assert.equal(new Set(treatments.map((item) => item.density)).size, 3);
  assert.equal(new Set(treatments.map((item) => item.platformMaterial)).size, 3);
  assert.equal(new Set(treatments.map((item) => item.lightEmphasis)).size, 3);
});

void test('each visual zone has a distinct backdrop and route-surface palette', () => {
  const palettes = Object.values(RELIQUARY_ZONE_PALETTES);
  for (const key of ['outer', 'cavity', 'wall', 'platform', 'edge'] as const) {
    assert.equal(new Set(palettes.map((palette) => palette[key])).size, 3);
  }
  for (const palette of palettes) {
    assert.notEqual(palette.cavity, palette.platform);
    assert.notEqual(palette.platform, palette.edge);
  }
});

void test('reduced motion removes ambience without hiding state', () => {
  assert.deepEqual(motionDecision(true), {
    parallax: false,
    particles: false,
    idleOscillation: false,
    stateTweenMs: 0,
  });
  assert.equal(shouldAnimateArtifact('cursed_brick', true), false);
  assert.equal(shouldAnimateArtifact('lantern_trail', false), true);
});

void test('player pose is derived from existing simulation state', () => {
  assert.equal(
    playerVisualState({ charging: true, grounded: true, velocityY: 0 }),
    'charge'
  );
  assert.equal(
    playerVisualState({ charging: false, grounded: false, velocityY: -400 }),
    'rising'
  );
  assert.equal(
    playerVisualState({ charging: false, grounded: false, velocityY: 20 }),
    'apex'
  );
  assert.equal(
    playerVisualState({ charging: false, grounded: false, velocityY: 420 }),
    'fall'
  );
  assert.equal(
    playerVisualState({
      charging: false,
      grounded: true,
      velocityY: 0,
      ceremony: 'respawn',
    }),
    'respawn'
  );
  assert.deepEqual(playerVisualDimensions('grounded'), {
    width: 26,
    height: 39,
  });
  assert.ok(playerVisualDimensions('rising').height > 40);
  assert.ok(playerVisualDimensions('fall').width > 30);
});

void test('player ceremonies are brief and reduced motion removes tilt', () => {
  assert.deepEqual(PLAYER_CEREMONY_DURATION_MS, {
    land: 110,
    respawn: 180,
    checkpoint: 360,
    summit: 900,
  });
  assert.ok(playerVisualRotation('fall', 1, false) > 0);
  assert.equal(playerVisualRotation('fall', 1, true), 0);
});
