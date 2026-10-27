import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const outputDir = path.resolve(
  process.argv[2] ??
    'docs/quality-reconstruction/evidence/character-washi-pilgrim'
);
const baseUrl = process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const states = [
  {
    name: 'grounded',
    grounded: true,
    velocityY: 0,
    visualContract: { width: 26, height: 39 },
  },
  {
    name: 'low-charge',
    grounded: true,
    velocityY: 0,
    chargeMs: 120,
    visualContract: { width: 29.4, height: 34.4 },
  },
  {
    name: 'full-charge',
    grounded: true,
    velocityY: 0,
    chargeMs: 600,
    visualContract: { width: 31, height: 32 },
  },
  {
    name: 'rising',
    grounded: false,
    velocityY: -720,
    visualContract: { width: 25, height: 42 },
  },
  {
    name: 'apex',
    grounded: false,
    velocityY: 0,
    visualContract: { width: 28, height: 40 },
  },
  {
    name: 'falling',
    grounded: false,
    velocityY: 640,
    visualContract: { width: 32, height: 38 },
  },
  {
    name: 'hard-landing',
    grounded: true,
    velocityY: 0,
    ceremony: 'land',
    visualContract: { width: 31, height: 32 },
  },
  {
    name: 'respawn',
    grounded: true,
    velocityY: 0,
    ceremony: 'respawn',
    visualContract: { width: 26, height: 39 },
  },
  {
    name: 'checkpoint',
    grounded: true,
    velocityY: 0,
    ceremony: 'checkpoint',
    visualContract: { width: 28, height: 41 },
  },
  {
    name: 'summit',
    grounded: true,
    velocityY: 0,
    ceremony: 'summit',
    visualContract: { width: 27, height: 43 },
  },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const results = [];
  const ceremonyPriorities = [];
  for (const motion of ['standard', 'reduced']) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
    });
    await installSceneProbe(context);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/game.html`);
    await waitForReady(page);
    await page.evaluate(() => window.__fallstackFindScene().scene.pause());

    const captures = [];
    for (const state of states) {
      const metrics = await forceState(page, state);
      assert.equal(metrics.physics.width, 20);
      assert.equal(metrics.physics.height, 28);
      assert.ok(
        metrics.visualKey.startsWith(metrics.expectedState),
        `${state.name} renders ${metrics.expectedState}`
      );

      const target = await playerScreenPosition(page);
      const clip = {
        x: Math.max(0, Math.floor(target.x - 56)),
        y: Math.max(0, Math.floor(target.y - 56)),
        width: 112,
        height: 112,
      };
      const filename = `${motion}-${state.name}.png`;
      await captureScreenshot(page, {
        path: path.join(outputDir, filename),
        clip,
      });
      captures.push({ label: state.name, filename });
      results.push({
        motion,
        state: state.name,
        visualContract: state.visualContract,
        ...metrics,
      });

      if (motion === 'standard' && state.name === 'grounded') {
        await captureScreenshot(page, {
          locator: page.locator('.game-shell'),
          path: path.join(outputDir, 'mobile-context.png'),
        });
      }
    }

    const priority = await page.evaluate(() => {
      const scene = window.__fallstackFindScene();
      scene.playerCeremony = null;
      scene.showPlayerCeremony('checkpoint');
      scene.showPlayerCeremony('respawn');
      const respawnWins = scene.activePlayerCeremony()?.state;
      scene.playerCeremony = null;
      scene.showPlayerCeremony('summit');
      scene.showPlayerCeremony('land');
      const summitWins = scene.activePlayerCeremony()?.state;
      return { respawnWins, summitWins };
    });
    assert.deepEqual(priority, {
      respawnWins: 'respawn',
      summitWins: 'summit',
    });
    ceremonyPriorities.push({ motion, ...priority });
    assert.deepEqual(errors, []);
    await context.close();
    await writeContactSheet(browser, motion, captures);
  }

  const narrowViewport = await captureNarrowContext(browser);
  const report = {
    generatedAt: new Date().toISOString(),
    source: 'Option A — Washi Pilgrim',
    viewport: { width: 375, height: 812 },
    physicsBody: { width: 20, height: 28 },
    narrowViewport,
    ceremonyPriorities,
    states: results,
  };
  await writeFile(
    path.join(outputDir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
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

async function waitForReady(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        window.__fallstackFindScene?.()?.controlsReady &&
        window.fallstackSnapshot &&
        !document
          .querySelector('[aria-label="Move right"]')
          ?.hasAttribute('disabled') &&
        !document.querySelector('.loading-overlay')
      ),
    null,
    { timeout: 10_000 }
  );
}

async function forceState(page, state) {
  return page.evaluate((target) => {
    const scene = window.__fallstackFindScene?.();
    const player = scene?.player;
    if (!scene || !player?.body || !scene.playerGraphics)
      throw new Error('Scene unavailable');

    scene.playerCeremony = null;
    scene.charging = typeof target.chargeMs === 'number';
    scene.chargeTime = target.chargeMs ?? 0;
    scene.facing = 1;
    player.body.setVelocity(0, target.velocityY);
    player.body.blocked.down = target.grounded;
    player.body.touching.down = target.grounded;
    if (target.ceremony) scene.showPlayerCeremony(target.ceremony, 1);
    scene.playerVisualKey = '';
    scene.drawPlayer();

    const expectedState =
      target.ceremony ??
      (typeof target.chargeMs === 'number'
        ? 'charge'
        : target.grounded
          ? 'grounded'
          : target.velocityY < -110
            ? 'rising'
            : target.velocityY > 160
              ? 'fall'
              : 'apex');
    return {
      expectedState,
      visualKey: scene.playerVisualKey,
      physics: {
        width: player.body.width,
        height: player.body.height,
      },
      rotationRadians: Math.round(scene.playerGraphics.rotation * 1000) / 1000,
      alpha: Math.round(scene.playerGraphics.alpha * 1000) / 1000,
    };
  }, state);
}

async function playerScreenPosition(page) {
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(canvas, 'Phaser canvas is visible');
  return page.evaluate((box) => {
    const scene = window.__fallstackFindScene();
    const view = scene.cameras.main.worldView;
    return {
      x: box.x + ((scene.player.x - view.x) / view.width) * box.width,
      y: box.y + ((scene.player.y - view.y) / view.height) * box.height,
    };
  }, canvas);
}

async function writeContactSheet(browserInstance, motion, captures) {
  const cards = await Promise.all(
    captures.map(async ({ label, filename }) => {
      const data = await readFile(path.join(outputDir, filename), 'base64');
      return `<figure><img src="data:image/png;base64,${data}" alt=""><figcaption>${label}</figcaption></figure>`;
    })
  );
  const context = await browserInstance.newContext({
    viewport: { width: 690, height: 360 },
  });
  const page = await context.newPage();
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #171426; color: #f4efe2; font: 12px system-ui; }
      .sheet { width: 690px; padding: 18px; }
      h1 { margin: 0 0 14px; font: 700 18px Georgia, serif; letter-spacing: .08em; }
      .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px 10px; }
      figure { margin: 0; }
      img { display: block; width: 112px; height: 112px; border: 1px solid #75552a; }
      figcaption { margin-top: 5px; text-align: center; color: #d8cdb7; }
    </style>
    <main class="sheet">
      <h1>Washi Pilgrim · ${motion} motion · 375×812 actual scale</h1>
      <div class="grid">${cards.join('')}</div>
    </main>
  `);
  await captureScreenshot(page, {
    locator: page.locator('.sheet'),
    path: path.join(outputDir, `${motion}-contact-sheet.png`),
  });
  await context.close();
}

async function captureNarrowContext(browserInstance) {
  const context = await browserInstance.newContext({
    viewport: { width: 320, height: 568 },
    hasTouch: true,
    isMobile: true,
  });
  await installSceneProbe(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/game.html`);
  await waitForReady(page);
  const metrics = await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const canvas = document.querySelector('canvas')?.getBoundingClientRect();
    const view = scene.cameras.main.worldView;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      physics: {
        width: scene.player.body.width,
        height: scene.player.body.height,
      },
      cssPerWorldPixel: canvas
        ? Math.round((canvas.width / view.width) * 1000) / 1000
        : null,
    };
  });
  assert.deepEqual(metrics.viewport, { width: 320, height: 568 });
  assert.deepEqual(metrics.physics, { width: 20, height: 28 });
  assert.equal(metrics.cssPerWorldPixel, 1);
  await captureScreenshot(page, {
    locator: page.locator('.game-shell'),
    path: path.join(outputDir, 'mobile-context-320.png'),
  });
  await context.close();
  return metrics;
}
