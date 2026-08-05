import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const MIN_BODY_FONT_SIZE = 13;
const MIN_TOUCH_TARGET = 44;
const baseUrl = process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/ui-readability'
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
];
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/game.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('.topbar', { timeout: 30_000 });
    await page.evaluate(() => {
      const checkpoint = document.querySelector('.checkpoint-banner');
      const preview = document.createElement('div');
      preview.className = 'checkpoint-sub';
      preview.dataset.qaReadability = 'checkpoint';
      preview.textContent = 'Saved on this device for today.';
      checkpoint?.append(preview);
    });

    const game = await measureSet(page, {
      topbar: '.topbar',
      brand: '.topbar .eyebrow',
      tally: '.community-tally',
      community: '.community-tally span',
      actions: '.topbar-actions',
      guideButton: '.action-btn',
      zoneName: '.zone-tag',
      zoneStatus: '.zone-badge',
      mutationStatus: '.mutation-banner',
      checkpointStatus: '.checkpoint-sub',
      jumpButton: '.jump-btn',
    });
    await page
      .locator('[data-qa-readability="checkpoint"]')
      .evaluate((element) => element.remove());
    checkFontSizes(viewport, 'game', game, [
      'brand',
      'community',
      'guideButton',
      'zoneName',
      'zoneStatus',
      'mutationStatus',
      'checkpointStatus',
      'jumpButton',
    ]);
    checkNoOverflow(viewport, 'topbar', game.topbar);
    checkNoOverflow(viewport, 'brand', game.brand);
    checkNoOverflow(viewport, 'community tally', game.tally);
    checkNoOverflow(viewport, 'topbar actions', game.actions);
    check(
      game.topbar.height >= 58 && game.topbar.height <= 68,
      `${viewport.width}x${viewport.height} topbar stays within the 58–68px mobile band`
    );
    check(
      game.brand.right <= game.tally.left &&
        game.tally.right <= game.actions.left,
      `${viewport.width}x${viewport.height} topbar regions do not overlap`
    );
    checkTouchTarget(viewport, 'Guide button', game.guideButton);
    checkTouchTarget(viewport, 'Jump button', game.jumpButton);
    await captureScreenshot(page, {
      path: path.join(
        outputDir,
        `game-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    await page.locator('.action-btn', { hasText: 'Guide' }).click();
    await page.waitForSelector('.guide-card');
    const guide = await measureSet(page, {
      card: '.guide-card',
      kicker: '.guide-kicker',
      stepLabel: '.guide-steps b',
      stepBody: '.guide-steps span',
      sectionBody: '.guide-section p',
      keyLabel: '.guide-key dt',
      keyBody: '.guide-key dd',
      toggle: '.guide-toggle',
      close: '.guide-close',
    });
    checkFontSizes(viewport, 'guide', guide, [
      'stepLabel',
      'stepBody',
      'sectionBody',
      'keyBody',
      'toggle',
    ]);
    checkNoOverflow(viewport, 'guide', guide.card);
    checkTouchTarget(viewport, 'Guide close button', guide.close);
    await captureScreenshot(page, {
      path: path.join(
        outputDir,
        `guide-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    await page.locator('.guide-close').click();
    await page.locator('.action-btn', { hasText: 'Memory' }).click();
    await page.waitForSelector('.tower-memory-card');
    const memory = await measureSet(page, {
      card: '.tower-memory-card',
      intro: '.tower-memory-intro',
      summit: '.tower-memory-summit',
      zoneBody: '.tower-memory-zone p',
      action: '.tower-memory-actions button',
      session: '.tower-memory-session',
    });
    checkFontSizes(viewport, 'memory', memory, [
      'intro',
      'summit',
      'zoneBody',
      'action',
      'session',
    ]);
    checkNoOverflow(viewport, 'Tower Memory', memory.card);
    checkTouchTarget(viewport, 'Tower Memory action', memory.action);
    await captureScreenshot(page, {
      path: path.join(
        outputDir,
        `memory-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    results.push({ viewport, game, guide, memory });
    await context.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: {
      bodyFontSize: MIN_BODY_FONT_SIZE,
      touchTarget: MIN_TOUCH_TARGET,
    },
    results,
    failures,
  };
  await writeFile(
    path.join(outputDir, 'ui-readability.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

async function measureSet(page, selectors) {
  const entries = await Promise.all(
    Object.entries(selectors).map(async ([name, selector]) => [
      name,
      await measure(page, selector),
    ])
  );
  return Object.fromEntries(entries);
}

async function measure(page, selector) {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      selector: target,
      fontSize: Number.parseFloat(style.fontSize),
      width: rect.width,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  }, selector);
}

function checkFontSizes(viewport, surface, measurements, names) {
  for (const name of names) {
    const measurement = measurements[name];
    check(
      measurement?.fontSize >= MIN_BODY_FONT_SIZE,
      `${viewport.width}x${viewport.height} ${surface} ${name} is at least ${MIN_BODY_FONT_SIZE}px`
    );
  }
}

function checkNoOverflow(viewport, name, measurement) {
  check(
    measurement &&
      measurement.scrollWidth <= measurement.clientWidth &&
      measurement.left >= 0 &&
      measurement.right <= viewport.width,
    `${viewport.width}x${viewport.height} ${name} has no horizontal overflow`
  );
}

function checkTouchTarget(viewport, name, measurement) {
  check(
    measurement?.height >= MIN_TOUCH_TARGET &&
      measurement?.width >= MIN_TOUCH_TARGET,
    `${viewport.width}x${viewport.height} ${name} is at least ${MIN_TOUCH_TARGET}px in both dimensions`
  );
}

function check(condition, message) {
  if (!condition) failures.push(message);
}
