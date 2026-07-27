import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/audio-events'
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  await context.addInitScript(() => {
    window.__fallstackSoundEvents = [];
    for (const name of ['ready', 'land', 'wall-bonk']) {
      window.addEventListener(`fallstack:${name}`, (event) => {
        window.__fallstackSoundEvents.push({
          name,
          at: performance.now(),
          detail: event.detail ?? null,
        });
      });
    }
    window.__fallstackFindScene = () => {
      const root = document.querySelector('#root');
      const containerKey = root
        ? Object.keys(root).find((key) => key.startsWith('__reactContainer$'))
        : null;
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

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/game.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () =>
      window.__fallstackSoundEvents.some((event) => event.name === 'ready') &&
      window.__fallstackFindScene?.()?.controlsReady,
    null,
    { timeout: 30_000 }
  );

  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForFunction(
    () => window.__fallstackSoundEvents.some((event) => event.name === 'land'),
    null,
    { timeout: 3_000 }
  );

  const landing = await page.evaluate(() =>
    window.__fallstackSoundEvents.find((event) => event.name === 'land')
  );
  assert.equal(landing.detail.material, 'stone');
  assert.equal(landing.detail.surface, 'route');
  assert.ok(
    landing.detail.impactSpeed >= 300,
    `landing preserves impact speed (${landing.detail.impactSpeed})`
  );

  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const bounds = scene.physics.world.bounds;
    const body = scene.player.body;
    window.fallstackInput.left = true;
    body.reset(bounds.left + body.halfWidth + 70, scene.player.y - 180);
    body.setVelocity(-340, 0);
  });
  await page.waitForFunction(
    () =>
      window.__fallstackSoundEvents.some((event) => event.name === 'wall-bonk'),
    null,
    { timeout: 2_000 }
  );
  await page.evaluate(() => {
    window.fallstackInput.left = false;
  });
  await page.waitForTimeout(100);

  const events = await page.evaluate(() => window.__fallstackSoundEvents);
  const wallBonk = events.find((event) => event.name === 'wall-bonk');
  const simultaneousLand = events.find(
    (event) =>
      event.name === 'land' &&
      event.at >= wallBonk.at &&
      event.at - wallBonk.at <= 100
  );
  assert.equal(wallBonk.detail.side, 'left');
  assert.ok(
    wallBonk.detail.impactSpeed >= 250,
    `wall bonk preserves impact speed (${wallBonk.detail.impactSpeed})`
  );
  assert.equal(
    simultaneousLand,
    undefined,
    'wall bonk does not masquerade as a landing'
  );

  const report = {
    generatedAt: new Date().toISOString(),
    landing,
    wallBonk,
    simultaneousLandCount: simultaneousLand ? 1 : 0,
    events,
  };
  await writeFile(
    path.join(outputDir, 'audio-events.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
