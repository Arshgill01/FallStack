/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARTIFACT_COLLISION_CLASS,
  motionDecision,
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

void test('twelve persistence segments resolve to three visual zones', () => {
  assert.equal(reliquaryZoneFor('orbital_scrapyard'), 'lower_ruins');
  assert.equal(reliquaryZoneName('ring_citadel'), 'Bell Shaft');
  assert.equal(reliquaryZoneName('event_horizon_crown'), 'Moon Roof');
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
});
