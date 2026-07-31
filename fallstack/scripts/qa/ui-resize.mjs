import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/ui-resize'
);
const browserName =
  process.argv
    .find((value) => value.startsWith('--browser='))
    ?.slice('--browser='.length) ?? 'chromium';
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);

const checks = [];
const observations = {};
await mkdir(outputDir, { recursive: true });
const browser = await browserType.launch({
  headless: true,
  ...(browserName === 'chromium'
    ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
    : {}),
});

try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  await installSceneProbe(context);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/game.html', {
    waitUntil: 'domcontentloaded',
  });
  await waitForReady(page);
  await installResizeProbe(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const sameSizeResizeProbe = await readResizeProbe(page);
  observations.sameSizeResizeProbe = sameSizeResizeProbe;
  check(
    sameSizeResizeProbe.scaleResizes === 0 &&
      sameSizeResizeProbe.platformRebuilds === 0 &&
      sameSizeResizeProbe.cameraSnaps === 0,
    'repeated same-size resize signals do no game layout work',
    sameSizeResizeProbe,
    {
      scaleResizes: 0,
      platformRebuilds: 0,
      cameraSnaps: 0,
    }
  );

  const portrait = await readLayout(page);
  await resetResizeProbe(page);
  await page.setViewportSize({ width: 812, height: 375 });
  await waitForResize(page, 812, 375);
  const landscape = await readLayout(page);
  const orientationResizeProbe = await readResizeProbe(page);
  observations.portrait = portrait;
  observations.landscape = landscape;
  observations.orientationResizeProbe = orientationResizeProbe;
  check(
    orientationResizeProbe.scaleResizes === 1 &&
      orientationResizeProbe.platformRebuilds === 1 &&
      orientationResizeProbe.cameraSnaps === 1,
    'one orientation change performs one scale, route, and camera layout pass',
    orientationResizeProbe,
    {
      scaleResizes: 1,
      platformRebuilds: 1,
      cameraSnaps: 1,
    }
  );
  check(
    landscape.coarsePointer && landscape.touchControls.display === 'flex',
    'coarse-pointer landscape keeps fixed touch controls',
    landscape.touchControls,
    'display flex'
  );
  check(
    landscape.controlsHintDisplay === 'none',
    'coarse-pointer landscape hides keyboard-only hint',
    landscape.controlsHintDisplay,
    'none'
  );
  check(
    landscape.touchControls.buttons.every(
      (button) => button.width >= 44 && button.height >= 44
    ),
    'landscape touch controls retain 44px targets',
    landscape.touchControls.buttons,
    'all dimensions >= 44px'
  );
  check(
    landscape.scene.attemptId === portrait.scene.attemptId &&
      Math.abs(landscape.scene.logicalX - portrait.scene.logicalX) <= 1,
    'grounded orientation preserves attempt and logical position',
    {
      portrait: portrait.scene,
      landscape: landscape.scene,
    },
    'same attempt and logical x within 1px'
  );
  check(
    landscape.scene.playerVisible,
    'grounded player remains visible after landscape resize',
    landscape.scene.playerRect,
    'inside canvas'
  );

  const landscapeMoved = await moveWithVisibleTouchControl(
    context,
    page,
    browserName
  );
  check(
    landscapeMoved?.delta > 10,
    'landscape touch control moves the player',
    landscapeMoved,
    'delta > 10 logical pixels'
  );

  await page.evaluate(() => {
    window.fallstackInput = { left: false, right: false, jump: true };
  });
  await page.waitForFunction(() => window.__fallstackFindScene()?.charging);
  const chargingBeforeResize = await readLayout(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForResize(page, 320, 568);
  const chargingAfterResize = await readLayout(page);
  observations.charging = {
    before: chargingBeforeResize,
    after: chargingAfterResize,
  };
  check(
    chargingAfterResize.scene.charging &&
      chargingAfterResize.scene.charge >= chargingBeforeResize.scene.charge &&
      chargingAfterResize.scene.attemptId ===
        chargingBeforeResize.scene.attemptId,
    'charge survives landscape-to-portrait resize',
    {
      before: chargingBeforeResize.scene,
      after: chargingAfterResize.scene,
    },
    'charging, nondecreasing charge, same attempt'
  );
  check(
    chargingAfterResize.scene.playerVisible,
    'charging player remains visible after portrait resize',
    chargingAfterResize.scene.playerRect,
    'inside canvas'
  );

  await page.evaluate(() => {
    window.fallstackInput = { left: false, right: false, jump: false };
  });
  await page.waitForFunction(() => window.__fallstackQa.launches > 0);
  const airborneBeforeResize = await readLayout(page);
  await page.setViewportSize({ width: 812, height: 375 });
  await waitForResize(page, 812, 375);
  const airborneAfterResize = await readLayout(page);
  observations.airborne = {
    before: airborneBeforeResize,
    after: airborneAfterResize,
  };
  check(
    airborneAfterResize.scene.attemptId ===
      airborneBeforeResize.scene.attemptId &&
      airborneAfterResize.events.falls === airborneBeforeResize.events.falls,
    'airborne resize preserves attempt without a synthetic fall',
    {
      before: airborneBeforeResize.scene,
      after: airborneAfterResize.scene,
      events: airborneAfterResize.events,
    },
    'same attempt and fall count'
  );
  check(
    airborneAfterResize.scene.playerVisible,
    'airborne player remains visible after landscape resize',
    airborneAfterResize.scene.playerRect,
    'inside canvas'
  );
  await page.screenshot({
    path: path.join(outputDir, 'touch-landscape.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForReady(page);
  await page.locator('.action-btn', { hasText: 'Guide' }).click();
  await page.waitForSelector('.guide-card');
  await page.waitForFunction(
    () => document.activeElement?.matches('.guide-card')
  );
  await page.setViewportSize({ width: 812, height: 375 });
  await waitForResize(page, 812, 375);
  const landscapeDialog = await readDialogLayout(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await waitForResize(page, 320, 568);
  const portraitDialog = await readDialogLayout(page);
  observations.dialog = {
    landscape: landscapeDialog,
    portrait: portraitDialog,
  };
  for (const [orientation, dialog] of [
    ['landscape', landscapeDialog],
    ['portrait', portraitDialog],
  ]) {
    check(
      dialog.open &&
        dialog.inputPaused &&
        dialog.focusInside &&
        dialog.insideViewport,
      `Guide remains focused, paused, and contained in ${orientation}`,
      dialog,
      {
        open: true,
        inputPaused: true,
        focusInside: true,
        insideViewport: true,
      }
    );
    check(
      dialog.touchControlsDisplay === 'flex' &&
        dialog.touchControlsDisabled,
      `Guide keeps visible disabled touch controls in ${orientation}`,
      dialog,
      { display: 'flex', disabled: true }
    );
  }
  await page.screenshot({
    path: path.join(outputDir, 'guide-portrait-after-resize.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () =>
      !window.__fallstackFindScene()?.inputPaused &&
      window.__fallstackFindScene()?.sys.isActive()
  );
  const restoredFocus = await page.evaluate(
    () => document.activeElement?.textContent?.trim() ?? ''
  );
  check(
    restoredFocus.includes('Guide'),
    'Guide restores focus after orientation changes',
    restoredFocus,
    'Guide'
  );
  await context.close();

  const desktopContext = await browser.newContext({
    viewport: { width: 812, height: 375 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://127.0.0.1:8080/game.html', {
    waitUntil: 'domcontentloaded',
  });
  await desktopPage.waitForSelector('.touch-controls', {
    state: 'attached',
  });
  const desktop = await desktopPage.evaluate(() => ({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    touchControlsDisplay: getComputedStyle(
      document.querySelector('.touch-controls')
    ).display,
    controlsHintDisplay: getComputedStyle(
      document.querySelector('.controls-hint')
    ).display,
  }));
  observations.desktop = desktop;
  check(
    !desktop.coarsePointer &&
      desktop.touchControlsDisplay === 'none' &&
      desktop.controlsHintDisplay === 'block',
    'fine-pointer landscape keeps desktop controls',
    desktop,
    {
      coarsePointer: false,
      touchControlsDisplay: 'none',
      controlsHintDisplay: 'block',
    }
  );
  await desktopContext.close();

  const failures = checks.filter((entry) => !entry.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserName,
    observations,
    checks,
    failures,
  };
  await writeFile(
    path.join(outputDir, 'ui-resize.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        browser: browserName,
        checks: checks.length,
        failures: failures.map((entry) => entry.name),
      },
      null,
      2
    )}\n`
  );
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

async function readLayout(page) {
  return page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const player = scene.player;
    const camera = scene.cameras.main;
    const canvas = document.querySelector('#game-canvas canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / camera.worldView.width;
    const scaleY = canvasRect.height / camera.worldView.height;
    const playerRect = {
      left:
        canvasRect.left +
        (player.x - player.body.halfWidth - camera.worldView.x) * scaleX,
      right:
        canvasRect.left +
        (player.x + player.body.halfWidth - camera.worldView.x) * scaleX,
      top:
        canvasRect.top +
        (player.y - player.body.halfHeight - camera.worldView.y) * scaleY,
      bottom:
        canvasRect.top +
        (player.y + player.body.halfHeight - camera.worldView.y) * scaleY,
    };
    const controls = document.querySelector('.touch-controls');
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
      },
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      controlsHintDisplay: getComputedStyle(
        document.querySelector('.controls-hint')
      ).display,
      touchControls: {
        display: getComputedStyle(controls).display,
        buttons: Array.from(controls.querySelectorAll('button')).map(
          (button) => {
            const rect = button.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              disabled: button.disabled,
            };
          }
        ),
      },
      scene: {
        logicalX: player.x - scene.currentRouteOffset,
        y: player.y,
        vx: player.body.velocity.x,
        vy: player.body.velocity.y,
        charge: scene.publishedChargePercent,
        charging: scene.charging,
        attemptId: scene.currentAttemptId,
        playerRect,
        playerVisible:
          playerRect.left >= canvasRect.left - 1 &&
          playerRect.right <= canvasRect.right + 1 &&
          playerRect.top >= canvasRect.top - 1 &&
          playerRect.bottom <= canvasRect.bottom + 1,
      },
      events: { ...window.__fallstackQa },
    };
  });
}

async function readDialogLayout(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.guide-card');
    const rect = card?.getBoundingClientRect();
    const controls = document.querySelector('.touch-controls');
    return {
      open: Boolean(card),
      inputPaused: Boolean(window.__fallstackFindScene()?.inputPaused),
      focusInside: Boolean(card?.contains(document.activeElement)),
      insideViewport: Boolean(
        rect &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= innerHeight
      ),
      cardRect: rect
        ? {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          }
        : null,
      touchControlsDisplay: getComputedStyle(controls).display,
      touchControlsDisabled: Array.from(
        controls.querySelectorAll('button')
      ).every((button) => button.disabled),
    };
  });
}

async function moveWithVisibleTouchControl(context, page, name) {
  const button = page.locator('[aria-label="Move right"]');
  if (!(await button.isVisible())) return null;
  const box = await button.boundingBox();
  if (!box) return null;
  const before = await readLayout(page);
  const point = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  if (name === 'webkit') {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    try {
      await page.waitForFunction(
        (beforeX) => {
          const scene = window.__fallstackFindScene?.();
          return (
            scene &&
            scene.player.x - scene.currentRouteOffset - beforeX > 10
          );
        },
        before.scene.logicalX,
        { timeout: 3_000 }
      );
    } finally {
      await page.mouse.up();
    }
  } else {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, radiusX: 1, radiusY: 1, force: 1 }],
    });
    await page.waitForTimeout(180);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }
  const after = await readLayout(page);
  return {
    beforeX: before.scene.logicalX,
    afterX: after.scene.logicalX,
    delta: after.scene.logicalX - before.scene.logicalX,
  };
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
    { timeout: 30_000 }
  );
  await page.waitForTimeout(250);
}

async function installResizeProbe(page) {
  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const probe = {
      scaleResizes: 0,
      platformRebuilds: 0,
      cameraSnaps: 0,
      cameraSnapSources: [],
    };
    const scaleResize = scene.scale.resize.bind(scene.scale);
    const rebuildPlatformBodies =
      scene.rebuildPlatformBodies.bind(scene);
    const snapCameraToPlayer = scene.snapCameraToPlayer.bind(scene);
    scene.scale.resize = (...args) => {
      probe.scaleResizes += 1;
      return scaleResize(...args);
    };
    scene.rebuildPlatformBodies = (...args) => {
      probe.platformRebuilds += 1;
      return rebuildPlatformBodies(...args);
    };
    scene.snapCameraToPlayer = (...args) => {
      probe.cameraSnaps += 1;
      probe.cameraSnapSources.push(
        new Error().stack?.split('\n').slice(2, 5) ?? []
      );
      return snapCameraToPlayer(...args);
    };
    window.__fallstackResizeProbe = probe;
  });
}

async function resetResizeProbe(page) {
  await page.evaluate(() => {
    window.__fallstackResizeProbe.scaleResizes = 0;
    window.__fallstackResizeProbe.platformRebuilds = 0;
    window.__fallstackResizeProbe.cameraSnaps = 0;
    window.__fallstackResizeProbe.cameraSnapSources = [];
  });
}

async function readResizeProbe(page) {
  return page.evaluate(() => ({ ...window.__fallstackResizeProbe }));
}

async function waitForResize(page, width, height) {
  await page.waitForFunction(
    ({ width, height }) => {
      const scene = window.__fallstackFindScene?.();
      const canvas = document.querySelector('#game-canvas canvas');
      const canvasRect = canvas?.getBoundingClientRect();
      return (
        innerWidth === width &&
        innerHeight === height &&
        scene?.scale.width > 0 &&
        scene?.scale.height > 0 &&
        canvasRect &&
        Math.abs(scene.viewportWidth() - canvasRect.width) <= 1 &&
        Math.abs(scene.viewportHeight() - canvasRect.height) <= 1
      );
    },
    { width, height },
    { timeout: 10_000 }
  );
  await page.waitForTimeout(300);
}

async function installSceneProbe(context) {
  await context.addInitScript(() => {
    window.__fallstackQa = { launches: 0, falls: 0 };
    window.addEventListener('fallstack:launch', () => {
      window.__fallstackQa.launches += 1;
    });
    window.addEventListener('fallstack:fall', () => {
      window.__fallstackQa.falls += 1;
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

function check(pass, name, actual, expected) {
  checks.push({ name, pass: Boolean(pass), actual, expected });
}
