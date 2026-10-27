import assert from 'node:assert/strict';
import test from 'node:test';
import {
  artifactUseWindowMs,
  canCollideWithArtifact,
} from './artifact-mechanics.js';

void test('ghost platforms are one-way from above', () => {
  assert.equal(
    canCollideWithArtifact({
      type: 'ghost_platform',
      playerVelocityY: 120,
      playerBottom: 102,
      artifactTop: 100,
    }),
    true
  );
  assert.equal(
    canCollideWithArtifact({
      type: 'ghost_platform',
      playerVelocityY: -120,
      playerBottom: 112,
      artifactTop: 100,
    }),
    false
  );
});

void test('solid helpers and cursed bricks collide from every direction', () => {
  for (const type of ['corpse_stack', 'mercy_nail', 'cursed_brick'] as const) {
    assert.equal(
      canCollideWithArtifact({
        type,
        playerVelocityY: -200,
        playerBottom: 140,
        artifactTop: 100,
      }),
      true
    );
  }
});

void test('temporary artifact timing is deterministic and distinct', () => {
  assert.equal(artifactUseWindowMs('ghost_platform'), 900);
  assert.equal(artifactUseWindowMs('cursed_brick'), 650);
  assert.equal(artifactUseWindowMs('corpse_stack'), null);
  assert.equal(artifactUseWindowMs('mercy_nail'), null);
  assert.equal(artifactUseWindowMs('lantern_trail'), null);
});

void test('ghosts hold longer when remembered and flicker out when overgrown', () => {
  assert.ok(
    artifactUseWindowMs('ghost_platform', 'remembered')! >
      artifactUseWindowMs('ghost_platform', 'base')!
  );
  assert.ok(
    artifactUseWindowMs('ghost_platform', 'saturated')! <
      artifactUseWindowMs('ghost_platform', 'base')!
  );
});

void test('cursed bricks crumble faster at every tier', () => {
  const base = artifactUseWindowMs('cursed_brick', 'base')!;
  const remembered = artifactUseWindowMs('cursed_brick', 'remembered')!;
  const saturated = artifactUseWindowMs('cursed_brick', 'saturated')!;
  assert.ok(base > remembered && remembered > saturated);
  assert.equal(artifactUseWindowMs('mercy_nail', 'saturated'), null);
});
