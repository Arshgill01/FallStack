import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/ui-overlays'
);
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
];
const states = ['message', 'receipt', 'checkpoint', 'remote', 'combined'];
const results = [];
const failures = [];
let checkCount = 0;

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    await installSceneProbe(context);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:8080/game.html', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => window.__fallstackFindScene?.()?.controlsReady,
      null,
      { timeout: 30_000 }
    );
    await installOverlayFixtures(page);

    const viewportResult = { viewport, states: {} };
    for (const state of states) {
      await showState(page, state);
      const geometry = await measureRouteGeometry(page);
      viewportResult.states[state] = geometry;

      for (const sample of geometry.samples) {
        check(
          sample.overlayTargetOverlap === 0,
          `${label(viewport)} ${state} does not cover ${sample.targetId}`
        );
        check(
          sample.overlayPlayerOverlap === 0,
          `${label(viewport)} ${state} does not cover the player at ${sample.supportId}`
        );
      }
      check(
        geometry.overlays.every(
          (overlay) =>
            overlay.left >= geometry.tower.left &&
            overlay.right <= geometry.tower.right &&
            overlay.top >= geometry.tower.top &&
            overlay.bottom <= geometry.tower.bottom
        ),
        `${label(viewport)} ${state} stays inside the tower viewport`
      );
      check(
        geometry.overlayOverlap === 0,
        `${label(viewport)} ${state} notices do not cover one another`
      );
    }

    const landingFraming = await measureLandingFraming(page);
    viewportResult.landingFraming = landingFraming;
    for (const sample of landingFraming.samples) {
      check(
        sample.nextLandingTop >= landingFraming.safeTop,
        `${label(viewport)} landing on ${sample.landingId} keeps ${sample.nextLandingId} below the HUD`
      );
    }

    await showState(page, 'receipt');
    const receiptTypography = await page.evaluate(() => {
      const copy = document.querySelector('.receipt-copy');
      const site = document.querySelector('.receipt-site');
      const counter = document.querySelector('.receipt-proof strong');
      const banner = document.querySelector('.mutation-banner.receipt');
      const copyStyle = getComputedStyle(copy);
      const counterStyle = getComputedStyle(counter);
      return {
        bannerHeight: banner.getBoundingClientRect().height,
        copyFontSize: Number.parseFloat(copyStyle.fontSize),
        copyLineHeight: Number.parseFloat(copyStyle.lineHeight),
        copyClientHeight: copy.clientHeight,
        copyScrollHeight: copy.scrollHeight,
        siteClientWidth: site.clientWidth,
        siteScrollWidth: site.scrollWidth,
        counterContrast: contrastRatio(
          counterStyle.color,
          getComputedStyle(banner).backgroundColor
        ),
      };

      function contrastRatio(foreground, background) {
        const luminance = (value) => {
          const channels = value
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map((channel) => Number(channel) / 255)
            .map((channel) =>
              channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4
            );
          return (
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2]
          );
        };
        const foregroundLuminance = luminance(foreground);
        const backgroundLuminance = luminance(background);
        return (
          (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
        );
      }
    });
    viewportResult.receiptTypography = receiptTypography;
    check(
      receiptTypography.copyFontSize >= 13,
      `${label(viewport)} receipt explanation stays at least 13px`
    );
    check(
      receiptTypography.bannerHeight <= (viewport.width < 375 ? 116 : 180),
      `${label(viewport)} receipt height stays within its short-screen budget`
    );
    check(
      receiptTypography.counterContrast >= 4.5,
      `${label(viewport)} receipt counter meets 4.5:1 text contrast`
    );

    await placeAtFirstCheckpoint(page);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(
        outputDir,
        `receipt-${viewport.width}x${viewport.height}.png`
      ),
      fullPage: true,
    });

    results.push(viewportResult);
    await context.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    viewports,
    states,
    checkCount,
    results,
    failures,
  };
  await writeFile(
    path.join(outputDir, 'ui-overlays.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        checks: checkCount,
        failures,
      },
      null,
      2
    )}\n`
  );
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

async function installOverlayFixtures(page) {
  await page.evaluate(() => {
    window.__fallstackFindScene().scene.pause();
    const tower = document.querySelector('.tower-wrap');
    const remote = document.createElement('div');
    remote.dataset.qaOverlay = 'remote';
    remote.className = 'hud-overlay remote-beat';
    remote.setAttribute('role', 'status');
    remote.innerHTML =
      '<span>REMOTE · BOARD r999</span>A distant clean clear reinforced the longest named route site.';
    tower.append(remote);
  });
}

async function showState(page, state) {
  await page.evaluate((nextState) => {
    const mutation = document.querySelector('.mutation-banner');
    const checkpoint = document.querySelector('.checkpoint-banner');
    const remote = document.querySelector('[data-qa-overlay="remote"]');
    mutation.className = 'hud-overlay mutation-banner';
    mutation.replaceChildren();
    checkpoint.classList.remove('visible');
    remote.className = 'hud-overlay remote-beat';
    remote.style.display = 'none';

    const showReceipt = () => {
      mutation.className = 'hud-overlay mutation-banner receipt visible';
      mutation.innerHTML = [
        '<div class="receipt-stamp">',
        '<span>NOT COUNTED · UNAVAILABLE</span>',
        '<span>BOARD r999 · UNCHANGED</span>',
        '</div>',
        '<div class="receipt-proof">',
        '<span class="receipt-site">Event Horizon Crown Approach<small>HELPER SLIPS</small></span>',
        '<strong>999 · UNCHANGED</strong>',
        '</div>',
        '<div class="receipt-copy">',
        'The shared tower did not answer. This contribution stayed unchanged and can be tried again later.',
        '</div>',
      ].join('');
    };

    if (nextState === 'message') {
      mutation.classList.add('visible');
      mutation.textContent =
        'Your fall was noticed. The shared tower did not answer, so this climb is continuing locally.';
    } else if (nextState === 'receipt') {
      showReceipt();
    } else if (nextState === 'checkpoint') {
      checkpoint.classList.add('visible');
      checkpoint.innerHTML = [
        '<div class="checkpoint-title">Checkpoint restored · Event Horizon Crown</div>',
        '<div class="checkpoint-sub">Saved to your Reddit account for today.</div>',
      ].join('');
    } else if (nextState === 'remote') {
      remote.style.removeProperty('display');
    } else if (nextState === 'combined') {
      showReceipt();
      remote.classList.add('below-receipt');
      remote.style.removeProperty('display');
    }
  }, state);
  await page.waitForTimeout(300);
}

async function measureRouteGeometry(page) {
  return page.evaluate(async () => {
    const scene = window.__fallstackFindScene();
    const canvas = document.querySelector('#game-canvas canvas');
    const tower = document.querySelector('.tower-wrap').getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / scene.scale.width;
    const scaleY = canvasRect.height / scene.scale.height;
    const route = scene.towerPlatforms
      .filter((platform) => !platform.id.startsWith('obstacle-'))
      .sort((left, right) => right.y - left.y);
    const supportIndices = route
      .map((platform, index) => ({ platform, index }))
      .filter(({ index }) => index < route.length - 1);
    const samples = [];
    let overlays = [];
    let overlayOverlap = 0;

    for (const { platform, index } of supportIndices) {
      const support = scene.layoutPlatform(platform);
      const target = scene.layoutPlatform(route[index + 1]);
      scene.player.body.reset(
        support.x + support.width / 2,
        support.y - scene.player.body.halfHeight - 1
      );
      scene.lastPlatformId = platform.id;
      scene.snapCameraToPlayer();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const mutation = document.querySelector('.mutation-banner.visible');
      const remote = document.querySelector('[data-qa-overlay="remote"]');
      const companionHeight =
        mutation?.classList.contains('receipt') &&
        remote &&
        getComputedStyle(remote).display !== 'none'
          ? remote.getBoundingClientRect().height
          : 0;
      const placement = mutation
        ? scene.hudNoticePlacement(
            mutation.getBoundingClientRect().height,
            companionHeight
          )
        : 'top';
      mutation?.classList.toggle('place-bottom', placement === 'bottom');
      mutation?.classList.toggle('place-top', placement === 'top');
      remote?.classList.toggle(
        'below-receipt',
        Boolean(mutation?.classList.contains('receipt')) && placement === 'top'
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const overlayElements = [
        mutation,
        document.querySelector('.checkpoint-banner.visible'),
        remote,
      ].filter(
        (element) =>
          element &&
          getComputedStyle(element).display !== 'none' &&
          getComputedStyle(element).visibility !== 'hidden'
      );
      const sampleOverlays = overlayElements.map(rectOf);
      overlays = sampleOverlays;
      if (sampleOverlays.length === 2) {
        overlayOverlap = Math.max(
          overlayOverlap,
          overlapArea(sampleOverlays[0], sampleOverlays[1])
        );
      }
      const camera = scene.cameras.main;
      const playerRect = {
        left:
          canvasRect.left +
          (scene.player.x -
            scene.player.body.halfWidth -
            camera.scrollX) *
            scaleX,
        right:
          canvasRect.left +
          (scene.player.x +
            scene.player.body.halfWidth -
            camera.scrollX) *
            scaleX,
        top:
          canvasRect.top +
          (scene.player.y -
            scene.player.body.halfHeight -
            camera.scrollY) *
            scaleY,
        bottom:
          canvasRect.top +
          (scene.player.y +
            scene.player.body.halfHeight -
            camera.scrollY) *
            scaleY,
      };
      const targetRect = {
        left: canvasRect.left + (target.x - camera.scrollX) * scaleX,
        right:
          canvasRect.left +
          (target.x + target.width - camera.scrollX) * scaleX,
        top: canvasRect.top + (target.y - camera.scrollY) * scaleY,
        bottom:
          canvasRect.top +
          (target.y + target.height - camera.scrollY) * scaleY,
      };
      samples.push({
        supportId: support.id,
        targetId: target.id,
        playerRect,
        targetRect,
        placement,
        overlayPlayerOverlap: sampleOverlays.reduce(
          (total, overlay) => total + overlapArea(overlay, playerRect),
          0
        ),
        overlayTargetOverlap: sampleOverlays.reduce(
          (total, overlay) => total + overlapArea(overlay, targetRect),
          0
        ),
      });
    }

    return {
      tower: {
        left: tower.left,
        right: tower.right,
        top: tower.top,
        bottom: tower.bottom,
      },
      overlays,
      overlayOverlap,
      samples,
    };

    function rectOf(element) {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }

    function overlapArea(left, right) {
      return (
        Math.max(
          0,
          Math.min(left.right, right.right) -
            Math.max(left.left, right.left)
        ) *
        Math.max(
          0,
          Math.min(left.bottom, right.bottom) -
            Math.max(left.top, right.top)
        )
      );
    }
  });
}

async function measureLandingFraming(page) {
  return page.evaluate(async () => {
    const scene = window.__fallstackFindScene();
    const canvas = document.querySelector('#game-canvas canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const scaleY = canvasRect.height / scene.scale.height;
    const zoneTag = document.querySelector('.zone-tag').getBoundingClientRect();
    const safeTop = zoneTag.bottom + 12;
    const route = scene.towerPlatforms
      .filter((platform) => !platform.id.startsWith('obstacle-'))
      .sort((left, right) => right.y - left.y);
    const samples = [];

    for (let index = 1; index < route.length - 1; index += 1) {
      const takeoff = scene.layoutPlatform(route[index - 1]);
      const landing = scene.layoutPlatform(route[index]);
      const nextLanding = scene.layoutPlatform(route[index + 1]);
      scene.player.body.reset(
        takeoff.x + takeoff.width / 2,
        takeoff.y - scene.player.body.halfHeight - 1
      );
      scene.snapCameraToPlayer();
      scene.player.body.reset(
        landing.x + landing.width / 2,
        landing.y - scene.player.body.halfHeight - 1
      );
      scene.lastPlatformId = landing.id;
      scene.player.body.setVelocity(0, 0);
      scene.settleVerticalCameraForLanding();
      scene.updateCamera(16);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push({
        landingId: landing.id,
        nextLandingId: nextLanding.id,
        nextLandingTop:
          canvasRect.top +
          (nextLanding.y - scene.cameras.main.scrollY) * scaleY,
      });
    }

    return { safeTop, samples };
  });
}

async function placeAtFirstCheckpoint(page) {
  await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const platform = scene.towerPlatforms.find((candidate) =>
      candidate.id.includes('checkpoint')
    );
    const support = scene.layoutPlatform(platform);
    scene.currentZone = platform.zoneId;
    scene.rebuildPlatformBodies();
    scene.drawWorld();
    scene.rebuildArtifactBodies();
    scene.player.body.reset(
      support.x + support.width / 2,
      support.y - scene.player.body.halfHeight - 1
    );
    scene.snapCameraToPlayer();
    scene.drawPlayer();
    const mutation = document.querySelector('.mutation-banner.visible');
    if (mutation) {
      const placement = scene.hudNoticePlacement(
        mutation.getBoundingClientRect().height
      );
      mutation.classList.toggle('place-bottom', placement === 'bottom');
      mutation.classList.toggle('place-top', placement === 'top');
    }
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

function check(condition, message) {
  checkCount += 1;
  if (!condition) failures.push(message);
}

function label(viewport) {
  return `${viewport.width}x${viewport.height}`;
}
