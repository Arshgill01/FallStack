import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';
import {
  createBoardIdentity,
  createBoardSnapshot,
  mutationBeatForReceipt,
} from '../../dist/types/shared/game/board.js';
import { validateRecordFallRequest } from '../../dist/types/shared/game/events.js';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
} from '../../dist/types/shared/game/mutation.js';
import { resolveFallObservation } from '../../dist/types/shared/game/mutation-events.js';
import { planFallMutation } from '../../dist/types/shared/game/mutation-plans.js';
import { BOTTOM_ZONE_ID } from '../../dist/types/shared/game/zones.js';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/shared-session'
);
await mkdir(outputDir, { recursive: true });

const now = new Date();
const seed = createDailySeed(now);
const identity = createBoardIdentity({
  communityId: 't5_fallstack',
  communityName: 'FallStack',
  ...seed,
});
const siteCounters = createSeededSiteCounters(seed.dailySeed);
const receipts = new Map();
const recentMutations = [];
let revision = SEEDED_TOTAL_FALLS;
let totalFalls = SEEDED_TOTAL_FALLS;
let revisionReads = 0;
let initReads = 0;

function snapshot() {
  return createBoardSnapshot(
    identity,
    deriveSnapshot({
      ...seed,
      counters: createSeededCounters(),
      siteCounters,
      totalFalls,
      totalClears: 0,
      totalSummits: 0,
      achievements: createInitialAchievements(),
    }),
    revision,
    recentMutations
  );
}

async function handleApi(route, role) {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;

  if (request.method() === 'GET' && pathname === '/api/init-game') {
    initReads += 1;
    return json(route, {
      type: 'initGame',
      postId: 'post_shared_qa',
      username: 'qa-climber',
      snapshot: snapshot(),
      resume: { zoneId: BOTTOM_ZONE_ID, mode: 'account' },
    });
  }

  if (request.method() === 'GET' && pathname === '/api/board-revision') {
    revisionReads += 1;
    return json(route, {
      type: 'boardRevision',
      boardId: identity.boardId,
      revision,
    });
  }

  if (request.method() === 'POST' && pathname === '/api/record-fall') {
    const body = request.postDataJSON();
    const parsed = validateRecordFallRequest(body, Date.now());
    assert.equal(parsed.ok, true, 'browser emitted a valid fall event');
    const existingReceipt = receipts.get(body.eventId) ?? null;
    const currentSnapshot = snapshot();
    const resolved = resolveFallObservation(parsed.value, currentSnapshot);
    assert.equal(resolved.ok, true, 'server resolved the real browser fall');
    const fall = resolved.value;
    const counter = siteCounters[fall.siteId]?.[fall.bucket];
    assert.equal(typeof counter, 'number');
    const plan = planFallMutation({
      eventId: body.eventId,
      boardId: identity.boardId,
      revision,
      siteId: fall.siteId,
      siteName: fall.siteName,
      bucket: fall.bucket,
      counter,
      contributorBucketCount: role === 'bob' ? 3 : 0,
      contributorDailyFallCount: 0,
      existingReceipt,
    });

    if (plan.storeReceipt) receipts.set(body.eventId, plan.receipt);
    if (plan.applyMutation) {
      siteCounters[fall.siteId][fall.bucket] += 1;
      totalFalls += 1;
      revision = plan.receipt.revisionAfter;
      const beat = mutationBeatForReceipt(plan.receipt);
      if (beat) recentMutations.push(beat);
    }

    if (role === 'bob') {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return json(route, {
      type: 'recordFall',
      counted: plan.receipt.accepted,
      message: plan.receipt.copy,
      receipt: plan.receipt,
      snapshot: snapshot(),
    });
  }

  return json(
    route,
    { status: 'error', message: `Unhandled ${pathname}` },
    500
  );
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const contexts = await Promise.all([
  browser.newContext({ viewport: { width: 375, height: 812 } }),
  browser.newContext({ viewport: { width: 375, height: 812 } }),
]);
const errors = [];
let alice = null;
let bob = null;

try {
  for (const [index, context] of contexts.entries()) {
    await context.addInitScript(() => {
      window.__fallstackQa = { falls: 0, lands: 0 };
      window.__fallstackFindScene = () => {
        const root = document.querySelector('#root');
        if (!root) return null;
        const containerKey = Object.keys(root).find((key) =>
          key.startsWith('__reactContainer$')
        );
        const container = containerKey ? root[containerKey] : null;
        const stack = [container?.current ?? container].filter(Boolean);
        const seen = new Set();
        while (stack.length) {
          const fiber = stack.pop();
          if (!fiber || seen.has(fiber)) continue;
          seen.add(fiber);
          let hook = fiber.memoizedState;
          while (hook) {
            const candidate = hook.memoizedState?.current;
            const scene = candidate?.scene?.keys?.FallstackScene;
            if (scene) return scene;
            hook = hook.next;
          }
          if (fiber.child) stack.push(fiber.child);
          if (fiber.sibling) stack.push(fiber.sibling);
        }
        return null;
      };
      window.addEventListener('fallstack:fall', () => {
        window.__fallstackQa.falls += 1;
      });
      window.addEventListener('fallstack:land', () => {
        window.__fallstackQa.lands += 1;
      });
    });
    await context.route('**/api/**', (route) =>
      handleApi(route, index === 0 ? 'alice' : 'bob')
    );
  }

  [alice, bob] = await Promise.all(
    contexts.map((context) => context.newPage())
  );
  for (const [name, page] of [
    ['alice', alice],
    ['bob', bob],
  ]) {
    page.on('pageerror', (error) => errors.push(`${name}: ${String(error)}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
    });
  }

  await Promise.all([
    alice.goto('http://127.0.0.1:8080/game.html'),
    bob.goto('http://127.0.0.1:8080/game.html'),
  ]);
  await Promise.all([waitForReady(alice), waitForReady(bob)]);

  const initialAlice = await readClient(alice);
  const initialBob = await readClient(bob);
  assert.equal(initialAlice.revision, SEEDED_TOTAL_FALLS);
  assert.equal(initialBob.revision, SEEDED_TOTAL_FALLS);
  assert.equal(initialAlice.scopeLabel, 'r/FallStack');

  await performOpeningFall(alice, 1);
  await performOpeningFall(alice, 2);
  const afterAlice = await readClient(alice);
  assert.equal(afterAlice.revision, SEEDED_TOTAL_FALLS + 2);
  assert.equal(afterAlice.totalFalls, SEEDED_TOTAL_FALLS + 2);
  assert.equal(afterAlice.latestReceiptSite, 'First Gap');
  assert.match(afterAlice.latestReceiptBucket, /short jump/i);
  await captureScreenshot(alice, {
    path: path.join(outputDir, 'alice-mutated.png'),
  });

  const bobBeforeFlight = await readClient(bob);
  assert.equal(bobBeforeFlight.revision, SEEDED_TOTAL_FALLS);
  const openingJump = await positionForOpeningJump(bob);
  const launchKey = openingJump.direction > 0 ? 'ArrowRight' : 'ArrowLeft';
  await bob.keyboard.down(launchKey);
  await bob.keyboard.down('Space');
  await bob.waitForTimeout(openingJump.chargeMs);
  await bob.keyboard.up('Space');
  await bob.waitForTimeout(70);
  const bobAirborne = await readClient(bob);
  assert.equal(bobAirborne.grounded, false, 'second climber is airborne');

  await bob.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange'))
  );
  await waitFor(() => revisionReads >= 1 && initReads >= 3, 3_000);
  await bob.waitForTimeout(120);
  const deferred = await readClient(bob);
  assert.equal(
    deferred.revision,
    SEEDED_TOTAL_FALLS,
    'remote collision state waits while the second climber is airborne'
  );

  await bob.keyboard.up(launchKey);
  await bob.waitForFunction(
    (nextRevision) => window.fallstackSnapshot?.revision === nextRevision,
    SEEDED_TOTAL_FALLS + 2,
    { timeout: 8_000 }
  );
  const reconciled = await readClient(bob);
  assert.equal(reconciled.revision, SEEDED_TOTAL_FALLS + 2);
  assert.equal(reconciled.firstGapShortJumps, 6);
  assert.equal(reconciled.hasMercyNail, true);
  assert.match(reconciled.remoteBeat, /First Gap|Mercy Nail/i);
  await captureScreenshot(bob, {
    path: path.join(outputDir, 'bob-reconciled.png'),
  });

  await bob.close();
  bob = await contexts[1].newPage();
  bob.on('pageerror', (error) => errors.push(`bob-reopen: ${String(error)}`));
  bob.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(`bob-reopen: ${message.text()}`);
  });
  await bob.goto('http://127.0.0.1:8080/game.html');
  await waitForReady(bob);
  const reloaded = await readClient(bob);
  assert.equal(reloaded.revision, SEEDED_TOTAL_FALLS + 2);
  assert.equal(reloaded.firstGapShortJumps, 6);
  assert.equal(reloaded.hasMercyNail, true);

  const report = {
    generatedAt: new Date().toISOString(),
    boardId: identity.boardId,
    initialRevision: SEEDED_TOTAL_FALLS,
    finalRevision: revision,
    realFalls: 2,
    deferredRevision: deferred.revision,
    reconciledRevision: reconciled.revision,
    firstGapShortJumps: reconciled.firstGapShortJumps,
    mercyNailVisible: reconciled.hasMercyNail,
    remoteBeat: reconciled.remoteBeat,
    reloadRevision: reloaded.revision,
    errors,
  };
  await writeFile(
    path.join(outputDir, 'shared-session.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(errors, []);
} catch (error) {
  const diagnostic = {
    generatedAt: new Date().toISOString(),
    error:
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : String(error),
    server: { revision, totalFalls, revisionReads, initReads },
    alice: alice
      ? await readClient(alice).catch((readError) => ({
          readError: String(readError),
        }))
      : null,
    bob: bob
      ? await readClient(bob).catch((readError) => ({
          readError: String(readError),
        }))
      : null,
    errors,
  };
  await writeFile(
    path.join(outputDir, 'failure.json'),
    `${JSON.stringify(diagnostic, null, 2)}\n`
  );
  process.stderr.write(`${JSON.stringify(diagnostic, null, 2)}\n`);
  throw error;
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}

async function performOpeningFall(page, expectedFalls) {
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(
    (count) => window.__fallstackQa?.falls >= count,
    expectedFalls,
    { timeout: 8_000 }
  );
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(
    (nextRevision) => window.fallstackSnapshot?.revision === nextRevision,
    SEEDED_TOTAL_FALLS + expectedFalls,
    { timeout: 5_000 }
  );
  await page.waitForTimeout(180);
}

async function waitForReady(page) {
  await page.waitForFunction(() => {
    return Boolean(
      window.__fallstackFindScene?.()?.controlsReady &&
      window.fallstackSnapshot &&
      !document.querySelector('.loading-overlay') &&
      document.querySelector('.game-shell')?.dataset.gameplayReady === 'true'
    );
  });
}

async function positionForOpeningJump(page) {
  const initial = await readClient(page);
  const target = initial.openingTarget;
  assert.ok(target);
  const direction = target.x + target.width / 2 >= initial.x ? 1 : -1;
  const desiredX = direction > 0 ? target.x - 88 : target.x + target.width + 88;
  const deadline = Date.now() + 2_000;
  let activeKey = null;
  while (Date.now() < deadline) {
    const state = await readClient(page);
    if (!state.grounded || Math.abs(state.x - desiredX) <= 5) break;
    const nextKey = state.x < desiredX ? 'ArrowRight' : 'ArrowLeft';
    if (nextKey !== activeKey) {
      if (activeKey) await page.keyboard.up(activeKey);
      await page.keyboard.down(nextKey);
      activeKey = nextKey;
    }
    await page.waitForTimeout(16);
  }
  if (activeKey) await page.keyboard.up(activeKey);
  await page.waitForTimeout(120);
  const verticalGap = initial.y + 14 - target.y;
  const chargeMs = verticalGap > 118 ? 90 : verticalGap > 108 ? 62 : 42;
  return {
    direction,
    chargeMs,
  };
}

async function readClient(page) {
  return page.evaluate(() => {
    const scene = window.__fallstackFindScene?.();
    const player = scene?.player;
    const snapshot = window.fallstackSnapshot;
    if (!scene || !player?.body || !snapshot)
      throw new Error('Client state unavailable');
    const firstGap = snapshot.sites.find((site) => site.name === 'First Gap');
    const route = scene.towerPlatforms
      .filter((platform) => platform.kind !== 'obstacle')
      .sort((left, right) => right.y - left.y);
    const openingTarget = route[1];
    return {
      revision: snapshot.revision,
      totalFalls: snapshot.totalFalls,
      scopeLabel: snapshot.scopeLabel,
      x: player.x - scene.currentRouteOffset,
      y: player.y,
      vx: player.body.velocity.x,
      vy: player.body.velocity.y,
      grounded: Boolean(player.body.blocked.down || player.body.touching.down),
      lastPlatformId: scene.lastPlatformId,
      attemptId: scene.currentAttemptId,
      openingTarget: openingTarget
        ? {
            id: openingTarget.id,
            x: openingTarget.x,
            y: openingTarget.y,
            width: openingTarget.width,
            height: openingTarget.height,
          }
        : null,
      firstGapShortJumps: firstGap?.counters.short_jump,
      hasMercyNail: firstGap?.artifacts.some(
        (artifact) => artifact.type === 'mercy_nail'
      ),
      latestReceiptSite:
        document
          .querySelector('.receipt-site')
          ?.childNodes[0]?.textContent?.trim() ?? '',
      latestReceiptBucket:
        document.querySelector('.receipt-site small')?.textContent?.trim() ??
        '',
      remoteBeat:
        document.querySelector('.remote-beat')?.textContent?.trim() ?? '',
    };
  });
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for shared API activity');
}
