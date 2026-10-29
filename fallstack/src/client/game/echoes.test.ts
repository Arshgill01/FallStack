import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
} from '../../shared/game/mutation.js';
import { generateDailyTower, zoneById } from '../../shared/game/tower.js';
import type { BoardEcho } from '../../shared/realtime.js';
import {
  echoIsMajor,
  echoPlacement,
  echoStamp,
  offscreenDirection,
  offscreenMarkerCopy,
  OwnEchoKeys,
  thanksEchoes,
} from './echoes.js';

const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
const snapshot = deriveSnapshot({
  ...seed,
  counters: createSeededCounters(),
  totalFalls: 37,
  totalClears: 0,
  totalSummits: 0,
  achievements: createInitialAchievements(),
});
const platforms = generateDailyTower(seed.dailySeed).platforms;
const site = snapshot.sites[0]!;

function echo(partial: Partial<BoardEcho>): BoardEcho {
  return {
    kind: 'fall',
    key: '0badc0de',
    zoneId: site.zoneId,
    siteId: site.id,
    bucket: 'short_jump',
    count: 2,
    visibleChange: 'mark_added',
    climber: null,
    ...partial,
  };
}

void test('a fall echo starts on the ledge that was missed and lands in its slot', () => {
  const placement = echoPlacement(echo({}), snapshot.sites, platforms);
  const landing = platforms.find((platform) => platform.id === site.anchorPlatformId)!;
  assert.deepEqual(placement?.slot, site.helperSlot);
  assert.deepEqual(placement?.origin, {
    x: landing.x + landing.width / 2,
    y: landing.y,
  });
  assert.equal(placement?.zoneName, 'Lower Ruins');
});

void test('each bucket echoes at the slot its artifact grows in', () => {
  for (const [bucket, slot] of [
    ['wall_bonk', site.ghostSlot],
    ['overjump', site.hazardSlot],
    ['helper_overuse', site.hazardSlot],
    ['successful_clear', site.lanternSlot],
  ] as const) {
    assert.deepEqual(
      echoPlacement(echo({ bucket }), snapshot.sites, platforms)?.slot,
      slot
    );
  }
});

void test('summits echo at the crown; unknown sites echo nowhere', () => {
  const summit = echoPlacement(
    echo({ kind: 'summit', siteId: null, bucket: null, zoneId: 'event_horizon_crown' }),
    snapshot.sites,
    platforms
  );
  assert.equal(summit?.slot.y, zoneById('event_horizon_crown').yTop + 40);
  assert.equal(
    echoPlacement(echo({ siteId: 'impact-v1:nowhere:x' }), snapshot.sites, platforms),
    null
  );
});

void test('stamps stay anonymous for falls and name positive climbers', () => {
  assert.equal(echoStamp(echo({})), '+1 short jump');
  assert.equal(echoStamp(echo({ visibleChange: 'artifact_spawned' })), 'A fall grew this');
  assert.equal(
    echoStamp(echo({ kind: 'clear', climber: 'u/alice', visibleChange: 'site_reinforced' })),
    'u/alice reinforced this'
  );
  assert.equal(echoStamp(echo({ kind: 'clear' })), 'A climber cleared through');
  assert.equal(echoIsMajor(echo({})), false);
  assert.equal(echoIsMajor(echo({ visibleChange: 'site_cursed' })), true);
});

void test('off-screen events group into one marker per edge', () => {
  assert.equal(offscreenDirection(100, { top: 500, bottom: 900 }), 'above');
  assert.equal(offscreenDirection(1000, { top: 500, bottom: 900 }), 'below');
  assert.equal(offscreenDirection(700, { top: 500, bottom: 900 }), null);
  assert.equal(
    offscreenMarkerCopy('above', [{ kind: 'fall', zoneName: 'Bell Mouth' }]),
    '↑ someone fell · Bell Mouth'
  );
  assert.equal(
    offscreenMarkerCopy('below', [
      { kind: 'fall', zoneName: 'Lower Ruins' },
      { kind: 'fall', zoneName: 'Washi Arch' },
      { kind: 'clear', zoneName: 'Washi Arch' },
    ]),
    '↓ 2 falls · 1 clear below'
  );
});

void test('own echo keys are remembered and bounded', () => {
  const keys = new OwnEchoKeys();
  keys.add('00000001');
  assert.equal(keys.has('00000001'), true);
  for (let index = 0; index < 70; index += 1) keys.add(index.toString(16).padStart(8, '0'));
  assert.equal(keys.has('00000001'), false);
});

void test('thanks light the artifacts a clear credited, with their new totals', () => {
  const [thanks] = thanksEchoes(
    [
      {
        artifactId: `${site.id}-short_jump`,
        siteName: site.name,
        artifactType: 'corpse_stack',
        savesAfter: 1,
      },
      {
        artifactId: 'impact-v1:nowhere-short_jump',
        siteName: 'Nowhere',
        artifactType: 'corpse_stack',
        savesAfter: 9,
      },
    ],
    snapshot.sites
  );
  assert.equal(thanks?.stamp, 'Caught 1 climber');
  assert.deepEqual(
    echoPlacement(thanks!.echo, snapshot.sites, platforms)?.slot,
    site.helperSlot
  );
  assert.equal(thanksEchoes([], snapshot.sites).length, 0);
});
