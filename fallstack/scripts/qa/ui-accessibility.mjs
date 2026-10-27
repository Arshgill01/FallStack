import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const BASE_URL = 'http://127.0.0.1:8080';
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/ui-accessibility'
);
const browserName =
  process.argv
    .find((value) => value.startsWith('--browser='))
    ?.slice('--browser='.length) ?? 'chromium';
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Unsupported browser: ${browserName}`);

const viewports = [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
];
const checks = [];
const observations = [];

await mkdir(outputDir, { recursive: true });
const browser = await browserType.launch({
  headless: true,
  ...(browserName === 'chromium'
    ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
    : {}),
});

try {
  for (const viewport of viewports) {
    const mobile = viewport.width < 600;
    const context = await browser.newContext({
      viewport,
      hasTouch: mobile,
      isMobile: mobile,
    });
    await installSceneProbe(context);
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/game.html`, {
      waitUntil: 'domcontentloaded',
    });
    await waitForReady(page);

    const surface = await page.evaluate(() => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      const bodyStyle = getComputedStyle(document.body);
      const towerStyle = getComputedStyle(
        document.querySelector('.tower-wrap')
      );
      const touchStyle = getComputedStyle(
        document.querySelector('.touch-controls')
      );
      return {
        viewport: viewportMeta?.getAttribute('content') ?? '',
        themeColor:
          document
            .querySelector('meta[name="theme-color"]')
            ?.getAttribute('content') ?? null,
        bodyTouchAction: bodyStyle.touchAction,
        towerTouchAction: towerStyle.touchAction,
        touchControlsTouchAction: touchStyle.touchAction,
      };
    });
    check(
      !surface.viewport.includes('user-scalable=no') &&
        !surface.viewport.includes('maximum-scale'),
      `${label(viewport)} game viewport permits browser zoom`,
      surface.viewport,
      'no user-scalable=no or maximum-scale'
    );
    check(
      surface.themeColor === '#08050a',
      `${label(viewport)} game declares a browser theme color`,
      surface.themeColor,
      '#08050a'
    );
    check(
      surface.bodyTouchAction === 'manipulation',
      `${label(viewport)} body preserves browser zoom gestures`,
      surface.bodyTouchAction,
      'manipulation'
    );
    check(
      surface.towerTouchAction === 'pinch-zoom',
      `${label(viewport)} tower preserves pinch zoom`,
      surface.towerTouchAction,
      'pinch-zoom'
    );
    check(
      surface.touchControlsTouchAction === 'none',
      `${label(viewport)} hold controls retain direct touch ownership`,
      surface.touchControlsTouchAction,
      'none'
    );

    const guide = await exerciseDialog(page, {
      openButton: 'Guide',
      dialogSelector: '.guide-card',
      closeButtonSelector: '.guide-close',
      expectedLabelledBy: 'fallstack-guide-title',
    });
    checksForDialog(viewport, 'Guide', guide);
    const guideContrast = await contrastFor(
      page,
      '.guide-close',
      '.guide-close'
    );
    check(
      guideContrast.ratio >= 4.5,
      `${label(viewport)} Guide primary action meets 4.5:1 text contrast`,
      guideContrast,
      'ratio >= 4.5'
    );
    await captureScreenshot(page, {
      path: path.join(
        outputDir,
        `guide-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    await page.keyboard.press('Escape');
    await waitForInputPause(page, false);
    const guideRestored = await activeElementText(page);
    check(
      guideRestored.includes('Guide'),
      `${label(viewport)} Guide restores focus to its opener`,
      guideRestored,
      'Guide'
    );
    const beforeRestoredInput = await readScene(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(220);
    await page.keyboard.up('ArrowRight');
    const afterRestoredInput = await readScene(page);
    check(
      afterRestoredInput.x > beforeRestoredInput.x + 10,
      `${label(viewport)} keyboard input resumes after Guide closes`,
      afterRestoredInput.x - beforeRestoredInput.x,
      '> 10 logical pixels'
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReady(page);
    const memory = await exerciseDialog(page, {
      openButton: 'Memory',
      dialogSelector: '.tower-memory-card',
      closeButtonSelector: '.tower-memory-actions .result-close-btn',
      expectedLabelledBy: 'fallstack-memory-title',
    });
    checksForDialog(viewport, 'Tower Memory', memory);
    await captureScreenshot(page, {
      path: path.join(
        outputDir,
        `memory-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await waitForInputPause(page, false);
    const memoryRestored = await activeElementText(page);
    check(
      memoryRestored.includes('Memory'),
      `${label(viewport)} Tower Memory restores focus to its opener`,
      memoryRestored,
      'Memory'
    );

    observations.push({
      viewport,
      surface,
      guide,
      guideContrast,
      memory,
    });
    await context.close();
  }

  const splashContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const splashPage = await splashContext.newPage();
  await splashPage.goto(`${BASE_URL}/splash.html`, {
    waitUntil: 'domcontentloaded',
  });
  const splashMetadata = await splashPage.evaluate(() => ({
    viewport:
      document
        .querySelector('meta[name="viewport"]')
        ?.getAttribute('content') ?? '',
    themeColor:
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content') ?? null,
  }));
  check(
    !splashMetadata.viewport.includes('user-scalable=no') &&
      !splashMetadata.viewport.includes('maximum-scale'),
    'splash viewport permits browser zoom',
    splashMetadata.viewport,
    'no user-scalable=no or maximum-scale'
  );
  check(
    splashMetadata.themeColor === '#08050a',
    'splash declares a browser theme color',
    splashMetadata.themeColor,
    '#08050a'
  );
  await splashContext.close();

  const failures = checks.filter((entry) => !entry.pass);
  const report = {
    generatedAt: new Date().toISOString(),
    browser: browserName,
    observations,
    splashMetadata,
    checks,
    failures,
  };
  await writeFile(
    path.join(outputDir, 'ui-accessibility.json'),
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

async function exerciseDialog(
  page,
  { openButton, dialogSelector, closeButtonSelector, expectedLabelledBy }
) {
  await page.locator('.action-btn', { hasText: openButton }).click();
  await page.waitForSelector(dialogSelector);
  await page.waitForFunction(
    (selector) => document.activeElement?.matches(selector),
    dialogSelector
  );

  const before = await readScene(page);
  const semantics = await page.evaluate(
    ({ dialogSelector, expectedLabelledBy }) => {
      const card = document.querySelector(dialogSelector);
      const dialog = card?.parentElement;
      const labelledBy = dialog?.getAttribute('aria-labelledby');
      return {
        role: dialog?.getAttribute('role'),
        modal: dialog?.getAttribute('aria-modal'),
        labelledBy,
        labelExists: Boolean(labelledBy && document.getElementById(labelledBy)),
        expectedLabelledBy,
        focusedCard: document.activeElement === card,
        touchControlsDisabled: Array.from(
          document.querySelectorAll('.touch-controls button')
        ).every((button) => button.disabled),
      };
    },
    { dialogSelector, expectedLabelledBy }
  );

  await page.keyboard.press('Shift+Tab');
  const reverseTabInside = await page.evaluate(
    (selector) =>
      Boolean(
        document.querySelector(selector)?.contains(document.activeElement)
      ),
    dialogSelector
  );
  await page.locator(dialogSelector).focus();
  await page.keyboard.press('Tab');
  const forwardTabInside = await page.evaluate(
    (selector) =>
      Boolean(
        document.querySelector(selector)?.contains(document.activeElement)
      ),
    dialogSelector
  );

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(360);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space');
  await page.waitForTimeout(220);
  await page.keyboard.up('Space');
  await page.waitForTimeout(480);
  const after = await readScene(page);
  const dialogStillOpen = await page.locator(dialogSelector).isVisible();
  const closeButtonEnabled = await page
    .locator(closeButtonSelector)
    .isEnabled();

  return {
    semantics,
    reverseTabInside,
    forwardTabInside,
    dialogStillOpen,
    closeButtonEnabled,
    before,
    after,
    deltas: {
      x: round(after.x - before.x),
      y: round(after.y - before.y),
      launches: after.events.launches - before.events.launches,
      falls: after.events.falls - before.events.falls,
      charge: after.charge - before.charge,
    },
  };
}

function checksForDialog(viewport, name, result) {
  const prefix = `${label(viewport)} ${name}`;
  check(
    result.semantics.role === 'dialog' &&
      result.semantics.modal === 'true' &&
      result.semantics.labelledBy === result.semantics.expectedLabelledBy &&
      result.semantics.labelExists,
    `${prefix} has a visible programmatic title`,
    result.semantics,
    `aria-labelledby=${result.semantics.expectedLabelledBy}`
  );
  check(
    result.semantics.focusedCard,
    `${prefix} receives focus on open`,
    result.semantics.focusedCard,
    true
  );
  check(
    result.reverseTabInside && result.forwardTabInside,
    `${prefix} traps forward and reverse Tab`,
    {
      reverse: result.reverseTabInside,
      forward: result.forwardTabInside,
    },
    { reverse: true, forward: true }
  );
  check(
    result.semantics.touchControlsDisabled,
    `${prefix} disables touch controls`,
    result.semantics.touchControlsDisabled,
    true
  );
  check(
    result.before.inputPaused && result.after.inputPaused,
    `${prefix} pauses Phaser input while open`,
    {
      before: result.before.inputPaused,
      after: result.after.inputPaused,
    },
    { before: true, after: true }
  );
  check(
    Math.abs(result.deltas.x) <= 0.5 &&
      result.deltas.launches === 0 &&
      result.deltas.falls === 0 &&
      result.after.attemptId === result.before.attemptId &&
      result.after.charge === 0,
    `${prefix} blocks hidden movement, charge, launch, and fall`,
    result.deltas,
    {
      absX: '<= 0.5',
      launches: 0,
      falls: 0,
      unchangedAttempt: true,
      charge: 0,
    }
  );
  check(
    result.dialogStillOpen && result.closeButtonEnabled,
    `${prefix} remains operable after ignored gameplay keys`,
    {
      open: result.dialogStillOpen,
      closeEnabled: result.closeButtonEnabled,
    },
    { open: true, closeEnabled: true }
  );
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

async function waitForInputPause(page, inputPaused) {
  await page.waitForFunction((expected) => {
    const scene = window.__fallstackFindScene?.();
    if (!scene || Boolean(scene.inputPaused) !== expected) return false;
    return expected || scene.sys.isActive();
  }, inputPaused);
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
      charge: scene.publishedChargePercent,
      charging: scene.charging,
      inputPaused: Boolean(scene.inputPaused),
      attemptId: scene.currentAttemptId,
      events: { ...window.__fallstackQa },
    };
  });
}

async function activeElementText(page) {
  return page.evaluate(
    () =>
      document.activeElement?.getAttribute('aria-label') ??
      document.activeElement?.textContent?.trim() ??
      ''
  );
}

async function contrastFor(page, foregroundSelector, backgroundSelector) {
  return page.evaluate(
    ({ foregroundSelector, backgroundSelector }) => {
      const foreground = getComputedStyle(
        document.querySelector(foregroundSelector)
      ).color;
      const background = getComputedStyle(
        document.querySelector(backgroundSelector)
      ).backgroundColor;
      const parse = (value) =>
        value
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map((channel) => Number(channel) / 255);
      const luminance = (value) => {
        const [red, green, blue] = parse(value).map((channel) =>
          channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
        );
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return {
        foreground,
        background,
        ratio:
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      };
    },
    { foregroundSelector, backgroundSelector }
  );
}

function check(pass, name, actual, expected) {
  checks.push({ name, pass: Boolean(pass), actual, expected });
}

function label(viewport) {
  return `${viewport.width}x${viewport.height}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
