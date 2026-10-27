import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const ROUTE_WIDTH = 480;
const PLAYABLE_INSET = 34;
const PLAYER_VISUAL_EDGE_CLEARANCE = 12;
const MOBILE_BREAKPOINT = 600;
const MIN_VISIBLE_PILLAR_DEPTH = 34;
const baseUrl = process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/world-bounds'
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const viewports = [
  { width: 286, height: 650 },
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 480, height: 800 },
  { width: 1280, height: 800 },
];
const results = [];
const failures = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: viewport.width < MOBILE_BREAKPOINT ? 3 : 1,
    });
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
      ({
        routeWidth,
        playableInset,
        mobileBreakpoint,
        playerVisualEdgeClearance,
      }) => {
        const scene = window.__fallstackFindScene();
        const bounds = scene.physics.world.bounds;
        const mobile = scene.viewportWidth() < mobileBreakpoint;
        const rail = document.querySelector('.tower-side-rails');
        const railRect = rail?.getBoundingClientRect();
        const railStyle = rail ? getComputedStyle(rail) : null;
        const railBeforeStyle = rail
          ? getComputedStyle(rail, '::before')
          : null;
        const railAfterStyle = rail ? getComputedStyle(rail, '::after') : null;
        const paintedLeft = mobile
          ? scene.currentRouteOffset + playableInset
          : 0;
        const paintedRight = mobile
          ? scene.currentRouteOffset + routeWidth - playableInset
          : scene.gameWidth();
        const expectedLeft = mobile
          ? paintedLeft + playerVisualEdgeClearance
          : paintedLeft;
        const expectedRight = mobile
          ? paintedRight - playerVisualEdgeClearance
          : paintedRight;
        return {
          mobile,
          gameWidth: scene.gameWidth(),
          viewportWidth: scene.viewportWidth(),
          routeOffset: scene.currentRouteOffset,
          paintedLeft,
          paintedRight,
          expectedLeft,
          expectedRight,
          physicsLeft: bounds.left,
          physicsRight: bounds.right,
          physicsWidth: bounds.width,
          playerHalfWidth: scene.player.body.halfWidth,
          rail:
            railRect && railStyle
              ? {
                  left: railRect.left,
                  right: railRect.right,
                  top: railRect.top,
                  bottom: railRect.bottom,
                  borderLeftWidth: Number.parseFloat(railStyle.borderLeftWidth),
                  borderRightWidth: Number.parseFloat(
                    railStyle.borderRightWidth
                  ),
                  beforeWidth:
                    railBeforeStyle?.content !== 'none'
                      ? Number.parseFloat(railBeforeStyle?.width ?? '0')
                      : 0,
                  afterWidth:
                    railAfterStyle?.content !== 'none'
                      ? Number.parseFloat(railAfterStyle?.width ?? '0')
                      : 0,
                }
              : null,
        };
      },
      {
        routeWidth: ROUTE_WIDTH,
        playableInset: PLAYABLE_INSET,
        mobileBreakpoint: MOBILE_BREAKPOINT,
        playerVisualEdgeClearance: PLAYER_VISUAL_EDGE_CLEARANCE,
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
    const visualContacts = geometry.mobile
      ? {
          left: await measureVisualContact(page, 'left'),
          right: await measureVisualContact(page, 'right'),
        }
      : null;

    const result = {
      viewport,
      ...geometry,
      leftContact,
      rightContact,
      visualContacts,
    };
    results.push(result);
    check(
      geometry.physicsLeft === geometry.expectedLeft,
      `${viewport.width}px physics left preserves the character artwork inside the painted cavity`
    );
    check(
      geometry.physicsRight === geometry.expectedRight,
      `${viewport.width}px physics right preserves the character artwork inside the painted cavity`
    );
    check(
      leftContact.minPlayerLeft >= geometry.expectedLeft - 0.1 &&
        leftContact.minPlayerLeft <= geometry.expectedLeft + 0.1,
      `${viewport.width}px player body keeps visual clearance from the left wall plane`
    );
    check(
      rightContact.maxPlayerRight <= geometry.expectedRight + 0.1 &&
        rightContact.maxPlayerRight >= geometry.expectedRight - 0.1,
      `${viewport.width}px player body keeps visual clearance from the right wall plane`
    );
    check(
      leftContact.minScreenLeft >= -0.1 &&
        rightContact.maxScreenRight <= geometry.viewportWidth + 0.1,
      `${viewport.width}px both wall contacts remain camera-visible`
    );
    if (geometry.mobile) {
      check(
        geometry.rail !== null,
        `${viewport.width}px mobile renders fixed left and right board rails`
      );
      check(
        (geometry.rail?.borderLeftWidth ?? 0) +
          (geometry.rail?.beforeWidth ?? 0) >=
          MIN_VISIBLE_PILLAR_DEPTH,
        `${viewport.width}px left board wall reads as a full pillar`
      );
      check(
        (geometry.rail?.borderRightWidth ?? 0) +
          (geometry.rail?.afterWidth ?? 0) >=
          MIN_VISIBLE_PILLAR_DEPTH,
        `${viewport.width}px right board wall reads as a full pillar`
      );
      check(
        Math.abs((geometry.rail?.left ?? -1) - 0) <= 0.1 &&
          Math.abs((geometry.rail?.right ?? -1) - geometry.viewportWidth) <=
            0.1,
        `${viewport.width}px board rails stay pinned to both viewport edges`
      );
      check(
        leftContact.minScreenLeft >=
          (geometry.rail?.borderLeftWidth ?? Number.POSITIVE_INFINITY) +
            (geometry.rail?.beforeWidth ?? 0) &&
          rightContact.maxScreenRight <=
            geometry.viewportWidth -
              ((geometry.rail?.borderRightWidth ?? Number.POSITIVE_INFINITY) +
                (geometry.rail?.afterWidth ?? 0)),
        `${viewport.width}px player stays fully inside both visible pillars`
      );
      check(
        (visualContacts?.left.visualLeft ?? Number.NEGATIVE_INFINITY) >=
          (visualContacts?.left.paintedLeftScreen ?? Number.POSITIVE_INFINITY) -
            0.1,
        `${viewport.width}px full falling artwork stays inside the left painted wall`
      );
      check(
        (visualContacts?.right.visualRight ?? Number.POSITIVE_INFINITY) <=
          (visualContacts?.right.paintedRightScreen ??
            Number.NEGATIVE_INFINITY) +
            0.1,
        `${viewport.width}px full falling artwork stays inside the right painted wall`
      );
      check(
        (visualContacts?.left.visualLeft ?? Number.NEGATIVE_INFINITY) >=
          (geometry.rail?.borderLeftWidth ?? Number.POSITIVE_INFINITY) +
            (geometry.rail?.beforeWidth ?? 0),
        `${viewport.width}px full falling artwork stays clear of the visible left pillar`
      );
      check(
        (visualContacts?.right.visualRight ?? Number.POSITIVE_INFINITY) <=
          geometry.viewportWidth -
            ((geometry.rail?.borderRightWidth ?? Number.NEGATIVE_INFINITY) +
              (geometry.rail?.afterWidth ?? 0)),
        `${viewport.width}px full falling artwork stays clear of the visible right pillar`
      );
    }
    await captureScreenshot(page, {
      path: path.join(outputDir, `world-bounds-${viewport.width}.png`),
    });
    await context.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    routeWidth: ROUTE_WIDTH,
    playableInset: PLAYABLE_INSET,
    mobileBreakpoint: MOBILE_BREAKPOINT,
    playerVisualEdgeClearance: PLAYER_VISUAL_EDGE_CLEARANCE,
    minimumVisiblePillarDepth: MIN_VISIBLE_PILLAR_DEPTH,
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
            screenLeft: player.x - halfWidth - camera.worldView.x,
            screenRight: player.x + halfWidth - camera.worldView.x,
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

async function measureVisualContact(page, side) {
  return page.evaluate(
    async ({ side, playableInset, routeWidth }) => {
      const scene = window.__fallstackFindScene();
      const player = scene.player;
      const body = player.body;
      const bounds = scene.physics.world.bounds;
      const canvas = document.querySelector('#game-canvas canvas');
      const x =
        side === 'left'
          ? bounds.left + body.halfWidth
          : bounds.right - body.halfWidth;

      scene.playerCeremony = null;
      scene.charging = false;
      scene.chargeTime = 0;
      scene.facing = side === 'left' ? -1 : 1;
      player.body.reset(x, player.y);
      player.body.setVelocity(0, 400);
      scene.playerVisualKey = '';
      scene.playerGraphics.setVisible(true);
      scene.drawPlayer();
      scene.snapCameraToPlayer();
      scene.scene.pause();

      const nextFrame = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      const capturePixels = () => {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        context.drawImage(canvas, 0, 0);
        return context.getImageData(0, 0, copy.width, copy.height).data;
      };

      await nextFrame();
      const visible = capturePixels();
      scene.playerGraphics.setVisible(false);
      await nextFrame();
      const hidden = capturePixels();
      scene.playerGraphics.setVisible(true);

      let left = canvas.width;
      let right = -1;
      let changedPixels = 0;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const index = (y * canvas.width + x) * 4;
          const difference =
            Math.abs(visible[index] - hidden[index]) +
            Math.abs(visible[index + 1] - hidden[index + 1]) +
            Math.abs(visible[index + 2] - hidden[index + 2]) +
            Math.abs(visible[index + 3] - hidden[index + 3]);
          if (difference <= 8) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          changedPixels += 1;
        }
      }

      const pixelToViewport = scene.viewportWidth() / canvas.width;
      const cameraWorldViewX = scene.cameras.main.worldView.x;
      return {
        changedPixels,
        visualLeft: left * pixelToViewport,
        visualRight: (right + 1) * pixelToViewport,
        paintedLeftScreen:
          scene.currentRouteOffset + playableInset - cameraWorldViewX,
        paintedRightScreen:
          scene.currentRouteOffset +
          routeWidth -
          playableInset -
          cameraWorldViewX,
      };
    },
    { side, playableInset: PLAYABLE_INSET, routeWidth: ROUTE_WIDTH }
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
