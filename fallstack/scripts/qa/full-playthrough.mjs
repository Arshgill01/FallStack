import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const options = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(options.output);
await mkdir(path.join(outputDir, 'screenshots'), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    ...(options.canvas ? ['--disable-webgl'] : []),
  ],
});
const context = await browser.newContext({
  viewport: { width: options.width, height: options.height },
  reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
  recordVideo: options.video
    ? { dir: path.join(outputDir, 'videos'), size: { width: options.width, height: options.height } }
    : undefined,
});
const page = await context.newPage();
const consoleEntries = [];
const pageErrors = [];
page.on('console', (message) => {
  consoleEntries.push({ type: message.type(), text: message.text() });
});
page.on('pageerror', (error) => pageErrors.push(String(error)));

await page.addInitScript(() => {
  window.__fallstackQaEvents = [];
  for (const name of [
    'ready',
    'charge',
    'launch',
    'land',
    'fall',
    'clear',
    'summit',
    'zone',
  ]) {
    window.addEventListener(`fallstack:${name}`, (event) => {
      window.__fallstackQaEvents.push({
        name,
        at: performance.now(),
        detail: event.detail ?? null,
      });
    });
  }
});

const startedAt = Date.now();
const landings = [];
const failures = [];
let completed = false;

try {
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__fallstackQaEvents?.some((event) => event.name === 'ready'), null, {
    timeout: 30_000,
  });
  await page.waitForTimeout(250);

  const initial = await readScene(page, true);
  const allPlatforms = initial.platforms;
  const platformById = new Map(allPlatforms.map((platform) => [platform.id, platform]));
  const route = allPlatforms
    .filter((platform) => platform.kind !== 'obstacle')
    .sort((a, b) => b.y - a.y);
  const routeIndex = new Map(route.map((platform, index) => [platform.id, index]));
  let targetIndex = Math.max(1, (routeIndex.get(initial.lastPlatformId) ?? 0) + 1);
  let lastRecordedPlatform = initial.lastPlatformId;
  let attemptsAtTarget = 0;
  const targetAttempts = new Map();
  let totalJumps = 0;
  let lastZone = initial.currentZone;

  await capture(page, outputDir, '00-opening');

  while (targetIndex < route.length && totalJumps < options.maxJumps) {
    const state = await waitForGrounded(page, 12_000);
    if (state.summitSent) {
      completed = true;
      break;
    }

    const landedIndex = routeIndex.get(state.lastPlatformId);
    if (landedIndex !== undefined && landedIndex + 1 > targetIndex) {
      targetIndex = landedIndex + 1;
      attemptsAtTarget = 0;
    } else if (landedIndex !== undefined && state.lastPlatformId !== lastRecordedPlatform) {
      targetIndex = Math.max(targetIndex, landedIndex + 1);
      attemptsAtTarget = 0;
    }
    lastRecordedPlatform = state.lastPlatformId;

    if (state.currentZone !== lastZone) {
      lastZone = state.currentZone;
      await capture(page, outputDir, `zone-${String(targetIndex).padStart(3, '0')}-${slug(lastZone)}`);
    }

    const target = route[targetIndex];
    if (!target) break;
    const current = currentSupport(allPlatforms, platformById, state);
    attemptsAtTarget = (targetAttempts.get(target.id) ?? 0) + 1;
    targetAttempts.set(target.id, attemptsAtTarget);
    totalJumps += 1;

    const blockers = blockingObstacles(allPlatforms, current, target);
    const result = await performJump(page, current, target, attemptsAtTarget, blockers);
    const after = await readScene(page, false);
    const afterIndex = routeIndex.get(after.lastPlatformId);
    const advanced = afterIndex !== undefined && afterIndex >= targetIndex;

    landings.push({
      jump: totalJumps,
      targetIndex,
      targetId: target.id,
      targetZone: target.zoneId,
      targetGeometry: pickGeometry(target),
      fromId: current?.id ?? state.lastPlatformId,
      fromGeometry: current ? pickGeometry(current) : null,
      attemptAtTarget: attemptsAtTarget,
      result,
      after: compactState(after),
      advanced,
    });

    if (after.summitSent) {
      completed = true;
      break;
    }
    if (advanced) {
      targetAttempts.delete(target.id);
      targetIndex = afterIndex + 1;
      attemptsAtTarget = 0;
    } else if (result.outcome === 'fall') {
      failures.push({
        jump: totalJumps,
        targetIndex,
        targetId: target.id,
        attemptAtTarget: attemptsAtTarget,
        state: compactState(after),
      });
      const recoveredIndex = routeIndex.get(after.lastPlatformId);
      targetIndex = Math.max(1, (recoveredIndex ?? checkpointRouteIndex(route, after.y)) + 1);
      attemptsAtTarget = 0;
    } else if (
      afterIndex !== undefined &&
      afterIndex < targetIndex &&
      afterIndex + 1 !== targetIndex
    ) {
      targetIndex = afterIndex + 1;
      attemptsAtTarget = 0;
    }

    if (attemptsAtTarget >= options.retries) {
      await capture(page, outputDir, `blocked-${String(targetIndex).padStart(3, '0')}`);
      throw new Error(`Could not clear ${target.id} after ${attemptsAtTarget} attempts`);
    }
  }

  const finalState = await readScene(page, false);
  completed ||= finalState.summitSent;
  await page.waitForTimeout(completed ? 750 : 100);
  await capture(page, outputDir, completed ? '99-summit' : '99-incomplete');

  const events = await page.evaluate(() => window.__fallstackQaEvents ?? []);
  const report = {
    generatedAt: new Date().toISOString(),
    url: options.url,
    viewport: { width: options.width, height: options.height },
    renderer: options.canvas ? 'canvas-for-mechanical-replay' : 'default',
    reducedMotion: options.reducedMotion,
    elapsedMs: Date.now() - startedAt,
    completed,
    routePlatforms: route.length,
    totalJumps,
    landingCount: landings.filter((landing) => landing.advanced).length,
    failureCount: failures.length,
    finalState: compactState(finalState),
    events,
    failures,
    landings,
    consoleEntries,
    pageErrors,
  };
  await writeFile(path.join(outputDir, 'playthrough.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    completed,
    routePlatforms: route.length,
    totalJumps,
    landingCount: report.landingCount,
    failureCount: failures.length,
    finalPlatform: finalState.lastPlatformId,
    currentZone: finalState.currentZone,
    elapsedMs: report.elapsedMs,
  }, null, 2)}\n`);

  if (!completed && options.requireSummit) process.exitCode = 1;
} catch (error) {
  const events = await page.evaluate(() => window.__fallstackQaEvents ?? []).catch(() => []);
  await writeFile(
    path.join(outputDir, 'failure.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      elapsedMs: Date.now() - startedAt,
      events,
      failures,
      landings,
      consoleEntries,
      pageErrors,
    }, null, 2)}\n`
  );
  await capture(page, outputDir, '99-failure').catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}

async function performJump(page, current, target, attempt, blockers) {
  const before = await readScene(page, false);
  const directDirection = target.x + target.width / 2 >= (current?.x ?? before.x) + (current?.width ?? 0) / 2 ? 1 : -1;
  const direction = chooseLaunchDirection(before, current, target, attempt);
  const wallBounce = direction !== directDirection;
  const desiredLaunchX = direction > 0
    ? target.x - 88 - Math.min(18, attempt * 3)
    : target.x + target.width + 88 + Math.min(18, attempt * 3);
  await positionOnSupport(page, current, desiredLaunchX);
  const setupState = await readScene(page, false);

  const launchArrow = direction > 0 ? 'ArrowRight' : 'ArrowLeft';
  const heldMs = chargeDuration(current, target, attempt, wallBounce);
  await page.keyboard.down(launchArrow);
  await page.keyboard.down('Space');
  await page.waitForTimeout(Math.min(20, heldMs));
  await page.keyboard.up(launchArrow);
  await page.waitForTimeout(Math.max(0, heldMs - 20));
  await page.keyboard.up('Space');
  const launchState = await readScene(page, false);

  let outcome = 'airborne';
  let peakY = before.y;
  let frames = 0;
  let activeArrow = null;
  let bounced = false;
  const started = performance.now();

  while (performance.now() - started < 4_000) {
    const state = await readScene(page, false);
    peakY = Math.min(peakY, state.y);
    if (state.summitSent) {
      outcome = 'summit';
      break;
    }
    if (state.attemptId !== before.attemptId) {
      outcome = 'fall';
      break;
    }
    if (frames > 2 && state.grounded) {
      outcome = state.lastPlatformId === target.id ? 'target' : 'landed';
      break;
    }

    if (wallBounce && state.vx * direction < -100) bounced = true;
    const requestedArrow = wallBounce && !bounced
      ? launchArrow
      : flightCorrection(state, target, direction);
    if (requestedArrow !== activeArrow) {
      if (activeArrow) await page.keyboard.up(activeArrow);
      if (requestedArrow) await page.keyboard.down(requestedArrow);
      activeArrow = requestedArrow;
    }
    frames += 1;
    await page.waitForTimeout(16);
  }
  if (activeArrow) await page.keyboard.up(activeArrow);
  await releaseControls(page);
  if (outcome === 'airborne') outcome = 'timeout';
  return {
    outcome,
    peakY,
    frames,
    direction,
    wallBounce,
    bounced,
    blockerIds: blockers.map((blocker) => blocker.id),
    setupState: compactState(setupState),
    launchState: compactState(launchState),
  };
}

async function positionOnSupport(page, support, desiredX) {
  if (!support) return;
  const minX = support.x + 15;
  const maxX = support.x + support.width - 15;
  const targetX = clamp(desiredX, minX, maxX);
  const deadline = performance.now() + 1_600;
  let activeArrow = null;
  while (performance.now() < deadline) {
    const state = await readScene(page, false);
    if (!state.grounded || Math.abs(state.x - targetX) <= 5) break;
    const nextArrow = state.x < targetX ? 'ArrowRight' : 'ArrowLeft';
    if (nextArrow !== activeArrow) {
      if (activeArrow) await page.keyboard.up(activeArrow);
      await page.keyboard.down(nextArrow);
      activeArrow = nextArrow;
    }
    await page.waitForTimeout(16);
  }
  if (activeArrow) await page.keyboard.up(activeArrow);
  const settleDeadline = performance.now() + 260;
  while (performance.now() < settleDeadline) {
    const state = await readScene(page, false);
    if (!state.grounded || Math.abs(state.vx) <= 16) break;
    await page.waitForTimeout(16);
  }
}

function flightCorrection(state, target, launchDirection) {
  const targetCenter = target.x + target.width / 2;
  const safeLandingX = target.x + target.width > 430
    ? target.x + 25
    : target.x < 50
      ? target.x + target.width - 25
      : targetCenter;
  const stillBelowTop = state.y + 15 > target.y;
  // Stay a full player-width plus margin outside a solid platform until the
  // climber is above its top. A four-pixel edge allowance made otherwise
  // valid checkpoint jumps timing-dependent on VM frame scheduling.
  const approachX = launchDirection > 0
    ? target.x - 28
    : target.x + target.width + 28;
  const landingX = stillBelowTop
    ? approachX
    : clamp(safeLandingX, target.x + 17, target.x + target.width - 17);
  const g = 1850;
  const deltaY = target.y - state.y;
  const discriminant = state.vy * state.vy + 2 * g * deltaY;
  const timeToHeight = discriminant >= 0
    ? stillBelowTop && state.vy < 0
      ? (-state.vy - Math.sqrt(discriminant)) / g
      : (-state.vy + Math.sqrt(discriminant)) / g
    : 0.18;
  const horizon = clamp(timeToHeight, 0.08, 0.9);
  const requiredVx = clamp((landingX - state.x) / horizon, -430, 430);
  const velocityError = requiredVx - state.vx;
  const positionError = landingX - state.x;
  const tolerance = stillBelowTop ? 10 : state.vy > 0 ? 18 : 28;

  if (Math.abs(positionError) <= tolerance && Math.abs(velocityError) < 55) return null;
  if (velocityError > 24) return 'ArrowRight';
  if (velocityError < -24) return 'ArrowLeft';
  return positionError > 0 ? 'ArrowRight' : 'ArrowLeft';
}

function chooseLaunchDirection(state, current, target, attempt) {
  const targetCenter = target.x + target.width / 2;
  const currentCenter = current ? current.x + current.width / 2 : state.x;
  if (Math.abs(targetCenter - currentCenter) > 18) {
    const direct = targetCenter > currentCenter ? 1 : -1;
    return attempt % 2 === 0 ? -direct : direct;
  }
  return attempt % 2 === 0 ? -1 : 1;
}

function chargeDuration(current, target, attempt, wallBounce) {
  const verticalGap = current ? current.y - target.y : 110;
  const base = verticalGap > 118 ? 90 : verticalGap > 108 ? 62 : 42;
  const adaptive = base + Math.min(90, Math.max(0, attempt - 1) * 18);
  return wallBounce ? Math.max(120, adaptive) : adaptive;
}

function blockingObstacles(platforms, current, target) {
  if (!current) return [];
  return platforms.filter((platform) =>
    platform.kind === 'obstacle' &&
    platform.y < current.y &&
    platform.y + platform.height > target.y &&
    platform.y < target.y + target.height
  );
}

async function waitForGrounded(page, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const state = await readScene(page, false);
    if (state.grounded) return state;
    await page.waitForTimeout(20);
  }
  throw new Error(`Player did not return to a grounded state within ${timeoutMs}ms`);
}

async function readScene(page, includePlatforms) {
  return page.evaluate((withPlatforms) => {
    function findGame() {
      const root = document.querySelector('#root');
      if (!root) return null;
      const containerKey = Object.keys(root).find((key) => key.startsWith('__reactContainer$'));
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
          if (candidate?.scene?.keys?.FallstackScene) return candidate;
          hook = hook.next;
        }
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      }
      return null;
    }

    const game = findGame();
    const scene = game?.scene?.keys?.FallstackScene;
    const player = scene?.player;
    if (!scene || !player?.body) throw new Error('Fallstack scene was not discoverable');
    return {
      x: player.x - scene.currentRouteOffset,
      y: player.y,
      vx: player.body.velocity.x,
      vy: player.body.velocity.y,
      grounded: Boolean(player.body.blocked.down || player.body.touching.down),
      lastPlatformId: scene.lastPlatformId,
      currentZone: scene.currentZone,
      respawnZone: scene.respawnZone,
      attemptId: scene.currentAttemptId,
      highestY: scene.highestY,
      summitSent: scene.summitSent,
      controlsReady: scene.controlsReady,
      ...(withPlatforms ? { platforms: scene.towerPlatforms } : {}),
    };
  }, includePlatforms);
}

function currentSupport(platforms, platformById, state) {
  const exact = platformById.get(state.lastPlatformId);
  if (exact) return exact;
  return platforms
    .filter((platform) => platform.y >= state.y && platform.y - state.y < 90)
    .sort((a, b) => a.y - b.y)[0] ?? null;
}

function checkpointRouteIndex(route, playerY) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < route.length; index += 1) {
    const distance = Math.abs(route[index].y - playerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

async function releaseControls(page) {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Space']) {
    await page.keyboard.up(key).catch(() => {});
  }
}

async function capture(page, outputDir, name) {
  await page.screenshot({
    path: path.join(outputDir, 'screenshots', `${name}.png`),
    animations: 'disabled',
  });
}

function compactState(state) {
  return {
    x: round(state.x),
    y: round(state.y),
    vx: round(state.vx),
    vy: round(state.vy),
    grounded: state.grounded,
    lastPlatformId: state.lastPlatformId,
    currentZone: state.currentZone,
    respawnZone: state.respawnZone,
    highestY: round(state.highestY),
    summitSent: state.summitSent,
  };
}

function pickGeometry(platform) {
  return {
    x: round(platform.x),
    y: round(platform.y),
    width: round(platform.width),
    height: round(platform.height),
  };
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) continue;
    const [key, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) values.set(key, inline);
    else if (args[index + 1] && !args[index + 1].startsWith('--')) values.set(key, args[++index]);
    else values.set(key, 'true');
  }
  return {
    url: values.get('url') ?? 'http://127.0.0.1:8080/game.html',
    output: values.get('output') ?? 'docs/qa/final-pass/full-playthrough',
    width: numberOption(values, 'width', 375),
    height: numberOption(values, 'height', 812),
    maxJumps: numberOption(values, 'max-jumps', 1_500),
    retries: numberOption(values, 'retries', 8),
    canvas: values.get('canvas') !== 'false',
    reducedMotion: values.get('reduced-motion') === 'true',
    video: values.get('video') === 'true',
    requireSummit: values.get('require-summit') !== 'false',
  };
}

function numberOption(values, key, fallback) {
  const parsed = Number(values.get(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
