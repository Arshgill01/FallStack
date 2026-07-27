import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/runtime-smoke'
);
const browserName = process.argv
  .find((value) => value.startsWith('--browser='))
  ?.slice('--browser='.length) ?? 'chromium';
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);
const MOVE_HOLD_MS = browserName === 'webkit' ? 340 : 140;
const MOVE_SETTLE_MS = browserName === 'webkit' ? 500 : 250;
const FALL_HOLD_MS = browserName === 'webkit' ? 1_800 : 500;
const JUMP_HOLD_MS = browserName === 'webkit' ? 220 : 90;
await mkdir(outputDir, { recursive: true });

const browser = await browserType.launch({
  headless: true,
  ...(browserName === 'chromium'
    ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
    : {}),
});

try {
  const touchContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  await installSceneProbe(touchContext);
  const touchPage = await touchContext.newPage();
  const touchConsole = [];
  touchPage.on('console', (message) =>
    touchConsole.push({ type: message.type(), text: message.text() })
  );
  await touchPage.goto('http://127.0.0.1:8080/game.html');
  await waitForReady(touchPage);
  await touchPage.waitForTimeout(250);
  const pointer = await createPointerDriver(touchContext, touchPage, browserName);

  const beforeMove = await readScene(touchPage);
  assert.equal(
    beforeMove.events.lands,
    0,
    'settling the opening checkpoint does not emit a landing'
  );
  await holdPointer(
    pointer,
    await centerOf(touchPage, '[aria-label="Move right"]'),
    MOVE_HOLD_MS
  );
  const afterMove = await readScene(touchPage);
  assert.ok(afterMove.x > beforeMove.x + 10, 'right touch control moves the climber');
  assert.equal(afterMove.input.right, false, 'right touch releases cleanly');

  await touchPage.waitForTimeout(MOVE_SETTLE_MS);
  const beforeWarmMove = await readScene(touchPage);
  await holdPointer(
    pointer,
    await centerOf(touchPage, '[aria-label="Move left"]'),
    MOVE_HOLD_MS
  );
  const afterWarmMove = await readScene(touchPage);
  const warmMove = beforeWarmMove.x - afterWarmMove.x;
  assert.ok(warmMove > 10, 'a repeated touch moves the climber');
  assert.equal(afterWarmMove.input.left, false, 'repeated touch releases cleanly');

  const fallsBefore = afterWarmMove.events.falls;
  const landsBeforeFall = afterWarmMove.events.lands;
  await holdPointer(
    pointer,
    await centerOf(touchPage, '[aria-label="Move right"]'),
    FALL_HOLD_MS
  );
  await touchPage.waitForFunction(
    (count) => window.__fallstackQa.falls > count,
    fallsBefore
  );
  await waitForGrounded(touchPage);
  await touchPage.waitForTimeout(500);
  const afterRespawn = await readScene(touchPage);
  assert.equal(
    afterRespawn.events.falls,
    fallsBefore + 1,
    'one touch-driven fall produces exactly one respawn'
  );
  assert.equal(afterRespawn.grounded, true, 'touch-driven respawn settles on its checkpoint');
  assert.equal(afterRespawn.input.right, false, 'falling touch releases before respawn');
  assert.equal(
    afterRespawn.events.lands,
    landsBeforeFall,
    'resetting to a checkpoint does not emit a landing'
  );

  const beforeRespawnMove = await readScene(touchPage);
  await holdPointer(
    pointer,
    await centerOf(touchPage, '[aria-label="Move right"]'),
    MOVE_HOLD_MS
  );
  const afterRespawnMove = await readScene(touchPage);
  const openingMove = afterMove.x - beforeMove.x;
  const respawnMove = afterRespawnMove.x - beforeRespawnMove.x;
  assert.ok(respawnMove > 10, 'touch input still moves after respawn');
  assert.ok(
    respawnMove >= warmMove * 0.7 && respawnMove <= warmMove * 1.3,
    `warm and post-respawn ground movement stay within 30% (${round(warmMove)}px vs ${round(respawnMove)}px)`
  );

  await touchPage.reload();
  await waitForReady(touchPage);
  const jumpStart = await readScene(touchPage);
  const launchesBefore = jumpStart.events.launches;
  await holdPointer(
    pointer,
    await centerOf(touchPage, '[aria-label="Hold to charge; release to leap"]'),
    JUMP_HOLD_MS
  );
  await touchPage.waitForFunction(
    (count) => window.__fallstackQa.launches > count,
    launchesBefore
  );
  const afterJump = await readScene(touchPage);
  assert.ok(afterJump.vy < 0, 'touch release launches upward');
  assert.equal(afterJump.input.jump, false, 'jump touch releases cleanly');

  const frames = await measureFrames(touchPage, 2_000);
  await touchPage
    .locator('.game-shell')
    .screenshot({ path: path.join(outputDir, 'touch-airborne.png') });
  await touchContext.close();

  const reducedContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  await installSceneProbe(reducedContext);
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto('http://127.0.0.1:8080/game.html');
  await waitForReady(reducedPage);
  const reducedBefore = await readScene(reducedPage);
  assert.equal(reducedBefore.reducedMotion, true);
  assert.equal(reducedBefore.mediaReducedMotion, true);
  const reducedPointer = await createPointerDriver(
    reducedContext,
    reducedPage,
    browserName
  );
  const jumpCenter = await centerOf(
    reducedPage,
    '[aria-label="Hold to charge; release to leap"]'
  );
  await reducedPointer.down(jumpCenter);
  await reducedPage.waitForTimeout(220);
  const reducedDuringCharge = await readScene(reducedPage);
  assert.equal(
    reducedDuringCharge.particleCount,
    0,
    'reduced motion suppresses charge particles'
  );
  await reducedPointer.up();
  const reducedFrames = await measureFrames(reducedPage, 1_500);
  await reducedPage
    .locator('.game-shell')
    .screenshot({ path: path.join(outputDir, 'reduced-motion.png') });
  await reducedContext.close();

  const localWarnings = touchConsole.filter(
    (entry) =>
      entry.type === 'warning' && entry.text.includes('using local practice')
  );
  const appErrors = touchConsole.filter(
    (entry) => entry.type === 'error' && entry.text.includes('init-game failed')
  );
  assert.ok(localWarnings.length >= 1);
  assert.equal(appErrors.length, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserName,
    touch: {
      openingMovedLogicalPixels: round(openingMove),
      warmMovedLogicalPixels: round(warmMove),
      postRespawnMovedLogicalPixels: round(respawnMove),
      fallEvents: afterRespawn.events.falls,
      resetLandingEvents: afterRespawn.events.lands - landsBeforeFall,
      respawnGrounded: afterRespawn.grounded,
      launchVelocityY: round(afterJump.vy),
      launchEvents: afterJump.events.launches,
      inputReleased: !afterJump.input.right && !afterJump.input.jump,
    },
    reducedMotion: {
      sceneEnabled: reducedBefore.reducedMotion,
      mediaQueryMatches: reducedBefore.mediaReducedMotion,
      chargeParticles: reducedDuringCharge.particleCount,
    },
    frames,
    reducedFrames,
    localFallback: {
      warningCount: localWarnings.length,
      appErrorCount: appErrors.length,
    },
  };
  await writeFile(
    path.join(outputDir, 'runtime-smoke.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
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
  });
}

async function waitForReady(page) {
  await page.waitForFunction(() =>
    Boolean(
      window.__fallstackFindScene?.()?.controlsReady &&
      window.fallstackSnapshot &&
      !document.querySelector('[aria-label="Move right"]')?.hasAttribute('disabled') &&
      !document.querySelector('.loading-overlay')
    )
  );
}

async function readScene(page) {
  return page.evaluate(() => {
    const scene = window.__fallstackFindScene?.();
    const player = scene?.player;
    if (!scene || !player?.body) throw new Error('Scene unavailable');
    return {
      x: player.x - scene.currentRouteOffset,
      y: player.y,
      vx: player.body.velocity.x,
      vy: player.body.velocity.y,
      grounded: Boolean(player.body.blocked.down || player.body.touching.down),
      particleCount: scene.particles.length,
      reducedMotion: scene.reducedMotion,
      mediaReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      input: { ...window.fallstackInput },
      events: { ...window.__fallstackQa },
    };
  });
}

async function waitForGrounded(page) {
  await page.waitForFunction(
    () => {
      const body = window.__fallstackFindScene?.()?.player?.body;
      return Boolean(body && (body.blocked.down || body.touching.down));
    },
    null,
    { timeout: 8_000 }
  );
}

async function centerOf(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} is visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function createPointerDriver(context, page, name) {
  if (name === 'webkit') {
    return {
      async down(point) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
      },
      async up() {
        await page.mouse.up();
      },
    };
  }
  const cdp = await context.newCDPSession(page);
  return {
    async down(point) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ ...point, radiusX: 1, radiusY: 1, force: 1 }],
      });
    },
    async up() {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    },
  };
}

async function holdPointer(pointer, point, durationMs) {
  await pointer.down(point);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  await pointer.up();
}

async function measureFrames(page, durationMs) {
  const intervals = await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const values = [];
        let previous = performance.now();
        const started = previous;
        const frame = (now) => {
          values.push(now - previous);
          previous = now;
          if (now - started >= duration) resolve(values.slice(1));
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    durationMs
  );
  const sorted = [...intervals].sort((left, right) => left - right);
  return {
    samples: intervals.length,
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    maxMs: round(sorted.at(-1) ?? 0),
    over34ms: intervals.filter((value) => value > 34).length,
  };
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
