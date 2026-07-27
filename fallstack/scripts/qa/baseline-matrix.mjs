import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ??
    'docs/quality-reconstruction/evidence/gate-1-baseline'
);
const baseUrl =
  process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const sourceCommit = process.env.FALLSTACK_QA_SOURCE_COMMIT ?? 'unknown';

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const captures = [];
const pageErrors = [];
const consoleErrors = [];

try {
  await captureSplash('splash-mobile', {
    width: 375,
    height: 500,
    isMobile: true,
    hasTouch: true,
  });
  await captureSplash('splash-desktop', { width: 1280, height: 500 });

  for (const viewport of [
    { width: 320, height: 568, isMobile: true, hasTouch: true },
    { width: 375, height: 812, isMobile: true, hasTouch: true },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
  ]) {
    const label =
      viewport.width === 1920
        ? 'expanded-fullscreen-1920x1080'
        : `expanded-pre-input-${viewport.width}x${viewport.height}`;
    const session = await openGame(viewport);
    await capturePage(session.page, label, 'pre-input');
    await session.context.close();
  }

  await captureInputSequence();
  await captureDialogsAndProgression();
  await captureReducedMotion();

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      commit: sourceCommit,
      url: baseUrl,
      environment: 'current Mac',
      session: 'local practice',
      browser: 'Chromium',
    },
    captureKinds: {
      'pre-input': 'No gameplay input after the scene readiness contract.',
      'real input':
        'Keyboard input drove the production Phaser scene and event path.',
      'QA-positioned':
        'The production scene checkpoint/summit methods were invoked only to expose a deterministic presentation state; this is not climb proof.',
    },
    captures,
    diagnostics: {
      pageErrors,
      consoleErrors,
    },
  };
  await writeFile(
    path.join(outputDir, 'baseline-matrix.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.ok(
    captures.some((capture) => capture.label === 'actual-fall'),
    'real input reaches the falling state'
  );
  assert.ok(
    captures.some((capture) => capture.label === 'mutation-receipt'),
    'real input produces local mutation feedback'
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}

async function captureSplash(label, viewport) {
  const context = await browser.newContext({
    viewport: pickViewport(viewport),
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
  });
  const page = await context.newPage();
  trackDiagnostics(page, label);
  await page.goto(`${baseUrl}/splash.html`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('button');
  await page.screenshot({
    path: path.join(outputDir, `${label}.png`),
    animations: 'disabled',
  });
  captures.push({
    label,
    file: `${label}.png`,
    kind: 'pre-input',
    viewport: pickViewport(viewport),
    surface: 'inline splash',
  });
  await context.close();
}

async function captureInputSequence() {
  const session = await openGame({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
  });
  const { page, context } = session;

  await page.keyboard.down('Space');
  await page.waitForTimeout(140);
  await capturePage(page, 'actual-charge', 'real input', {
    chargePercent: await page
      .locator('.charge-bar')
      .getAttribute('aria-valuenow'),
  });
  await page.keyboard.up('Space');
  await page.waitForFunction(
    () => window.__fallstackQa.launches > 0 && readSceneState().vy < -100
  );
  await page.keyboard.down('ArrowLeft');
  await capturePage(page, 'actual-launch', 'real input');
  await page.keyboard.up('ArrowLeft');
  await page.reload();
  await waitForReady(page);
  const beforeLanding = await readScene(page);
  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    scene.wasGrounded = false;
    scene.player.body.reset(scene.player.x, scene.player.y - 56);
    scene.player.body.setVelocity(0, 260);
  });
  await page.waitForFunction(
    (openingLandCount) =>
      window.__fallstackQa.lands > openingLandCount &&
      readSceneState().grounded,
    beforeLanding.events.lands,
    { timeout: 8_000 }
  );
  await capturePage(page, 'landing-contact', 'QA-positioned', {
    note: 'Production collision and landing event after a QA-positioned short drop.',
  });

  await page.reload();
  await waitForReady(page);
  const fallStart = await readScene(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(
    ({ startY, fallCount }) => {
      const state = readSceneState();
      return state.y > startY + 45 && window.__fallstackQa.falls === fallCount;
    },
    { startY: fallStart.y, fallCount: fallStart.events.falls },
    { timeout: 5_000 }
  );
  await capturePage(page, 'actual-fall', 'real input');
  await page.waitForFunction(
    (fallCount) => window.__fallstackQa.falls > fallCount,
    fallStart.events.falls,
    { timeout: 5_000 }
  );
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(
    () => readSceneState().grounded && !window.fallstackInput?.right,
    null,
    { timeout: 5_000 }
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('.mutation-banner')
        ?.classList.contains('visible'),
    null,
    { timeout: 5_000 }
  );
  await capturePage(page, 'mutation-receipt', 'real input', {
    text: await page.locator('.mutation-banner').innerText(),
  });
  await page.waitForTimeout(250);
  await capturePage(page, 'grounded-respawn', 'real input');

  await context.close();
}

async function captureDialogsAndProgression() {
  const session = await openGame({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
  });
  const { page, context } = session;

  await page.getByRole('button', { name: 'Guide' }).click();
  await page.waitForSelector('.guide-card');
  await capturePage(page, 'guide-mobile', 'pre-input');
  await page.locator('.guide-close').click();

  await page.getByRole('button', { name: 'Memory' }).click();
  await page.waitForSelector('.tower-memory-card');
  await capturePage(page, 'tower-memory-mobile', 'pre-input');
  await page
    .locator('.tower-memory-actions .result-close-btn')
    .first()
    .click();

  for (const zone of [
    {
      id: 'orbital_scrapyard',
      label: 'biome-lower-ruins',
      biome: 'Lower Ruins',
    },
    {
      id: 'ring_citadel',
      label: 'biome-bell-shaft',
      biome: 'Bell Shaft',
    },
    {
      id: 'black_hole_chapel',
      label: 'biome-moon-roof',
      biome: 'Moon Roof',
    },
  ]) {
    await page.evaluate((zoneId) => {
      window.__fallstackFindScene().restoreCheckpoint(zoneId);
    }, zone.id);
    await page.waitForTimeout(180);
    await capturePage(page, zone.label, 'QA-positioned', {
      zoneId: zone.id,
      biome: zone.biome,
    });
  }

  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    scene.restoreCheckpoint('orbital_scrapyard');
    window.dispatchEvent(
      new CustomEvent('fallstack:clear', {
        detail: {
          attemptId: 'qa-baseline-checkpoint',
          zoneId: 'orbital_scrapyard',
          highestY: scene.player.y,
        },
      })
    );
  });
  await page.waitForFunction(() =>
    document.querySelector('.checkpoint-banner')?.classList.contains('visible')
  );
  await capturePage(page, 'checkpoint-feedback', 'QA-positioned', {
    note: 'Production clear handler, QA-authored deterministic event detail.',
  });

  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    scene.restoreCheckpoint('event_horizon_crown');
    scene.onLand(scene.player, {
      getData(key) {
        if (key === 'platformId') return 'summit';
        if (key === 'kind') return 'summit';
        return undefined;
      },
    });
  });
  await page.waitForSelector('.tower-memory-card');
  await capturePage(page, 'summit-result', 'QA-positioned', {
    note: 'Production summit handler, invoked directly; not climb proof.',
  });

  await context.close();
}

async function captureReducedMotion() {
  const session = await openGame({
    width: 375,
    height: 812,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await capturePage(
    session.page,
    'expanded-reduced-motion-375x812',
    'pre-input'
  );
  await session.context.close();
}

async function openGame(viewport) {
  const context = await browser.newContext({
    viewport: pickViewport(viewport),
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
    reducedMotion: viewport.reducedMotion ?? 'no-preference',
  });
  await installSceneProbe(context);
  const page = await context.newPage();
  trackDiagnostics(page, `${viewport.width}x${viewport.height}`);
  await page.goto(`${baseUrl}/game.html`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForReady(page);
  return { context, page };
}

async function capturePage(page, label, kind, details = {}) {
  const viewport = page.viewportSize();
  const eventCounts = await page.evaluate(() =>
    window.__fallstackQa ? { ...window.__fallstackQa } : null
  );
  await page.screenshot({
    path: path.join(outputDir, `${label}.png`),
    animations: 'disabled',
  });
  captures.push({
    label,
    file: `${label}.png`,
    kind,
    viewport,
    surface: 'expanded game',
    eventCounts,
    ...details,
  });
}

async function waitForReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__fallstackFindScene?.()?.controlsReady &&
          window.fallstackSnapshot &&
          !document.querySelector('.loading-overlay')
      ),
    null,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(250);
  await page.waitForFunction(() => readSceneState().grounded, null, {
    timeout: 5_000,
  });
  await page.waitForTimeout(100);
}

async function readScene(page) {
  return page.evaluate(() => readSceneState());
}

function trackDiagnostics(page, label) {
  page.on('pageerror', (error) =>
    pageErrors.push({ label, message: error.message })
  );
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (
      text ===
        'Failed to load resource: the server responded with a status of 404 (File not found)' ||
      text.includes('Unable to load shared tower snapshot') ||
      text.includes('/api/init-game') ||
      text.includes('/api/record-fall') ||
      text.includes('/api/record-clear') ||
      text.includes('/api/record-summit')
    )
      return;
    consoleErrors.push({ label, text });
  });
}

async function installSceneProbe(context) {
  await context.addInitScript(() => {
    window.__fallstackQa = { launches: 0, falls: 0, lands: 0 };
    window.addEventListener('fallstack:launch', () => {
      window.__fallstackQa.launches += 1;
    });
    window.addEventListener('fallstack:fall', () => {
      window.__fallstackQa.falls += 1;
    });
    window.addEventListener('fallstack:land', () => {
      window.__fallstackQa.lands += 1;
    });
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
    window.readSceneState = () => {
      const scene = window.__fallstackFindScene?.();
      const player = scene?.player;
      if (!scene || !player?.body) throw new Error('Scene unavailable');
      return {
        x: player.x - scene.currentRouteOffset,
        y: player.y,
        vx: player.body.velocity.x,
        vy: player.body.velocity.y,
        grounded: Boolean(
          player.body.blocked.down || player.body.touching.down
        ),
        currentZone: scene.currentZone,
        respawnZone: scene.respawnZone,
        events: { ...window.__fallstackQa },
      };
    };
  });
}

function pickViewport(viewport) {
  return { width: viewport.width, height: viewport.height };
}
