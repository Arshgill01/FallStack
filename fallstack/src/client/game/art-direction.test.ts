/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACT_COLLISION_CLASS,
  artifactVisualTier,
  clampedArtifactLabelCenter,
  RELIQUARY_ZONE_PALETTES,
  RELIQUARY_ZONE_TREATMENTS,
  motionDecision,
  playerVisualDimensions,
  playerVisualState,
  reliquaryZoneFor,
  reliquaryZoneName,
  shouldAnimateArtifact,
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
    'airborne'
  );
  assert.equal(
    playerVisualState({ charging: false, grounded: false, velocityY: 420 }),
    'fall'
  );
  assert.deepEqual(playerVisualDimensions('grounded'), {
    width: 30,
    height: 42,
  });
  assert.ok(playerVisualDimensions('airborne').height > 40);
  assert.ok(playerVisualDimensions('fall').width > 30);
});
