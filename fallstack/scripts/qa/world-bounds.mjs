import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROUTE_WIDTH = 480;
const PLAYABLE_INSET = 34;
const MOBILE_BREAKPOINT = 600;
const baseUrl =
  process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/world-bounds'
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 480, height: 800 },
  { width: 1280, height: 800 },
];
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await installSceneProbe(context);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/game.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => window.__fallstackFindScene?.()?.controlsReady,
      null,
      { timeout: 30_000 }
    );

    const geometry = await page.evaluate(
      ({ routeWidth, playableInset, mobileBreakpoint }) => {
        const scene = window.__fallstackFindScene();
        const bounds = scene.physics.world.bounds;
        const mobile = scene.viewportWidth() < mobileBreakpoint;
        const expectedLeft = mobile
          ? scene.currentRouteOffset + playableInset
          : 0;
        const expectedRight = mobile
          ? scene.currentRouteOffset + routeWidth - playableInset
          : scene.gameWidth();
        return {
          mobile,
          gameWidth: scene.gameWidth(),
          viewportWidth: scene.viewportWidth(),
          routeOffset: scene.currentRouteOffset,
          expectedLeft,
          expectedRight,
          physicsLeft: bounds.left,
          physicsRight: bounds.right,
          physicsWidth: bounds.width,
          playerHalfWidth: scene.player.body.halfWidth,
        };
      },
      {
        routeWidth: ROUTE_WIDTH,
        playableInset: PLAYABLE_INSET,
        mobileBreakpoint: MOBILE_BREAKPOINT,
      }
    );

    const leftContact = await driveContact(
      page,
      geometry.expectedLeft + geometry.playerHalfWidth + 1,
      -900
    );
    const rightContact = await driveContact(
      page,
      geometry.expectedRight - geometry.playerHalfWidth - 1,
      900
    );

    const result = {
      viewport,
      ...geometry,
      leftContact,
      rightContact,
    };
    results.push(result);
    check(
      geometry.physicsLeft === geometry.expectedLeft,
      `${viewport.width}px physics left matches the painted cavity`
    );
    check(
      geometry.physicsRight === geometry.expectedRight,
      `${viewport.width}px physics right matches the painted cavity`
    );
    check(
      leftContact.minPlayerLeft >= geometry.expectedLeft - 0.1 &&
        leftContact.minPlayerLeft <= geometry.expectedLeft + 0.1,
      `${viewport.width}px player cannot enter the left wall plane`
    );
    check(
      rightContact.maxPlayerRight <= geometry.expectedRight + 0.1 &&
        rightContact.maxPlayerRight >= geometry.expectedRight - 0.1,
      `${viewport.width}px player cannot enter the right wall plane`
    );
    check(
      leftContact.minScreenLeft >= -0.1 &&
        rightContact.maxScreenRight <= geometry.viewportWidth + 0.1,
      `${viewport.width}px both wall contacts remain camera-visible`
    );
    await context.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    routeWidth: ROUTE_WIDTH,
    playableInset: PLAYABLE_INSET,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    results,
    failures,
  };
  await writeFile(
    path.join(outputDir, 'world-bounds.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

async function driveContact(page, x, velocityX) {
  return page.evaluate(
    ({ x, velocityX }) =>
      new Promise((resolve) => {
        const scene = window.__fallstackFindScene();
        const player = scene.player;
        const halfWidth = player.body.halfWidth;
        player.body.reset(x, player.y);
        scene.snapCameraToPlayer();
        player.body.setVelocityX(velocityX);
        const startedAt = performance.now();
        const samples = [];
        const sample = () => {
          const camera = scene.cameras.main;
          samples.push({
            playerLeft: player.x - halfWidth,
            playerRight: player.x + halfWidth,
            screenLeft: player.x - halfWidth - camera.scrollX,
            screenRight: player.x + halfWidth - camera.scrollX,
          });
          if (performance.now() - startedAt < 180)
            return requestAnimationFrame(sample);
          resolve({
            minPlayerLeft: Math.min(
              ...samples.map((entry) => entry.playerLeft)
            ),
            maxPlayerRight: Math.max(
              ...samples.map((entry) => entry.playerRight)
            ),
            minScreenLeft: Math.min(
              ...samples.map((entry) => entry.screenLeft)
            ),
            maxScreenRight: Math.max(
              ...samples.map((entry) => entry.screenRight)
            ),
          });
        };
        requestAnimationFrame(sample);
      }),
    { x, velocityX }
  );
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

function check(condition, message) {
  if (!condition) failures.push(message);
}
