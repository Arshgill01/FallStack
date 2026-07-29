import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';
import {
  createBoardIdentity,
  createBoardSnapshot,
} from '../../dist/types/shared/game/board.js';
import {
  BOTTOM_ZONE_ID,
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
} from '../../dist/types/shared/game/mutation.js';
import {
  createMutationReceipt,
  createNonSiteMutationReceipt,
} from '../../dist/types/shared/game/mutation-receipts.js';

const baseUrl = process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const browserName =
  process.env.FALLSTACK_QA_BROWSER === 'webkit' ? 'webkit' : 'chromium';
const qaScope =
  process.env.FALLSTACK_QA_SCOPE === 'late-receipt'
    ? 'late-receipt'
    : 'full';
const sourceCommit = process.env.FALLSTACK_QA_SOURCE_COMMIT ?? 'unknown';
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/quality-reconstruction/evidence/ui-state-matrix'
);
const viewports = [
  { width: 320, height: 568, mobile: true },
  { width: 375, height: 812, mobile: true },
  { width: 1280, height: 800, mobile: false },
];
const responseStates = ['accepted', 'capped', 'stale', 'unavailable'];
const checks = [];
const observations = [];
const pageErrors = [];
const consoleErrors = [];

const seed = createDailySeed(new Date('2026-07-27T12:00:00Z'));
const identity = createBoardIdentity({
  communityId: 't5_fallstack',
  communityName: 'FallStack',
  ...seed,
});
const snapshot = createBoardSnapshot(
  identity,
  deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    siteCounters: createSeededSiteCounters(seed.dailySeed),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  }),
  SEEDED_TOTAL_FALLS
);
const firstSite = snapshot.sites[0];
assert.ok(firstSite);
const counterBefore = firstSite.counters.short_jump;
const receipts = {
  accepted: createMutationReceipt({
    eventId: 'fall:qa-accepted',
    boardId: snapshot.boardId,
    revisionBefore: snapshot.revision,
    siteId: firstSite.id,
    siteName: firstSite.name,
    bucket: 'short_jump',
    counterBefore,
    counterAfter: counterBefore + 1,
  }),
  capped: createMutationReceipt({
    eventId: 'fall:qa-capped',
    boardId: snapshot.boardId,
    revisionBefore: snapshot.revision,
    siteId: firstSite.id,
    siteName: firstSite.name,
    bucket: 'short_jump',
    counterBefore,
    counterAfter: counterBefore,
    rejection: 'capped',
  }),
  stale: createNonSiteMutationReceipt({
    eventId: 'fall:qa-stale',
    boardId: snapshot.boardId,
    revisionBefore: snapshot.revision,
    rejection: 'stale',
    copy: 'A new daily tower replaced this board.',
  }),
  unavailable: createNonSiteMutationReceipt({
    eventId: 'fall:qa-unavailable',
    boardId: snapshot.boardId,
    revisionBefore: snapshot.revision,
    rejection: 'unavailable',
    copy: 'The shared board did not change. Your climb can continue.',
  }),
};

await mkdir(outputDir, { recursive: true });
const browser = await (browserName === 'webkit' ? webkit : chromium).launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  if (qaScope === 'late-receipt') {
    for (const viewport of viewports.filter((entry) => entry.mobile))
      await inspectLateReceiptSuppression(viewport);
  } else {
    for (const viewport of viewports) {
      await inspectLoading(viewport);
      await inspectFallback(viewport);
      await inspectContrastsAndFocus(viewport);
      for (const state of responseStates) {
        await inspectResponseState(viewport, state);
      }
      if (!viewport.mobile) continue;
      await inspectReceiptPlacement(viewport);
      await inspectLateReceiptSuppression(viewport);
    }
    await inspectSplash();
  }

  const failures = checks.filter((entry) => !entry.pass);
  const unexpectedConsoleErrors = consoleErrors.filter(
    (entry) =>
      !(
        ['fallback', 'stale', 'unavailable'].includes(entry.state) &&
        (entry.text.includes('Failed to load resource') ||
          entry.text.includes('record-fall failed'))
      )
  );
  check(
    pageErrors.length === 0,
    'state matrix has no page exceptions',
    pageErrors,
    []
  );
  check(
    unexpectedConsoleErrors.length === 0,
    'state matrix has no unexpected console errors',
    unexpectedConsoleErrors,
    []
  );

  const finalFailures = checks.filter((entry) => !entry.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      commit: sourceCommit,
      url: baseUrl,
      environment: 'current Mac',
      browser: browserName,
      scope: qaScope,
      session: 'mocked shared server plus explicit local fallback',
    },
    viewports,
    responseStates,
    observations,
    checks,
    pageErrors,
    consoleErrors,
    failures: finalFailures,
  };
  await writeFile(
    path.join(outputDir, 'ui-states.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        checks: checks.length,
        responses: responseStates,
        initialFailures: failures.map((entry) => entry.name),
        failures: finalFailures.map((entry) => entry.name),
      },
      null,
      2
    )}\n`
  );
  assert.deepEqual(finalFailures, []);
} finally {
  await browser.close();
}

async function inspectLoading(viewport) {
  let releaseInit;
  const initGate = new Promise((resolve) => {
    releaseInit = resolve;
  });
  const session = await openPage(viewport, 'loading', initGate);
  const { page, context } = session;
  await page.waitForSelector('.loading-overlay');
  const loading = await page.evaluate(() => {
    const overlay = document.querySelector('.loading-overlay');
    const text = document.querySelector('.loading-text');
    return {
      visible: Boolean(overlay),
      ariaHidden: overlay?.getAttribute('aria-hidden'),
      text: text?.textContent?.trim() ?? '',
    };
  });
  const contrast = await contrastFor(page, '.loading-text', '.loading-text');
  check(
    loading.visible && loading.ariaHidden === 'true',
    `${label(viewport)} loading state stays visual-only`,
    loading,
    { visible: true, ariaHidden: 'true' }
  );
  check(
    contrast.ratio >= 4.5,
    `${label(viewport)} loading text meets 4.5:1 contrast`,
    contrast,
    'ratio >= 4.5'
  );
  await screenshot(page, viewport, 'loading');
  releaseInit();
  await waitForReady(page);
  observations.push({ viewport, state: 'loading', loading, contrast });
  await context.close();
}

async function inspectFallback(viewport) {
  const { page, context } = await openPage(viewport, 'fallback');
  await waitForReady(page);
  await page.waitForFunction(() =>
    document.querySelector('.mutation-banner')?.classList.contains('visible')
  );
  const banner = await inspectBanner(page);
  check(
    !banner.receipt && /practice|opening scars/i.test(banner.text),
    `${label(viewport)} failed init enters explicit local practice`,
    banner.text,
    'practice/opening-scars copy without a receipt'
  );
  checkBanner(viewport, 'fallback', banner);
  await screenshot(page, viewport, 'fallback');
  observations.push({ viewport, state: 'fallback', banner });
  await context.close();
}

async function inspectResponseState(viewport, state) {
  const { page, context } = await openPage(viewport, state);
  await waitForReady(page);
  await page.evaluate((attemptId) => {
    window.dispatchEvent(
      new CustomEvent('fallstack:fall', {
        detail: {
          attemptId,
          respawnZoneId: 'orbital_scrapyard',
          fallX: 240,
          fallY: 17_260,
          highestY: 17_100,
          lastPlatformId: 'start',
          lastHelperArtifactId: null,
          wallBonkPlatformId: null,
          launchChargePercent: 35,
          launchDirection: 1,
        },
      })
    );
  }, `qa-${state}-attempt`);
  await page.waitForFunction(
    (expected) => {
      const banner = document.querySelector('.mutation-banner');
      return (
        banner?.classList.contains('visible') &&
        banner.classList.contains('receipt') &&
        banner.textContent?.toLowerCase().includes(expected)
      );
    },
    state === 'accepted' ? 'counted' : state
  );
  const banner = await inspectBanner(page);
  check(
    banner.receipt,
    `${label(viewport)} ${state} response uses the structured receipt`,
    banner.classes,
    'includes receipt'
  );
  check(
    state === 'accepted'
      ? /counted/i.test(banner.text) && !/unchanged/i.test(banner.text)
      : /not counted/i.test(banner.text) && /unchanged/i.test(banner.text),
    `${label(viewport)} ${state} receipt names its board outcome`,
    banner.text,
    state === 'accepted' ? 'counted and changed' : 'not counted and unchanged'
  );
  checkBanner(viewport, state, banner);
  await screenshot(page, viewport, state);
  observations.push({ viewport, state, banner });
  await context.close();
}

async function inspectReceiptPlacement(viewport) {
  const { page, context } = await openPage(viewport, 'capped');
  await waitForReady(page);
  const zoneIds = await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    return Array.from(
      new Set([
        'orbital_scrapyard',
        ...scene.towerPlatforms
          .filter((platform) => platform.id.includes('checkpoint'))
          .map((platform) => platform.zoneId),
      ])
    );
  });
  const samples = [];

  for (const [index, zoneId] of zoneIds.entries()) {
    await page.evaluate((nextZoneId) => {
      window.__fallstackFindScene().restoreCheckpoint(nextZoneId);
    }, zoneId);
    await page.waitForTimeout(100);
    await page.evaluate(
      ({ attemptIndex, respawnZoneId }) => {
        const scene = window.__fallstackFindScene();
        window.dispatchEvent(
          new CustomEvent('fallstack:fall', {
            detail: {
              attemptId: `qa-placement-${attemptIndex}`,
              respawnZoneId,
              fallX: scene.player.x,
              fallY: scene.player.y + 500,
              highestY: scene.player.y,
              lastPlatformId: scene.lastPlatformId,
              lastHelperArtifactId: null,
              wallBonkPlatformId: null,
              launchChargePercent: 35,
              launchDirection: 1,
            },
          })
        );
      },
      { attemptIndex: index, respawnZoneId: zoneId }
    );
    await page.waitForFunction(() => {
      const banner = document.querySelector('.mutation-banner');
      return (
        banner?.classList.contains('visible') &&
        banner.classList.contains('receipt') &&
        banner.textContent?.toLowerCase().includes('capped')
      );
    });
    const sample = await page.evaluate((currentZoneId) => {
      const scene = window.__fallstackFindScene();
      const canvas = document.querySelector('#game-canvas canvas');
      const banner = document.querySelector('.mutation-banner.visible');
      if (!canvas || !banner)
        throw new Error('Receipt placement geometry was unavailable');
      const canvasRect = canvas.getBoundingClientRect();
      const bannerRect = banner.getBoundingClientRect();
      const scaleX = canvasRect.width / scene.scale.width;
      const scaleY = canvasRect.height / scene.scale.height;
      const route = scene.towerPlatforms
        .filter((platform) => platform.kind !== 'obstacle')
        .sort((left, right) => right.y - left.y);
      const nextPlatform = route.find(
        (platform) =>
          platform.y < scene.player.y - scene.player.body.halfHeight
      );
      const target = nextPlatform
        ? scene.layoutPlatform(nextPlatform)
        : null;
      const playerRect = {
        left:
          canvasRect.left +
          (scene.player.x -
            scene.player.body.halfWidth -
            scene.cameras.main.scrollX) *
            scaleX,
        right:
          canvasRect.left +
          (scene.player.x +
            scene.player.body.halfWidth -
            scene.cameras.main.scrollX) *
            scaleX,
        top:
          canvasRect.top +
          (scene.player.y -
            scene.player.body.halfHeight -
            scene.cameras.main.scrollY) *
            scaleY,
        bottom:
          canvasRect.top +
          (scene.player.y +
            scene.player.body.halfHeight -
            scene.cameras.main.scrollY) *
            scaleY,
      };
      const targetRect = target
        ? {
            left:
              canvasRect.left +
              (target.x - scene.cameras.main.scrollX) * scaleX,
            right:
              canvasRect.left +
              (target.x + target.width - scene.cameras.main.scrollX) * scaleX,
            top:
              canvasRect.top +
              (target.y - scene.cameras.main.scrollY) * scaleY,
            bottom:
              canvasRect.top +
              (target.y + target.height - scene.cameras.main.scrollY) * scaleY,
          }
        : null;
      const overlaps = (left, right) =>
        Math.max(
          0,
          Math.min(left.right, right.right) -
            Math.max(left.left, right.left)
        ) *
        Math.max(
          0,
          Math.min(left.bottom, right.bottom) -
            Math.max(left.top, right.top)
        );
      return {
        zoneId: currentZoneId,
        placement: banner.classList.contains('place-bottom')
          ? 'bottom'
          : 'top',
        playerOverlap: overlaps(bannerRect, playerRect),
        targetOverlap: targetRect ? overlaps(bannerRect, targetRect) : 0,
        banner: rectOf(bannerRect),
        player: playerRect,
        target: targetRect,
      };

      function rectOf(rect) {
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }
    }, zoneId);
    samples.push(sample);
    check(
      sample.playerOverlap === 0,
      `${label(viewport)} production receipt avoids the player at ${zoneId}`,
      sample,
      'zero overlap'
    );
    check(
      sample.targetOverlap === 0,
      `${label(viewport)} production receipt avoids the next platform at ${zoneId}`,
      sample,
      'zero overlap'
    );
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('fallstack:charge', { detail: { percent: 1 } })
      );
    });
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.mutation-banner')
          ?.classList.contains('visible')
    );
  }

  observations.push({ viewport, state: 'receipt-placement', samples });
  await context.close();
}

async function inspectLateReceiptSuppression(viewport) {
  const { page, context } = await openPage(viewport, 'capped', null, 400);
  await waitForReady(page);
  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    window.dispatchEvent(
      new CustomEvent('fallstack:fall', {
        detail: {
          attemptId: 'qa-late-receipt',
          respawnZoneId: 'orbital_scrapyard',
          fallX: scene.player.x,
          fallY: scene.player.y + 500,
          highestY: scene.player.y,
          lastPlatformId: scene.lastPlatformId,
          lastHelperArtifactId: null,
          wallBonkPlatformId: null,
          launchChargePercent: 35,
          launchDirection: 1,
        },
      })
    );
  });
  await page.waitForTimeout(80);
  await page.getByRole('button', { name: 'Move right' }).click();
  await page.waitForTimeout(450);
  const receiptVisible = await page
    .locator('.mutation-banner.receipt.visible')
    .count();
  check(
    receiptVisible === 0,
    `${label(viewport)} late fall receipt does not re-cover resumed gameplay`,
    receiptVisible,
    0
  );
  observations.push({
    viewport,
    state: 'late-receipt',
    receiptVisible: receiptVisible > 0,
  });
  await context.close();
}

async function inspectContrastsAndFocus(viewport) {
  const { page, context } = await openPage(viewport, 'contrast');
  await waitForReady(page);
  const pairs = [
    ['brand', '.topbar .eyebrow', '.topbar'],
    ['community tally', '.community-tally span', '.community-tally'],
    ['top action', '.action-btn', '.action-btn'],
    ['zone name', '.zone-tag', '.zone-tag'],
    ['zone badge', '.zone-badge', '.zone-badge'],
  ];
  if (viewport.mobile) {
    pairs.push(
      ['direction control', '.ctrl-btn', '.ctrl-btn'],
      ['jump control', '.jump-btn', '.jump-btn']
    );
  } else {
    pairs.push(['desktop controls hint', '.controls-hint', '.tower-wrap']);
  }
  const gameContrasts = await contrastPairs(page, pairs);
  checkContrasts(viewport, 'game', gameContrasts);

  const topFocus = await focusFromKeyboard(page, '.action-btn', '.topbar');
  checkFocus(viewport, 'top action', topFocus);
  let touchFocus = null;
  if (viewport.mobile) {
    touchFocus = await focusFromKeyboard(page, '.jump-btn', '.touch-controls');
    checkFocus(viewport, 'jump control', touchFocus);
  }

  await page.getByRole('button', { name: 'Guide' }).click();
  await page.waitForSelector('.guide-card');
  await page.waitForTimeout(100);
  const guideContrasts = await contrastPairs(page, [
    ['Guide kicker', '.guide-kicker', '.guide-card'],
    ['Guide title', '.guide-card h2', '.guide-card'],
    ['Guide body', '.guide-steps span', '.guide-card'],
    ['Guide key', '.guide-key dt', '.guide-card'],
    ['Guide sound toggle', '.guide-toggle', '.guide-toggle'],
    ['Guide primary action', '.guide-close', '.guide-close'],
  ]);
  checkContrasts(viewport, 'Guide', guideContrasts);
  const guideFocus = await focusFromKeyboard(
    page,
    '.guide-toggle',
    '.guide-card'
  );
  checkFocus(viewport, 'Guide toggle', guideFocus);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Memory' }).click();
  await page.waitForSelector('.tower-memory-card');
  const memoryContrasts = await contrastPairs(page, [
    ['Memory scope', '.tower-memory-scope', '.tower-memory-card'],
    ['Memory title', '.tower-memory-card h2', '.tower-memory-card'],
    ['Memory intro', '.tower-memory-intro', '.tower-memory-card'],
    ['Memory summit', '.tower-memory-summit', '.tower-memory-board'],
    [
      'Memory zone title',
      '.tower-memory-zone-heading strong',
      '.tower-memory-board',
    ],
    [
      'Memory zone state',
      '.tower-memory-zone-heading span',
      '.tower-memory-board',
    ],
    ['Memory site', '.tower-memory-site b', '.tower-memory-board'],
    ['Memory body', '.tower-memory-zone p', '.tower-memory-board'],
    ['Memory action', '.result-close-btn', '.result-close-btn'],
    [
      'Memory unavailable action status',
      '.tower-memory-action-status',
      '.tower-memory-card',
    ],
  ]);
  checkContrasts(viewport, 'Tower Memory', memoryContrasts);
  observations.push({
    viewport,
    state: 'contrast-and-focus',
    gameContrasts,
    topFocus,
    touchFocus,
    guideContrasts,
    guideFocus,
    memoryContrasts,
  });
  await context.close();
}

async function inspectSplash() {
  const viewport = { width: 375, height: 812, mobile: true };
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: true,
  });
  await installContrastProbe(context);
  await context.route('**/api/init-game', (route) =>
    json(route, {
      type: 'initGame',
      postId: 'post_ui_qa',
      postUrl: null,
      supportUrl: null,
      username: 'qa-climber',
      resume: { zoneId: BOTTOM_ZONE_ID, mode: 'account' },
      snapshot,
    })
  );
  const page = await context.newPage();
  trackDiagnostics(page, 'splash');
  await page.goto(`${baseUrl}/splash.html`, {
    waitUntil: 'domcontentloaded',
  });
  const contrasts = await contrastPairs(page, [
    ['splash kicker', '.splash-kicker', '.splash-copy'],
    ['splash title', '.splash-copy h1', '.splash-copy'],
    ['splash promise', '.splash-copy > p:not(.splash-kicker)', '.splash-copy'],
    ['splash action', '.splash-cta', '.splash-cta'],
  ]);
  checkContrasts(viewport, 'splash', contrasts);
  const focus = await focusFromKeyboard(page, '.splash-cta', '.splash-copy');
  checkFocus(viewport, 'splash action', focus);
  observations.push({ viewport, state: 'splash', contrasts, focus });
  await context.close();
}

async function openPage(
  viewport,
  state,
  initGate = null,
  recordFallDelayMs = 0
) {
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.mobile,
    isMobile: viewport.mobile,
  });
  await installContrastProbe(context);
  await installSceneProbe(context);
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/init-game') {
      if (state === 'fallback') {
        return json(
          route,
          {
            status: 'error',
            message: 'The tower failed to wake.',
          },
          500
        );
      }
      if (initGate) await initGate;
      return json(route, {
        type: 'initGame',
        postId: 'post_ui_qa',
        postUrl: null,
        supportUrl: null,
        username: 'qa-climber',
        resume: { zoneId: BOTTOM_ZONE_ID, mode: 'account' },
        snapshot,
      });
    }
    if (pathname === '/api/board-revision') {
      return json(route, {
        type: 'boardRevision',
        boardId: snapshot.boardId,
        revision: snapshot.revision,
      });
    }
    if (pathname === '/api/record-fall') {
      if (recordFallDelayMs > 0)
        await new Promise((resolve) =>
          setTimeout(resolve, recordFallDelayMs)
        );
      const receipt = receipts[state];
      assert.ok(receipt);
      if (state === 'accepted' || state === 'capped') {
        return json(route, {
          type: 'recordFall',
          counted: receipt.accepted,
          message: receipt.copy,
          receipt,
          snapshot: {
            ...snapshot,
            revision: receipt.revisionAfter,
          },
        });
      }
      return json(
        route,
        {
          status: 'error',
          message: receipt.copy,
          receipt,
          snapshot,
        },
        state === 'stale' ? 409 : 500
      );
    }
    return json(
      route,
      {
        status: 'error',
        message: `Unhandled ${request.method()} ${pathname}`,
      },
      500
    );
  });
  const page = await context.newPage();
  trackDiagnostics(page, state);
  await page.goto(`${baseUrl}/game.html`, {
    waitUntil: 'domcontentloaded',
  });
  return { context, page };
}

async function inspectBanner(page) {
  return page.evaluate(() => {
    const banner = document.querySelector('.mutation-banner.visible');
    const tower = document.querySelector('.tower-wrap');
    if (!banner || !tower)
      throw new Error('Visible mutation banner unavailable');
    const rect = banner.getBoundingClientRect();
    const towerRect = tower.getBoundingClientRect();
    return {
      text: banner.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      classes: banner.className,
      receipt: banner.classList.contains('receipt'),
      ariaLive: banner.getAttribute('aria-live'),
      insideTower:
        rect.left >= towerRect.left &&
        rect.right <= towerRect.right &&
        rect.top >= towerRect.top &&
        rect.bottom <= towerRect.bottom,
      copyContrast: contrast('.receipt-copy', '.mutation-banner.receipt'),
      stampContrast: contrast(
        '.receipt-stamp span:first-child',
        '.receipt-stamp'
      ),
      revisionContrast: contrast(
        '.receipt-stamp span:last-child',
        '.receipt-stamp'
      ),
      siteContrast: contrast('.receipt-site', '.mutation-banner.receipt'),
      bucketContrast: contrast(
        '.receipt-site small',
        '.mutation-banner.receipt'
      ),
      counterContrast: contrast(
        '.receipt-proof strong',
        '.mutation-banner.receipt'
      ),
      messageContrast: contrast(
        '.mutation-banner:not(.receipt)',
        '.mutation-banner:not(.receipt)'
      ),
    };

    function contrast(foregroundSelector, backgroundSelector) {
      const foregroundElement = document.querySelector(foregroundSelector);
      const backgroundElement = document.querySelector(backgroundSelector);
      if (!foregroundElement || !backgroundElement) return null;
      return window.__fallstackQaContrast(
        getComputedStyle(foregroundElement).color,
        getComputedStyle(backgroundElement).backgroundColor
      );
    }
  });
}

function checkBanner(viewport, state, banner) {
  check(
    banner.ariaLive === 'polite' && banner.insideTower,
    `${label(viewport)} ${state} feedback is polite and contained`,
    {
      ariaLive: banner.ariaLive,
      insideTower: banner.insideTower,
    },
    { ariaLive: 'polite', insideTower: true }
  );
  const contrasts = banner.receipt
    ? [
        banner.copyContrast,
        banner.stampContrast,
        banner.revisionContrast,
        banner.siteContrast,
        banner.bucketContrast,
        banner.counterContrast,
      ]
    : [banner.messageContrast];
  check(
    contrasts.every((entry) => entry?.ratio >= 4.5),
    `${label(viewport)} ${state} feedback text meets 4.5:1 contrast`,
    contrasts,
    'every ratio >= 4.5'
  );
}

async function contrastPairs(page, pairs) {
  const values = [];
  for (const [name, foregroundSelector, backgroundSelector] of pairs) {
    values.push({
      name,
      ...(await contrastFor(page, foregroundSelector, backgroundSelector)),
    });
  }
  return values;
}

function checkContrasts(viewport, surface, contrasts) {
  for (const contrast of contrasts) {
    check(
      contrast.ratio >= 4.5,
      `${label(viewport)} ${surface} ${contrast.name} meets 4.5:1 contrast`,
      contrast,
      'ratio >= 4.5'
    );
  }
}

async function contrastFor(page, foregroundSelector, backgroundSelector) {
  return page.evaluate(
    ({ foregroundSelector, backgroundSelector }) => {
      const foregroundElement = document.querySelector(foregroundSelector);
      const backgroundElement = document.querySelector(backgroundSelector);
      if (!foregroundElement || !backgroundElement) {
        throw new Error(
          `Missing contrast target: ${foregroundSelector} / ${backgroundSelector}`
        );
      }
      return window.__fallstackQaContrast(
        getComputedStyle(foregroundElement).color,
        getComputedStyle(backgroundElement).backgroundColor
      );
    },
    { foregroundSelector, backgroundSelector }
  );
}

async function focusFromKeyboard(page, selector, backgroundSelector) {
  const target = page.locator(selector).first();
  const normal = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      outlineColor: style.outlineColor,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement))
      break;
  }
  const focused = await target.evaluate(
    (element, { normalStyle, backgroundSelector }) => {
      const style = getComputedStyle(element);
      const background = getComputedStyle(
        document.querySelector(backgroundSelector)
      ).backgroundColor;
      const candidates = [];
      if (
        style.outlineStyle !== 'none' &&
        Number.parseFloat(style.outlineWidth) >= 2
      ) {
        candidates.push({
          source: 'outline',
          ...window.__fallstackQaContrast(style.outlineColor, background),
        });
      }
      if (style.boxShadow !== normalStyle.boxShadow) {
        for (const color of style.boxShadow.match(/rgba?\([^)]+\)/g) ?? []) {
          candidates.push({
            source: 'focus box shadow',
            ...window.__fallstackQaContrast(color, background),
          });
        }
      }
      return {
        active: element === document.activeElement,
        normal: normalStyle,
        focused: {
          boxShadow: style.boxShadow,
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
        },
        background,
        candidates,
        bestRatio: Math.max(0, ...candidates.map((entry) => entry.ratio)),
      };
    },
    {
      normalStyle: normal,
      backgroundSelector,
    }
  );
  return focused;
}

function checkFocus(viewport, name, focus) {
  check(
    focus.active && focus.bestRatio >= 3,
    `${label(viewport)} ${name} has a visible 3:1 focus indicator`,
    focus,
    { active: true, bestRatio: '>= 3' }
  );
}

async function waitForReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.fallstackSnapshot && !document.querySelector('.loading-overlay')
      ),
    null,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(250);
}

async function screenshot(page, viewport, state) {
  await page.screenshot({
    path: path.join(
      outputDir,
      `${state}-${viewport.width}x${viewport.height}.png`
    ),
    animations: 'disabled',
  });
}

function trackDiagnostics(page, state) {
  page.on('pageerror', (error) =>
    pageErrors.push({ state, message: error.message })
  );
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    consoleErrors.push({ state, text: message.text() });
  });
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function check(pass, name, actual, expected) {
  checks.push({ name, pass: Boolean(pass), actual, expected });
}

function label(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

async function installContrastProbe(context) {
  await context.addInitScript(() => {
    window.__fallstackQaContrast = (foreground, background) => {
      const parse = (value) => {
        const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
        if (channels.length < 3)
          throw new Error(`Unable to parse color: ${value}`);
        return {
          rgb: channels.slice(0, 3).map((channel) => channel / 255),
          alpha: channels[3] ?? 1,
        };
      };
      const composite = (foregroundColor, backgroundRgb) =>
        foregroundColor.rgb.map(
          (channel, index) =>
            channel * foregroundColor.alpha +
            backgroundRgb[index] * (1 - foregroundColor.alpha)
        );
      const luminance = (channels) => {
        const linear = channels.map((channel) =>
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
        );
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const parsedBackground = parse(background);
      const backgroundRgb = composite(parsedBackground, [1, 1, 1]);
      const foregroundRgb = composite(parse(foreground), backgroundRgb);
      const foregroundLuminance = luminance(foregroundRgb);
      const backgroundLuminance = luminance(backgroundRgb);
      return {
        foreground,
        background,
        ratio:
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      };
    };
  });
}

async function installSceneProbe(context) {
  await context.addInitScript(() => {
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
  });
}
