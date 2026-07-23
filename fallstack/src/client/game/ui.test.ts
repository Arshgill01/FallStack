import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  Artifact,
  ArtifactType,
  ZoneSnapshot,
} from '../../shared/game/mutation.js';
import { zoneEffectPresentation } from './ui.js';

function zoneWithArtifact(type: ArtifactType | null): ZoneSnapshot {
  const artifact: Artifact | null = type
    ? {
        id: `test-${type}`,
        type,
        zoneId: 'orbital_scrapyard',
        siteId: 'site',
        siteName: 'First Gap',
        anchorPlatformId: 'start',
        bucket:
          type === 'ghost_platform'
            ? 'wall_bonk'
            : type === 'cursed_brick'
              ? 'overjump'
              : 'short_jump',
        x: 100,
        y: 100,
        width: 40,
        height: 12,
        solid: type !== 'lantern_trail',
        label: 'test',
        count: 3,
        seededCount: 0,
        organicCount: 3,
      }
    : null;
  return {
    id: 'orbital_scrapyard',
    name: 'Lower Ruins',
    status: 'Quiet',
    statusLabel: 'Low activity',
    counters: {
      short_jump: 0,
      overjump: 0,
      wall_bonk: 0,
      helper_overuse: 0,
      successfulClears: 0,
    },
    artifacts: artifact ? [artifact] : [],
  };
}

void test('zone effect labels name the active mechanic, not an opaque mood', () => {
  assert.equal(
    zoneEffectPresentation(zoneWithArtifact('corpse_stack')).label,
    'Helper active'
  );
  assert.equal(
    zoneEffectPresentation(zoneWithArtifact('ghost_platform')).label,
    'Ghost active'
  );
  assert.equal(
    zoneEffectPresentation(zoneWithArtifact('cursed_brick')).label,
    'Hazard active'
  );
  assert.equal(
    zoneEffectPresentation(zoneWithArtifact(null)).label,
    'No active mark'
  );
});

void test('hazards take priority when a zone exposes mixed artifacts', () => {
  const zone = zoneWithArtifact('corpse_stack');
  const hazard = zoneWithArtifact('cursed_brick').artifacts[0]!;
  zone.artifacts.push(hazard);

  const effect = zoneEffectPresentation(zone);
  assert.equal(effect.label, 'Hazard active');
  assert.match(effect.description, /crumbles/i);
});
