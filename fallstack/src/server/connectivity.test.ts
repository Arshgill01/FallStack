import assert from 'node:assert/strict';
import test from 'node:test';
import type { RecordFallResponse } from '../shared/api.js';
import type { BoardSnapshot } from '../shared/game/board.js';
import type { ZoneId } from '../shared/game/mutation.js';
import { createCommunity } from './testing/community.js';
import {
  KNOWN_CONNECTIVITY_GAPS,
  renderedArtifactAt,
  type EdgeId,
} from './testing/connectivity-contract.js';
import {
  ConnectivityRun,
  runCommunitySimulation,
} from './testing/simulation.js';

// A zone with no opening scars, so every artifact here is organic.
const QUIET_ZONE: ZoneId = 'black_hole_chapel';

function quietSite(snapshot: BoardSnapshot, index = 0) {
  const site = snapshot.sites.filter(
    (candidate) => candidate.zoneId === QUIET_ZONE
  )[index];
  assert.ok(site, 'quiet zone has impact sites');
  return site;
}

function account(name: string) {
  return { kind: 'account' as const, userId: `t2_${name}`, username: name };
}

const KNOWN_GAP_EDGES = Object.keys(KNOWN_CONNECTIVITY_GAPS) as EdgeId[];

// Fails on any violation outside the registered known gaps.
function assertContractHeld(run: ConnectivityRun) {
  const unexpected = run.ledger.violations.filter(
    (violation) => !KNOWN_GAP_EDGES.includes(violation.edge)
  );
  assert.deepEqual(unexpected, [], 'connectivity contract violations');
}

void test('one climber’s falls raise a foothold that another climber sees, uses, and is credited for', async () => {
  const run = new ConnectivityRun(createCommunity());
  const ana = run.join('ana', account('ana'));
  const ben = run.join('ben', account('ben'));
  await ana.init();
  await ben.init();
  const site = quietSite(ana.view!);

  for (let fall = 0; fall < 3; fall += 1)
    await run.fall(ana, { siteId: site.id, bucket: 'short_jump' });

  assert.equal(ben.hasPendingHint(), true, 'ben is told the board moved');
  await run.sync(ben);
  const foothold = renderedArtifactAt(ben.view!, site.id);
  assert.equal(foothold?.type, 'corpse_stack');
  assert.equal(foothold?.organicCount, 3);
  assert.match(
    foothold!.label,
    /^3 community short jumps made this foothold\.$/
  );
  assert.equal(
    ben.view!.recentMutations.at(-1)?.copy,
    `3 short jumps raised ${site.name} to Corpse Stack.`
  );

  const slip = await run.fall(ben, {
    siteId: site.id,
    bucket: 'helper_overuse',
  });
  const receipt = (slip?.body as RecordFallResponse).receipt;
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.bucket, 'helper_overuse');
  assert.equal(receipt.siteId, site.id);
  assertContractHeld(run);
});

void test('repeated overjumps from many climbers curse a site, and clean climbs calm it', async () => {
  const run = new ConnectivityRun(createCommunity());
  const climbers = ['cy', 'dee', 'eli', 'fay'].map((name) =>
    run.join(name, account(name))
  );
  for (const climber of climbers) await climber.init();
  const site = quietSite(climbers[0]!.view!, 1);

  for (const climber of climbers)
    for (let fall = 0; fall < 3; fall += 1)
      await run.fall(climber, { siteId: site.id, bucket: 'overjump' });
  const cursed = await run.community.authoritative();
  const cursedSite = cursed.sites.find(
    (candidate) => candidate.id === site.id
  )!;
  assert.equal(cursedSite.counters.overjump, 12);
  assert.equal(cursedSite.status, 'Cursed');
  assert.equal(renderedArtifactAt(cursed, site.id)?.type, 'cursed_brick');

  for (const climber of climbers.slice(0, 2))
    for (let clear = 0; clear < 3; clear += 1)
      await run.clear(climber, QUIET_ZONE);
  const calmed = await run.community.authoritative();
  assert.equal(
    calmed.sites.find((candidate) => candidate.id === site.id)?.status,
    'Stabilized'
  );
  assert.equal(renderedArtifactAt(calmed, site.id)?.type, 'corpse_stack');
  assertContractHeld(run);
});

void test('a duplicate tab replaying a fall changes nothing and sends no second hint', async () => {
  const community = createCommunity();
  const run = new ConnectivityRun(community);
  const gus = run.join('gus', account('gus'));
  await gus.init();
  const site = quietSite(gus.view!);
  const first = await run.fall(gus, { siteId: site.id, bucket: 'wall_bonk' });
  const hints = community.hints.length;
  const before = await community.authoritative();

  const replay = await gus.resend<RecordFallResponse>(
    '/record-fall',
    first!.request
  );

  const after = await community.authoritative();
  assert.deepEqual(
    (replay.body as RecordFallResponse).receipt,
    (first!.body as RecordFallResponse).receipt
  );
  assert.equal(after.revision, before.revision);
  assert.equal(community.hints.length, hints);
  assertContractHeld(run);
});

void test('a climber still holding yesterday’s tower cannot write into today’s board', async () => {
  const community = createCommunity({
    start: new Date('2026-10-27T23:59:00.000Z'),
  });
  const run = new ConnectivityRun(community);
  const hal = run.join('hal', account('hal'));
  await hal.init();
  const yesterday = hal.view!;
  community.clock.advance(5 * 60 * 1000);

  const call = await hal.fall({
    siteId: quietSite(yesterday).id,
    bucket: 'short_jump',
  });

  assert.equal(call?.status, 409);
  const today = await community.authoritative();
  assert.notEqual(today.boardId, yesterday.boardId);
  assert.equal(today.organicFalls, 0);
});

void test('a clear moves only the clearing climber’s checkpoint', async () => {
  const run = new ConnectivityRun(createCommunity());
  const ivy = run.join('ivy', account('ivy'));
  const jon = run.join('jon', account('jon'));
  await ivy.init();
  await jon.init();

  await run.clear(ivy, 'orbital_scrapyard');
  await jon.init();

  assert.equal(ivy.resume?.zoneId, 'crater_foundry');
  assert.equal(jon.resume?.zoneId, 'orbital_scrapyard');
  assertContractHeld(run);
});

void test('signed-out climbers share one fail-closed contribution budget', async () => {
  const run = new ConnectivityRun(createCommunity());
  const first = run.join('anon-a', { kind: 'anonymous' });
  const second = run.join('anon-b', { kind: 'anonymous' });
  await first.init();
  await second.init();
  const site = quietSite(first.view!);

  for (let fall = 0; fall < 3; fall += 1)
    await run.fall(first, { siteId: site.id, bucket: 'short_jump' });
  const capped = await run.fall(second, {
    siteId: site.id,
    bucket: 'short_jump',
  });

  assert.equal(
    (capped?.body as RecordFallResponse).receipt.rejection,
    'capped'
  );
  assertContractHeld(run);
});

// Known gaps: each reproduction asserts the gap is still there. When a fix
// lands, the matching test fails until the edge leaves KNOWN_CONNECTIVITY_GAPS
// and the assertion flips to requiring the contract.
function assertGap(run: ConnectivityRun, edge: EdgeId) {
  const failures = run.ledger.violations.filter(
    (violation) => violation.edge === edge
  );
  if (KNOWN_CONNECTIVITY_GAPS[edge]) {
    assert.ok(
      failures.length > 0,
      `${edge} no longer reproduces; drop it from KNOWN_CONNECTIVITY_GAPS`
    );
  } else {
    assert.deepEqual(failures, []);
  }
  assertContractHeld(run);
}

void test('gap: a fall off a helper that other climbers displaced is lost', async () => {
  const run = new ConnectivityRun(createCommunity());
  const kai = run.join('kai', account('kai'));
  const others = ['lu', 'mo'].map((name) => run.join(name, account(name)));
  await kai.init();
  for (const other of others) await other.init();
  const site = quietSite(kai.view!, 2);
  for (let fall = 0; fall < 3; fall += 1)
    await run.fall(others[0]!, { siteId: site.id, bucket: 'short_jump' });
  await run.sync(kai);
  const helper = kai.visibleHelperAt(site.id);
  assert.equal(helper?.type, 'corpse_stack');

  // Wall bonks overtake the short jumps; the site now renders a ghost.
  for (const other of others)
    for (let fall = 0; fall < 2; fall += 1)
      await run.fall(other, { siteId: site.id, bucket: 'wall_bonk' });
  await run.fall(kai, {
    siteId: site.id,
    bucket: 'helper_overuse',
    helperArtifactId: helper!.id,
  });

  assertGap(run, 'fall.stale-helper-accepted');
});

void test('gap: a sixth wall bonk announces a Ghost Platform upgrade that never renders', async () => {
  const run = new ConnectivityRun(createCommunity());
  const climbers = ['nia', 'oz'].map((name) => run.join(name, account(name)));
  for (const climber of climbers) await climber.init();
  const site = quietSite(climbers[0]!.view!);

  for (const climber of climbers)
    for (let fall = 0; fall < 3; fall += 1)
      await run.fall(climber, { siteId: site.id, bucket: 'wall_bonk' });

  assertGap(run, 'receipt.promise-visible');
});

void test('gap: clean clears silently swap First Gap\u2019s foothold for a lantern', async () => {
  const run = new ConnectivityRun(createCommunity());
  const pia = run.join('pia', account('pia'));
  await pia.init();
  const firstGap = pia.view!.sites.find((site) => site.name === 'First Gap')!;
  assert.equal(
    renderedArtifactAt(pia.view!, firstGap.id)?.type,
    'corpse_stack'
  );

  for (let clear = 0; clear < 3; clear += 1)
    await run.clear(pia, 'orbital_scrapyard');

  const board = await run.community.authoritative();
  assert.equal(renderedArtifactAt(board, firstGap.id)?.type, 'lantern_trail');
  assertGap(run, 'receipt.no-silent-change');
});

void test('simulated community days honour the connectivity contract outside known gaps', async () => {
  for (const [seed, date] of [
    [11, '2026-10-27'],
    [29, '2026-11-02'],
  ] as const) {
    const report = await runCommunitySimulation({
      seed,
      date,
      players: 30,
      steps: 900,
    });
    const unexpected = report.violations.filter(
      (violation) => !(violation.edge in KNOWN_CONNECTIVITY_GAPS)
    );
    assert.deepEqual(unexpected, [], `seed ${seed} on ${date}`);
    for (const edge of report.edges)
      if (edge.kind === 'contract' && edge.id !== 'fall.stale-helper-accepted')
        assert.ok(
          edge.exercised > 0,
          `${edge.id} was never exercised (seed ${seed})`
        );
  }
});
