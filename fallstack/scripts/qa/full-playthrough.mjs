import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createBoardApiMock } from './lib/board-api-mock.mjs';
import { captureScreenshot } from './capture-screenshot.mjs';

const options = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(options.output);
await mkdir(path.join(outputDir, 'screenshots'), { recursive: true });

const browserType = { chromium, webkit }[options.browser];
if (!browserType) throw new Error(`Unsupported browser: ${options.browser}`);
const browser = await browserType.launch({
  headless: true,
  ...(options.browser === 'chromium'
    ? {
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--mute-audio',
          ...(options.canvas ? ['--disable-webgl'] : []),
        ],
      }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: options.width, height: options.height },
  deviceScaleFactor: options.deviceScaleFactor,
  isMobile: options.mobile,
  hasTouch: options.mobile,
  reducedMotion: options.reducedMotion ? 'reduce' : 'no-preference',
  recordVideo: options.video
    ? {
        dir: path.join(outputDir, 'videos'),
        size: { width: options.width, height: options.height },
      }
    : undefined,
});
await context.addInitScript(() => {
  localStorage.setItem('fallstack:gameplay-muted', 'true');
  localStorage.setItem('fallstack:music-muted', 'true');
});
const boardApi = options.mockApi
  ? createBoardApiMock({ remoteFallIntervalMs: options.remoteFallMs })
  : null;
if (boardApi) await context.route('**/api/**', (route) => boardApi.handle(route));
await context.addInitScript(() => {
  // Frame clock and camera position for hitch and jolt detection, sampled
  // independently of the bot's polling.
  window.__fallstackFrames = [];
  window.__fallstackCameraY = [];
  let scene = null;
  const tick = (now) => {
    window.__fallstackFrames.push(now);
    if (!scene && window.__fallstackFrames.length % 30 === 0)
      scene = window.__fallstackPipelineScene?.() ?? null;
    // Camera top in CSS pixels, so per-frame jumps read as on-screen motion.
    const view = scene?.cameras?.main?.worldView;
    const canvas = scene?.game?.canvas;
    window.__fallstackCameraY.push(
      view && canvas
        ? (view.y * canvas.getBoundingClientRect().height) / view.height
        : null
    );
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const page = await context.newPage();
if (options.cpuThrottle > 1 && options.browser === 'chromium') {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: options.cpuThrottle });
}
const pointerDriver =
  options.input === 'touch'
    ? await createPointerDriver(context, page, options.browser)
    : null;
const consoleEntries = [];
const pageErrors = [];
page.on('console', (message) => {
  consoleEntries.push({ type: message.type(), text: message.text() });
});
page.on('pageerror', (error) => pageErrors.push(String(error)));

if (options.resumeZone) {
  await page.addInitScript((zoneId) => {
    const dateKey = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`fallstack:practice-resume:${dateKey}:v1`, zoneId);
  }, options.resumeZone);
}

await page.addInitScript(() => {
  window.__fallstackPipelineScene = () => {
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
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const scene = hook.memoizedState?.current?.scene?.keys?.FallstackScene;
        if (scene) return scene;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  };
  localStorage.setItem('fallstack:gameplay-muted', 'true');
  localStorage.setItem('fallstack:music-muted', 'true');
  window.__fallstackQaEvents = [];
  window.__fallstackQaPointerTypes = [];
  window.__fallstackQaGameplayStarted = false;
  window.addEventListener('pointerdown', (event) => {
    window.__fallstackQaPointerTypes.push(event.pointerType);
  });
  window.__fallstackQaVisibility = {
    samples: 0,
    failures: [],
    cameraJumps: [],
    noticeSamples: 0,
    noticeFailures: [],
    slowFrames: 0,
    maxFrameMs: 0,
  };
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

  let lastFrameAt = performance.now();
  let lastCamera = null;
  const findScene = () => {
    const cached = window.__fallstackQaScene;
    if (cached?.sys && !cached.sys.isDestroyed?.()) return cached;
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
        if (scene) {
          window.__fallstackQaScene = scene;
          return scene;
        }
        hook = hook.next;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  };
  const sample = (now) => {
    const metrics = window.__fallstackQaVisibility;
    const frameMs = now - lastFrameAt;
    lastFrameAt = now;
    metrics.samples += 1;
    metrics.maxFrameMs = Math.max(metrics.maxFrameMs, frameMs);
    if (frameMs > 34) metrics.slowFrames += 1;

    const scene = findScene();
    const player = scene?.player;
    const camera = scene?.cameras?.main;
    if (scene?.controlsReady && player?.body && camera?.worldView) {
      const worldView = camera.worldView;
      const visualHalfWidth = player.body.halfWidth + 12;
      const left = player.x - visualHalfWidth;
      const right = player.x + visualHalfWidth;
      if (left < worldView.x - 0.5 || right > worldView.right + 0.5) {
        if (metrics.failures.length < 100) {
          metrics.failures.push({
            at: now,
            attemptId: scene.currentAttemptId,
            playerX: player.x,
            playerVisual: [left, right],
            worldView: [worldView.x, worldView.right],
            cameraScrollX: camera.scrollX,
            renderScale: scene.renderScale,
          });
        }
      }

      const notices = Array.from(
        document.querySelectorAll(
          '.mutation-banner.visible, .checkpoint-banner.visible, .remote-beat'
        )
      ).filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) > 0
        );
      });
      if (notices.length > 0) {
        const canvas = document.querySelector('#game-canvas canvas');
        const canvasRect = canvas?.getBoundingClientRect();
        if (canvasRect && worldView.width > 0 && worldView.height > 0) {
          metrics.noticeSamples += 1;
          const scaleX = canvasRect.width / worldView.width;
          const scaleY = canvasRect.height / worldView.height;
          const playerRect = {
            left:
              canvasRect.left +
              (player.x - player.body.halfWidth - worldView.x) * scaleX,
            right:
              canvasRect.left +
              (player.x + player.body.halfWidth - worldView.x) * scaleX,
            top:
              canvasRect.top +
              (player.y - player.body.halfHeight - worldView.y) * scaleY,
            bottom:
              canvasRect.top +
              (player.y + player.body.halfHeight - worldView.y) * scaleY,
          };
          const nextLanding = scene.nextRoutePlatform?.();
          const layoutLanding = nextLanding
            ? scene.layoutPlatform(nextLanding)
            : null;
          const targetRect = layoutLanding
            ? {
                left:
                  canvasRect.left + (layoutLanding.x - worldView.x) * scaleX,
                right:
                  canvasRect.left +
                  (layoutLanding.x + layoutLanding.width - worldView.x) *
                    scaleX,
                top: canvasRect.top + (layoutLanding.y - worldView.y) * scaleY,
                bottom:
                  canvasRect.top +
                  (layoutLanding.y + layoutLanding.height - worldView.y) *
                    scaleY,
              }
            : null;
          const controls = Array.from(
            document.querySelectorAll('.touch-controls button')
          ).map((element) => rectOf(element.getBoundingClientRect()));

          for (const notice of notices) {
            const noticeRect = rectOf(notice.getBoundingClientRect());
            const playerOverlap = overlapArea(noticeRect, playerRect);
            const targetOverlap = targetRect
              ? overlapArea(noticeRect, targetRect)
              : 0;
            const controlOverlap = controls.reduce(
              (total, control) => total + overlapArea(noticeRect, control),
              0
            );
            if (
              (playerOverlap > 0 || targetOverlap > 0 || controlOverlap > 0) &&
              metrics.noticeFailures.length < 100
            ) {
              metrics.noticeFailures.push({
                at: now,
                attemptId: scene.currentAttemptId,
                className: notice.className,
                text: notice.textContent?.trim().slice(0, 160) ?? '',
                playerOverlap,
                targetOverlap,
                controlOverlap,
                noticeRect,
                playerRect,
                targetRect,
              });
            }
          }
        }
      }

      if (
        window.__fallstackQaGameplayStarted &&
        lastCamera &&
        lastCamera.attemptId === scene.currentAttemptId
      ) {
        const jumpX = Math.abs(worldView.x - lastCamera.x);
        const jumpY = Math.abs(worldView.y - lastCamera.y);
        const playerDeltaX = Math.abs(player.x - lastCamera.playerX);
        const playerDeltaY = Math.abs(player.y - lastCamera.playerY);
        const velocityTravelX =
          Math.max(
            Math.abs(player.body.velocity.x),
            Math.abs(lastCamera.velocityX)
          ) *
          (frameMs / 1_000);
        const velocityTravelY =
          Math.max(
            Math.abs(player.body.velocity.y),
            Math.abs(lastCamera.velocityY)
          ) *
          (frameMs / 1_000);
        const allowedX = Math.max(24, playerDeltaX + 16, velocityTravelX + 16);
        const allowedY = Math.max(24, playerDeltaY + 16, velocityTravelY + 16);
        if (
          (jumpX > allowedX || jumpY > allowedY) &&
          metrics.cameraJumps.length < 100
        ) {
          metrics.cameraJumps.push({
            at: now,
            frameMs,
            attemptId: scene.currentAttemptId,
            delta: [jumpX, jumpY],
            allowed: [allowedX, allowedY],
            from: [lastCamera.x, lastCamera.y],
            to: [worldView.x, worldView.y],
            player: [player.x, player.y],
            playerDelta: [playerDeltaX, playerDeltaY],
          });
        }
      }
      lastCamera = {
        x: worldView.x,
        y: worldView.y,
        playerX: player.x,
        playerY: player.y,
        velocityX: player.body.velocity.x,
        velocityY: player.body.velocity.y,
        attemptId: scene.currentAttemptId,
      };
    }
    requestAnimationFrame(sample);
  };
  const rectOf = (rect) => ({
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
  });
  const overlapArea = (left, right) =>
    Math.max(
      0,
      Math.min(left.right, right.right) - Math.max(left.left, right.left)
    ) *
    Math.max(
      0,
      Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)
    );
  requestAnimationFrame(sample);
});

const startedAt = Date.now();
const landings = [];
const failures = [];
const framingFailures = [];
const visibilityFailures = [];
const targetVisibilityFailures = [];
let completed = false;

try {
  await page.goto(options.url, { waitUntil: 'domcontentloaded' });
  if (options.boardOnly) {
    await page.addStyleTag({
      content: `
        html, body, #root, .game-shell {
          width: 100vw !important;
          height: 100vh !important;
          margin: 0 !important;
          overflow: hidden !important;
          background: #171426 !important;
        }
        .topbar, .touch-controls, .hud-overlay, .charge-bar,
        .loading-overlay, .result-backdrop {
          display: none !important;
        }
        .tower-wrap {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
        }
      `,
    });
  }
  await page.waitForFunction(
    () => window.__fallstackQaEvents?.some((event) => event.name === 'ready'),
    null,
    {
      timeout: 30_000,
    }
  );
  await page.waitForTimeout(250);
  const resumeCheck = options.resumeZone
    ? await validateRestoredCheckpoint(page, options.resumeZone)
    : null;

  const initial = await readScene(page, true);
  recordVisibility(initial, 'opening');
  const allPlatforms = initial.platforms;
  const platformById = new Map(
    allPlatforms.map((platform) => [platform.id, platform])
  );
  const route = allPlatforms
    .filter((platform) => platform.kind !== 'obstacle')
    .sort((a, b) => b.y - a.y);
  const routeIndex = new Map(
    route.map((platform, index) => [platform.id, index])
  );
  const initialSupport = currentSupport(allPlatforms, platformById, initial);
  let targetIndex = Math.max(
    1,
    (routeIndex.get(initialSupport?.id ?? initial.lastPlatformId) ?? 0) + 1
  );
  const targetAttempts = new Map();
  const approachAttempts = new Map();
  const successfulApproaches = new Map();
  let totalJumps = 0;
  let lastZone = initial.currentZone;

  if (options.progress)
    process.stderr.write(
      `[playthrough] zone=${lastZone} jumps=0 target=${targetIndex}\n`
    );

  await capture(page, outputDir, '00-opening');
  await page.evaluate(() => {
    window.__fallstackQaGameplayStarted = true;
  });
  const introFall = options.introFall ? await performIntroFall(page) : null;

  while (targetIndex < route.length && totalJumps < options.maxJumps) {
    const state = await waitForGrounded(page, 12_000);
    recordVisibility(state, `grounded-before-${totalJumps + 1}`);
    if (state.summitSent) {
      completed = true;
      break;
    }

    const current = currentSupport(allPlatforms, platformById, state);
    const landedIndex = routeProgressIndex(route, routeIndex, current);
    if (landedIndex !== undefined && landedIndex + 1 !== targetIndex) {
      targetIndex = landedIndex + 1;
    }

    if (state.currentZone !== lastZone) {
      lastZone = state.currentZone;
      if (options.progress)
        process.stderr.write(
          `[playthrough] zone=${lastZone} jumps=${totalJumps} target=${targetIndex}\n`
        );
      await capture(
        page,
        outputDir,
        `zone-${String(targetIndex).padStart(3, '0')}-${slug(lastZone)}`
      );
    }

    const target = route[targetIndex];
    if (!target) break;
    const attemptAtTarget = (targetAttempts.get(target.id) ?? 0) + 1;
    targetAttempts.set(target.id, attemptAtTarget);
    const approachKey = `${current?.id ?? state.lastPlatformId}->${target.id}`;
    const approachTrial = (approachAttempts.get(approachKey) ?? 0) + 1;
    approachAttempts.set(approachKey, approachTrial);
    const approachAttempt =
      successfulApproaches.get(approachKey) ?? approachTrial;
    totalJumps += 1;

    const blockers = blockingObstacles(allPlatforms, current, target);
    const result = await performJump(
      page,
      current,
      target,
      approachAttempt,
      blockers
    );
    const after =
      result.outcome === 'fall'
        ? await waitForGrounded(page, 8_000)
        : await readScene(page, false);
    recordVisibility(after, `grounded-after-${totalJumps}`);
    const afterSupport = currentSupport(allPlatforms, platformById, after);
    const afterIndex = routeProgressIndex(route, routeIndex, afterSupport);
    const advanced = afterIndex !== undefined && afterIndex >= targetIndex;
    const nextPlatform =
      advanced && afterIndex !== undefined ? route[afterIndex + 1] : null;
    // Judge framing once the camera has come to rest after touchdown.
    if (nextPlatform) await waitForCameraSettle(page);
    const framing = nextPlatform
      ? await readLandingFraming(page, nextPlatform)
      : null;
    if (framing && framing.nextPlatformTop < framing.safeTop) {
      framingFailures.push({
        jump: totalJumps,
        landedOn: afterSupport?.id ?? null,
        nextPlatform: nextPlatform.id,
        ...framing,
      });
    }

    landings.push({
      jump: totalJumps,
      targetIndex,
      targetId: target.id,
      targetZone: target.zoneId,
      targetGeometry: pickGeometry(target),
      fromId: current?.id ?? state.lastPlatformId,
      fromGeometry: current ? pickGeometry(current) : null,
      attemptAtTarget,
      approachAttempt,
      result,
      after: compactState(after),
      afterSupportId: afterSupport?.id ?? null,
      advanced,
      framing,
    });

    if (after.summitSent) {
      completed = true;
      break;
    }
    if (!advanced && attemptAtTarget >= options.retries) {
      await capture(
        page,
        outputDir,
        `blocked-${String(targetIndex).padStart(3, '0')}`
      );
      throw new Error(
        `Could not clear ${target.id} after ${attemptAtTarget} attempts`
      );
    }
    if (advanced) {
      successfulApproaches.set(approachKey, approachAttempt);
      targetAttempts.delete(target.id);
      targetIndex = afterIndex + 1;
    } else if (result.outcome === 'fall') {
      failures.push({
        jump: totalJumps,
        targetIndex,
        targetId: target.id,
        attemptAtTarget,
        state: compactState(after),
      });
      const recoveredIndex = routeProgressIndex(
        route,
        routeIndex,
        afterSupport
      );
      targetIndex = Math.max(
        1,
        (recoveredIndex ?? checkpointRouteIndex(route, after.y)) + 1
      );
    } else if (
      afterIndex !== undefined &&
      afterIndex < targetIndex &&
      afterIndex + 1 !== targetIndex
    ) {
      targetIndex = afterIndex + 1;
    }
  }

  const finalState = await readScene(page, false);
  completed ||= finalState.summitSent;
  if (options.finalScreenshot) {
    await page.waitForTimeout(completed ? 750 : 100);
    await capture(page, outputDir, completed ? '99-summit' : '99-incomplete');
  }

  const events = await page.evaluate(() => window.__fallstackQaEvents ?? []);
  const frames = await page.evaluate(() => window.__fallstackFrames ?? []);
  const cameraY = await page.evaluate(() => window.__fallstackCameraY ?? []);
  const frameStats = summarizeFrames(frames, cameraY, events, options.hitchMs);
  boardApi?.stop();
  const pointerTypes = await page.evaluate(
    () => window.__fallstackQaPointerTypes ?? []
  );
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector('#game-canvas canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return 'unavailable';
    if (canvas.getContext('2d')) return 'canvas2d';
    if (canvas.getContext('webgl2')) return 'webgl2';
    if (canvas.getContext('webgl')) return 'webgl';
    return 'unknown';
  });
  const visibility = await page.evaluate(
    () => window.__fallstackQaVisibility ?? null
  );
  const fallEvents = events.filter((event) => event.name === 'fall');
  const routeFallEventCount = Math.max(
    0,
    fallEvents.length - (introFall ? 1 : 0)
  );
  const progressCount = landings.filter((landing) => landing.advanced).length;
  const landingOutcomeCount = landings.filter(
    (landing) => landing.result.outcome !== 'fall'
  ).length;
  const progressingFallCount = landings.filter(
    (landing) => landing.advanced && landing.result.outcome === 'fall'
  ).length;
  const unexpectedCameraJumps = (visibility?.cameraJumps ?? []).filter(
    (jump) =>
      !fallEvents.some(
        (event) => jump.at >= event.at && jump.at - event.at <= 250
      )
  );
  const expectedPageErrors = pageErrors.filter(
    (message) =>
      options.directDevvitAsset &&
      [
        'Error: no bridge context',
        'Uncaught Error: no bridge context',
      ].includes(message)
  );
  const unexpectedPageErrors = pageErrors.filter(
    (message) => !expectedPageErrors.includes(message)
  );
  const report = {
    generatedAt: new Date().toISOString(),
    buildId: await page.evaluate(() => window.fallstackBuildId ?? null),
    url: options.url,
    browser: options.browser,
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: options.deviceScaleFactor,
    mobile: options.mobile,
    input: options.input,
    renderer,
    webglDisabledAtLaunch: options.canvas,
    screenshotsEnabled: options.screenshots,
    finalScreenshotRequested: options.finalScreenshot,
    reducedMotion: options.reducedMotion,
    requestedResumeZone: options.resumeZone,
    elapsedMs: Date.now() - startedAt,
    completed,
    routePlatforms: route.length,
    totalJumps,
    landingCount: landingOutcomeCount,
    progressCount,
    progressingFallCount,
    nonProgressingFallCount: failures.length,
    failureCount: failures.length,
    fallEventCount: fallEvents.length,
    routeFallEventCount,
    framingFailureCount: framingFailures.length,
    visibilityFailureCount: visibilityFailures.length,
    targetVisibilityFailureCount: targetVisibilityFailures.length,
    cpuThrottle: options.cpuThrottle,
    mockApi: boardApi ? { remoteFallMs: options.remoteFallMs, ...boardApi.stats } : null,
    frameStats,
    unexpectedCameraJumpCount: unexpectedCameraJumps.length,
    finalState: compactState(finalState),
    introFall,
    resumeCheck,
    events,
    pointerTypes: [...new Set(pointerTypes)],
    pointerDownCount: pointerTypes.length,
    visibility,
    unexpectedCameraJumps,
    failures,
    framingFailures,
    visibilityFailures,
    targetVisibilityFailures,
    landings,
    consoleEntries,
    pageErrors,
    expectedPageErrors,
    unexpectedPageErrors,
  };
  await writeFile(
    path.join(outputDir, 'playthrough.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        completed,
        routePlatforms: route.length,
        totalJumps,
        landingCount: landingOutcomeCount,
        progressCount,
        progressingFallCount,
        nonProgressingFallCount: failures.length,
        failureCount: failures.length,
        routeFallEventCount,
        framingFailureCount: framingFailures.length,
        visibilityFailureCount: visibility?.failures?.length ?? 0,
        noticeFailureCount: visibility?.noticeFailures?.length ?? 0,
        unexpectedCameraJumpCount: unexpectedCameraJumps.length,
        unexpectedPageErrorCount: unexpectedPageErrors.length,
        finalPlatform: finalState.lastPlatformId,
        currentZone: finalState.currentZone,
        elapsedMs: report.elapsedMs,
      },
      null,
      2
    )}\n`
  );

  if (
    (!completed && options.requireSummit) ||
    framingFailures.length > 0 ||
    (visibility?.failures?.length ?? 0) > 0 ||
    (visibility?.noticeFailures?.length ?? 0) > 0 ||
    unexpectedCameraJumps.length > 0 ||
    unexpectedPageErrors.length > 0 ||
    visibilityFailures.length > 0
  )
    process.exitCode = 1;
} catch (error) {
  const events = await page
    .evaluate(() => window.__fallstackQaEvents ?? [])
    .catch(() => []);
  await writeFile(
    path.join(outputDir, 'failure.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
        elapsedMs: Date.now() - startedAt,
        events,
        failures,
        framingFailures,
        landings,
        consoleEntries,
        pageErrors,
      },
      null,
      2
    )}\n`
  );
  await capture(page, outputDir, '99-failure').catch(() => {});
  throw error;
} finally {
  boardApi?.stop();
  await context.close();
  await browser.close();
}

async function performJump(page, current, target, attempt, blockers) {
  const before = await readScene(page, false);
  recordVisibility(before, `jump-${target.id}-before`);
  const directDirection =
    target.x + target.width / 2 >=
    (current?.x ?? before.x) + (current?.width ?? 0) / 2
      ? 1
      : -1;
  const direction = directDirection;
  const wallBounce = false;
  const retryApproach = attempt === 1 ? -3 : Math.min(30, (attempt - 1) * 6);
  const desiredLaunchX =
    direction > 0
      ? target.x - 88 + retryApproach
      : target.x + target.width + 88 - retryApproach;
  await positionOnSupport(page, current, desiredLaunchX);
  const setupState = await readScene(page, false);
  await recordTargetVisibility(page, current, target);

  const launchArrow = direction > 0 ? 'ArrowRight' : 'ArrowLeft';
  await neutralizePowerUps(page);
  await waitForCalmAir(page);
  const heldMs = chargeDuration(current, target, attempt, wallBounce);
  const launchCount = await eventCount(page, 'launch');
  const landCount = await eventCount(page, 'land');
  const chargeCount = await eventCount(page, 'charge');
  if (options.input === 'touch') {
    await faceControl(page, launchArrow);
    const chargePressedAt = performance.now();
    await controlDown(page, 'Space');
    await waitForEventCount(page, 'charge', chargeCount + 1, 1_500);
    await page.waitForTimeout(
      Math.max(0, heldMs - (performance.now() - chargePressedAt))
    );
    await controlUp(page, 'Space');
  } else {
    const chargePressedAt = performance.now();
    await controlDown(page, launchArrow);
    await controlDown(page, 'Space');
    await waitForEventCount(page, 'charge', chargeCount + 1, 1_500);
    await controlUp(page, launchArrow);
    await page.waitForTimeout(
      Math.max(0, heldMs - (performance.now() - chargePressedAt))
    );
    await controlUp(page, 'Space');
  }
  // A cursed foothold can collapse mid-charge; that fall is a real outcome.
  const fallCount = await eventCount(page, 'fall');
  await page.waitForFunction(
    ({ launches, falls }) => {
      const events = window.__fallstackQaEvents ?? [];
      const count = (name) =>
        events.filter((event) => event.name === name).length;
      return count('launch') >= launches || count('fall') >= falls;
    },
    { launches: launchCount + 1, falls: fallCount + 1 },
    { timeout: 2_000 }
  );
  if ((await eventCount(page, 'launch')) <= launchCount) {
    await releaseControls(page);
    return {
      outcome: 'fall',
      peakY: before.y,
      frames: 0,
      direction,
      wallBounce,
      bounced: false,
      blockerIds: blockers.map((blocker) => blocker.id),
      setupState: compactState(setupState),
      launchState: compactState(await readScene(page, false)),
      trace: [],
    };
  }
  const launchState = await readScene(page, false);
  recordVisibility(launchState, `jump-${target.id}-launch`);

  let outcome = 'airborne';
  let peakY = before.y;
  let frames = 0;
  let activeArrow = null;
  let bounced = false;
  let observedAirborne = !launchState.grounded;
  const trace = [];
  const started = performance.now();

  while (performance.now() - started < 6_000) {
    const state = await readScene(page, false);
    recordVisibility(state, `jump-${target.id}-flight`);
    if (!state.grounded) observedAirborne = true;
    peakY = Math.min(peakY, state.y);
    if (state.summitSent) {
      outcome = 'summit';
      break;
    }
    if (state.attemptId !== before.attemptId) {
      outcome = 'fall';
      break;
    }
    const landedAfterLaunch = state.landCount > landCount;
    if ((observedAirborne && state.grounded) || landedAfterLaunch) {
      outcome = state.lastPlatformId === target.id ? 'target' : 'landed';
      break;
    }

    if (wallBounce && state.vx * direction < -100) bounced = true;
    const requestedArrow =
      wallBounce && !bounced
        ? launchArrow
        : flightCorrection(state, target, direction, attempt);
    if (trace.length < 80) {
      trace.push({
        x: round(state.x),
        y: round(state.y),
        vx: round(state.vx),
        vy: round(state.vy),
        grounded: state.grounded,
        requestedArrow,
      });
    }
    if (options.input === 'touch' && options.browser === 'webkit') {
      if (requestedArrow) await pulseControlForFrame(page, requestedArrow);
      else await page.waitForTimeout(20);
    } else {
      if (requestedArrow !== activeArrow) {
        if (activeArrow) await controlUp(page, activeArrow);
        if (requestedArrow) await controlDown(page, requestedArrow);
        activeArrow = requestedArrow;
      }
      await page.waitForTimeout(16);
    }
    frames += 1;
  }
  if (activeArrow) await controlUp(page, activeArrow);
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
    trace,
  };
}

async function performIntroFall(page) {
  const before = await readScene(page, false);
  const initial = await readScene(page, true);
  const start = initial.platforms.find((platform) => platform.id === 'start');
  if (!start) throw new Error('Opening platform was unavailable');
  await positionOnSupport(page, start, start.x + 16);
  await controlDown(page, 'ArrowLeft');
  const fell = await page
    .waitForFunction(
      (attemptId) =>
        (window.__fallstackQaEvents ?? []).some(
          (event) =>
            event.name === 'fall' && event.detail?.attemptId === attemptId
        ),
      before.attemptId,
      { timeout: 7_000 }
    )
    .then(() => true)
    .catch(() => false);
  await controlUp(page, 'ArrowLeft');
  if (!fell)
    throw new Error(
      'Walking off the opening ledge did not produce the expected fall'
    );

  const settled = await waitForGrounded(page, 8_000);
  await page.waitForTimeout(300);
  const noticeBeforeInput = await visibleGameplayNotices(page);
  await tapControl(page, 'ArrowRight', 24);
  const noticesDismissed = await page
    .waitForFunction(
      () =>
        !document.querySelector(
          '.mutation-banner.visible, .checkpoint-banner.visible, .remote-beat'
        ),
      null,
      { timeout: 750 }
    )
    .then(() => true)
    .catch(() => false);
  if (noticeBeforeInput.length > 0 && !noticesDismissed)
    throw new Error('Fall feedback remained over gameplay after input resumed');
  const after = await readScene(page, false);
  const fallEvents = await page.evaluate(
    (initialAttemptId) =>
      (window.__fallstackQaEvents ?? []).filter(
        (event) =>
          event.name === 'fall' && event.detail?.attemptId !== initialAttemptId
      ),
    before.attemptId
  );
  if (fallEvents.length > 0) {
    throw new Error(
      `Respawn emitted ${fallEvents.length} duplicate fall event(s) before the next launch`
    );
  }
  return {
    initialAttemptId: before.attemptId,
    respawnAttemptId: after.attemptId,
    settled: compactState(settled),
    after: compactState(after),
    noticeBeforeInput,
    noticesDismissed,
  };
}

async function readGameplayNotices(page) {
  return page.evaluate(() => {
    const scene = window.__fallstackFindScene?.() ?? (() => {
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
          const found = candidate?.scene?.keys?.FallstackScene;
          if (found) return found;
          hook = hook.next;
        }
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      }
      return null;
    })();
    const mutation = document.querySelector('.mutation-banner.visible');
    const checkpoint = document.querySelector('.checkpoint-banner.visible');
    const remote = document.querySelector('.remote-beat');
    const isVisible = (element) =>
      Boolean(
        element &&
          getComputedStyle(element).display !== 'none' &&
          getComputedStyle(element).visibility !== 'hidden'
      );
    if (!scene || !mutation) {
      return {
        mutationVisible: isVisible(mutation),
        anyVisible:
          isVisible(mutation) || isVisible(checkpoint) || isVisible(remote),
        playerOverlap: 0,
        targetOverlap: 0,
      };
    }
    const canvas = document.querySelector('#game-canvas canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const camera = scene.cameras.main;
    const scaleX = canvasRect.width / camera.worldView.width;
    const scaleY = canvasRect.height / camera.worldView.height;
    const overlay = rectOf(mutation);
    const player = {
      left:
        canvasRect.left +
        (scene.player.x -
          scene.player.body.halfWidth -
          camera.worldView.x) *
          scaleX,
      right:
        canvasRect.left +
        (scene.player.x +
          scene.player.body.halfWidth -
          camera.worldView.x) *
          scaleX,
      top:
        canvasRect.top +
        (scene.player.y -
          scene.player.body.halfHeight -
          camera.worldView.y) *
          scaleY,
      bottom:
        canvasRect.top +
        (scene.player.y +
          scene.player.body.halfHeight -
          camera.worldView.y) *
          scaleY,
    };
    const next = scene.nextRoutePlatform();
    const target = next
      ? {
          left:
            canvasRect.left +
            (scene.layoutPlatform(next).x - camera.worldView.x) * scaleX,
          right:
            canvasRect.left +
            (scene.layoutPlatform(next).x +
              scene.layoutPlatform(next).width -
              camera.worldView.x) *
              scaleX,
          top:
            canvasRect.top +
            (next.y - camera.worldView.y) * scaleY,
          bottom:
            canvasRect.top +
            (next.y + next.height - camera.worldView.y) * scaleY,
        }
      : null;
    return {
      mutationVisible: isVisible(mutation),
      anyVisible:
        isVisible(mutation) || isVisible(checkpoint) || isVisible(remote),
      placement: mutation.classList.contains('place-bottom') ? 'bottom' : 'top',
      playerOverlap: overlapArea(overlay, player),
      targetOverlap: target ? overlapArea(overlay, target) : 0,
    };

    function rectOf(element) {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
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

async function validateRestoredCheckpoint(page, requestedZone) {
  await page.waitForTimeout(500);
  const state = await waitForGrounded(page, 8_000);
  const wrongZoneEvents = await page.evaluate(
    (zoneId) =>
      (window.__fallstackQaEvents ?? []).filter(
        (event) => event.name === 'zone' && event.detail?.zoneId !== zoneId
      ),
    requestedZone
  );
  if (
    state.currentZone !== requestedZone ||
    state.respawnZone !== requestedZone
  ) {
    throw new Error(
      `Checkpoint restored to ${state.currentZone}/${state.respawnZone}, expected ${requestedZone}`
    );
  }
  if (wrongZoneEvents.length > 0) {
    throw new Error(
      `Checkpoint restore crossed ${wrongZoneEvents.length} unintended zone(s) before input`
    );
  }
  return { requestedZone, settled: compactState(state) };
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
    if (Math.abs(state.x - targetX) <= 5) break;
    const nextArrow = state.x < targetX ? 'ArrowRight' : 'ArrowLeft';
    if (options.browser === 'webkit') {
      await pulseControlForFrame(page, nextArrow);
    } else {
      if (nextArrow !== activeArrow) {
        if (activeArrow) await controlUp(page, activeArrow);
        await controlDown(page, nextArrow);
        activeArrow = nextArrow;
      }
      await page.waitForTimeout(16);
    }
  }
  if (activeArrow) await controlUp(page, activeArrow);
  const settleDeadline = performance.now() + 260;
  while (performance.now() < settleDeadline) {
    const state = await readScene(page, false);
    if (!state.grounded || Math.abs(state.vx) <= 16) break;
    await page.waitForTimeout(16);
  }
}

function flightCorrection(state, target, launchDirection, attempt) {
  const targetCenter = target.x + target.width / 2;
  const safeLandingX =
    target.x + target.width > 430
      ? target.x + 25
      : target.x < 50
        ? target.x + target.width - 25
        : targetCenter;
  const stillBelowTop = state.y + 15 > target.y;
  const landingX = clamp(
    safeLandingX,
    target.x + 17,
    target.x + target.width - 17
  );
  const g = 1850;
  const deltaY = target.y - state.y;
  const discriminant = state.vy * state.vy + 2 * g * deltaY;
  // Brake against the descending intersection, when the player can land.
  const timeToHeight =
    discriminant >= 0 ? (-state.vy + Math.sqrt(discriminant)) / g : 0.18;
  const horizon = clamp(timeToHeight, 0.08, 0.9);
  const requiredVx = clamp((landingX - state.x) / horizon, -430, 430);
  const velocityError = requiredVx - state.vx;
  const positionError = landingX - state.x;
  const tolerance = stillBelowTop ? 10 : state.vy > 0 ? 18 : 28;

  // A player keeps committing toward an elevated ledge until their feet clear
  // its top. Braking toward the predicted landing point before that moment can
  // drive a low-frame-rate run into the ledge wall instead of over its lip.
  if (
    attempt > 1 &&
    stillBelowTop &&
    state.vy < 0 &&
    positionError * launchDirection > tolerance
  )
    return launchDirection > 0 ? 'ArrowRight' : 'ArrowLeft';

  if (Math.abs(positionError) <= tolerance && Math.abs(velocityError) < 55)
    return null;
  if (velocityError > 24) return 'ArrowRight';
  if (velocityError < -24) return 'ArrowLeft';
  return positionError > 0 ? 'ArrowRight' : 'ArrowLeft';
}

function chargeDuration(current, target, attempt, wallBounce) {
  const verticalGap = current ? current.y - target.y : 110;
  const horizontalGap = current
    ? Math.abs(current.x + current.width / 2 - (target.x + target.width / 2))
    : 110;
  const retryBoost =
    verticalGap > 100 || horizontalGap > 110
      ? Math.min(90, Math.max(0, attempt - 1) * 18)
      : 0;
  const gravity = 1850;
  const minimumVelocityY = 650;
  const maximumVelocityY = 1050;
  const minimumChargeRatio = 0.42;
  const chargeMs = 600;
  const requiredVelocityY = Math.sqrt(
    2 * gravity * Math.max(0, verticalGap + 4)
  );
  const requiredRatio = clamp(
    (requiredVelocityY - minimumVelocityY) /
      (maximumVelocityY - minimumVelocityY),
    minimumChargeRatio,
    1
  );
  const verticalCharge =
    ((requiredRatio - minimumChargeRatio) / (1 - minimumChargeRatio)) *
    chargeMs;
  // A key/touch release near a Phaser frame boundary can be observed one
  // simulation tick earlier than wall-clock time. Leave one frame of headroom
  // whenever the target is above the minimum-charge apex.
  const simulationFrameMargin = verticalCharge > 0 ? 24 : 0;
  const adaptive = verticalCharge + simulationFrameMargin + retryBoost;
  return wallBounce ? Math.max(120, adaptive) : adaptive;
}

function blockingObstacles(platforms, current, target) {
  if (!current) return [];
  return platforms.filter(
    (platform) =>
      platform.kind === 'obstacle' &&
      platform.y < current.y &&
      platform.y + platform.height > target.y &&
      platform.y < target.y + target.height
  );
}

// The charge model above is calibrated to base physics. Pickups the bot grabs
// mid-arc (Spark, Updraft) would silently retime its next leap, so it drops
// them before each jump; their behaviour is covered by unit tests.
async function neutralizePowerUps(page) {
  await page.evaluate(() => {
    const dynamics = window.__fallstackPipelineScene?.()?.dynamics;
    if (!dynamics?.loadout) return;
    dynamics.loadout.timedUntil = { spark: 0, updraft: 0 };
    dynamics.loadout.held = { second_wind: 0, thread: 0 };
  });
}

// In the Gale Loom a player reads the HUD gust call and leaps in calm air;
// the bot does the same instead of steering mid-flight.
async function waitForCalmAir(page) {
  const deadline = performance.now() + 7_000;
  while (performance.now() < deadline) {
    const calm = await page.evaluate(() => {
      const scene = window.__fallstackPipelineScene?.();
      const gust = scene?.dynamics?.gust?.(scene.time.now, scene.currentZone);
      return !gust || (gust.phase === 'calm' && gust.msRemaining > 1_400);
    });
    if (calm) return;
    await page.waitForTimeout(100);
  }
}

async function waitForGrounded(page, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    const state = await readScene(page, false);
    if (state.grounded) return state;
    await page.waitForTimeout(20);
  }
  throw new Error(
    `Player did not return to a grounded state within ${timeoutMs}ms`
  );
}

async function readScene(page, includePlatforms) {
  return page.evaluate((withPlatforms) => {
    function findScene() {
      const cached = window.__fallstackQaScene;
      if (cached?.player?.body) return cached;
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
          if (scene) {
            window.__fallstackQaScene = scene;
            return scene;
          }
          hook = hook.next;
        }
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      }
      return null;
    }

    const scene = findScene();
    const player = scene?.player;
    if (!scene || !player?.body)
      throw new Error('Fallstack scene was not discoverable');
    // Pseudo-element widths can be 'auto' when a rail is not drawn.
    const cssPx = (value) => Number.parseFloat(value ?? '0') || 0;
    const camera = scene.cameras.main;
    const canvas = document.querySelector('#game-canvas canvas');
    const canvasRect = canvas?.getBoundingClientRect();
    const rail = document.querySelector('.tower-side-rails');
    const railStyle = rail ? getComputedStyle(rail) : null;
    const railBefore = rail ? getComputedStyle(rail, '::before') : null;
    const railAfter = rail ? getComputedStyle(rail, '::after') : null;
    const scaleX =
      canvasRect && camera.worldView.width > 0
        ? canvasRect.width / camera.worldView.width
        : 1;
    const visualHalfWidth = player.body.halfWidth + 12;
    const leftPillar =
      cssPx(railStyle?.borderLeftWidth) + cssPx(railBefore?.width);
    const rightPillar =
      cssPx(railStyle?.borderRightWidth) + cssPx(railAfter?.width);
    const visualLeft =
      (player.x - visualHalfWidth - camera.worldView.x) * scaleX;
    const visualRight =
      (player.x + visualHalfWidth - camera.worldView.x) * scaleX;
    const logicalX = player.x - scene.currentRouteOffset;
    const supportArtifact = (window.fallstackSnapshot?.zones ?? [])
      .flatMap((zone) => zone.artifacts ?? [])
      .filter((artifact) => artifact.solid !== false)
      .find(
        (artifact) =>
          Math.abs(artifact.y - player.y - player.body.halfHeight) <= 4 &&
          logicalX >= artifact.x - player.body.halfWidth &&
          logicalX <= artifact.x + artifact.width + player.body.halfWidth
      );
    return {
      x: logicalX,
      y: player.y,
      vx: player.body.velocity.x,
      vy: player.body.velocity.y,
      grounded: Boolean(player.body.blocked.down || player.body.touching.down),
      facing: scene.facing,
      landCount: (window.__fallstackQaEvents ?? []).filter(
        (event) => event.name === 'land'
      ).length,
      lastPlatformId: scene.lastPlatformId,
      currentZone: scene.currentZone,
      respawnZone: scene.respawnZone,
      attemptId: scene.currentAttemptId,
      highestY: scene.highestY,
      summitSent: scene.summitSent,
      controlsReady: scene.controlsReady,
      visibility: {
        visualLeft,
        visualRight,
        safeLeft: leftPillar,
        safeRight: (canvasRect?.width ?? 0) - rightPillar,
        cameraScrollX: camera.scrollX,
        cameraWorldX: camera.worldView.x,
        cameraWorldWidth: camera.worldView.width,
        zoom: camera.zoom,
      },
      support: supportArtifact
        ? {
            id: `artifact:${supportArtifact.id}`,
            artifactId: supportArtifact.id,
            artifactType: supportArtifact.type,
            x: supportArtifact.x,
            y: supportArtifact.y,
            width: supportArtifact.width,
            height: supportArtifact.height,
            kind: 'artifact',
          }
        : null,
      ...(withPlatforms ? { platforms: scene.towerPlatforms } : {}),
    };
  }, includePlatforms);
}

async function readLandingFraming(page, nextPlatform) {
  // Let the production camera ease toward its landing target. The old test
  // called a private snap method and could not reveal a visible landing jolt.
  await page.waitForTimeout(180);
  return page.evaluate((platform) => {
    function findGame() {
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
    const canvas = document.querySelector('#game-canvas canvas');
    const zoneTag = document.querySelector('.zone-tag');
    if (!scene || !canvas || !zoneTag)
      throw new Error('Landing framing geometry was unavailable');
    const canvasRect = canvas.getBoundingClientRect();
    const zoneTagRect = zoneTag.getBoundingClientRect();
    const worldView = scene.cameras.main.worldView;
    const scaleY = canvasRect.height / worldView.height;
    const layout = scene.layoutPlatform(platform);
    return {
      safeTop: zoneTagRect.bottom + 12,
      nextPlatformTop: canvasRect.top + (layout.y - worldView.y) * scaleY,
      cameraScrollY: scene.cameras.main.scrollY,
      cameraWorldViewY: worldView.y,
    };
  }, nextPlatform);
}

function currentSupport(platforms, platformById, state) {
  if (state.support) return state.support;
  const exact = platformById.get(state.lastPlatformId);
  if (exact && Math.abs(exact.y - state.y - 14) <= 4) return exact;
  const overlapping =
    platforms
      .filter(
        (platform) =>
          platform.y >= state.y &&
          platform.y - state.y < 90 &&
          state.x >= platform.x - 12 &&
          state.x <= platform.x + platform.width + 12
      )
      .sort(
        (left, right) =>
          Math.abs(left.y - state.y - 14) - Math.abs(right.y - state.y - 14)
      )[0] ?? null;
  if (overlapping) return overlapping;

  return (
    platforms
      .filter(
        (platform) =>
          platform.kind !== 'obstacle' &&
          Math.abs(platform.y - state.y - 14) <= 4 &&
          horizontalDistance(state.x, platform) <= 80
      )
      .sort(
        (left, right) =>
          horizontalDistance(state.x, left) - horizontalDistance(state.x, right)
      )[0] ?? null
  );
}

function horizontalDistance(x, platform) {
  if (x < platform.x) return platform.x - x;
  if (x > platform.x + platform.width) return x - platform.x - platform.width;
  return 0;
}

function routeProgressIndex(route, routeIndex, support) {
  if (!support) return undefined;
  const exact = routeIndex.get(support.id);
  if (exact !== undefined) return exact;
  if (support.kind !== 'artifact') return undefined;
  let progress = -1;
  for (let index = 0; index < route.length; index += 1) {
    if (route[index].y >= support.y) progress = index;
    else break;
  }
  return progress >= 0 ? progress : undefined;
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
  if (options.input === 'touch') {
    await pointerDriver?.up().catch(() => {});
    return;
  }
  for (const key of ['ArrowLeft', 'ArrowRight', 'Space']) {
    await controlUp(page, key).catch(() => {});
  }
}

async function controlDown(page, key) {
  if (options.input !== 'touch') {
    await page.keyboard.down(key);
    return;
  }
  const locator = page.locator(controlSelector(key));
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Touch control ${key} had no hit target`);
  await pointerDriver?.down({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
}

async function controlUp(page, key) {
  if (options.input !== 'touch') {
    await page.keyboard.up(key);
    return;
  }
  await pointerDriver?.up();
}

async function tapControl(page, key, heldMs = 16) {
  await controlDown(page, key);
  await page.waitForTimeout(heldMs);
  await controlUp(page, key);
}

async function pulseControlForFrame(page, key) {
  await controlDown(page, key);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
      })
  );
  await controlUp(page, key);
}

async function faceControl(page, key) {
  const expectedFacing = key === 'ArrowLeft' ? -1 : 1;
  const deadline = performance.now() + 600;
  let state = await readScene(page, false);
  while (state.facing !== expectedFacing && performance.now() < deadline) {
    await pulseControlForFrame(page, key);
    state = await readScene(page, false);
  }
  if (state.facing !== expectedFacing)
    throw new Error(`Touch control ${key} did not change player facing`);
}

function controlSelector(key) {
  if (key === 'ArrowLeft') return 'button[aria-label="Move left"]';
  if (key === 'ArrowRight') return 'button[aria-label="Move right"]';
  if (key === 'Space')
    return 'button[aria-label="Hold to charge; release to leap"]';
  throw new Error(`Unsupported gameplay control: ${key}`);
}

async function createPointerDriver(context, page, browserName) {
  if (browserName === 'webkit') {
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

async function eventCount(page, name) {
  return page.evaluate(
    (eventName) =>
      (window.__fallstackQaEvents ?? []).filter(
        (event) => event.name === eventName
      ).length,
    name
  );
}

async function waitForEventCount(page, name, expectedCount, timeoutMs) {
  await page.waitForFunction(
    ({ eventName, count }) =>
      (window.__fallstackQaEvents ?? []).filter(
        (event) => event.name === eventName
      ).length >= count,
    { eventName: name, count: expectedCount },
    { timeout: timeoutMs }
  );
}

async function visibleGameplayNotices(page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '.mutation-banner.visible, .checkpoint-banner.visible, .remote-beat'
      )
    ).map((element) => ({
      className: element.className,
      text: element.textContent?.trim() ?? '',
    }))
  );
}

async function capture(page, outputDir, name) {
  if (!options.screenshots) return;
  await captureScreenshot(page, {
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
    supportId: state.support?.id ?? null,
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

async function waitForCameraSettle(page, timeoutMs = 700) {
  await page.evaluate(
    (timeout) =>
      new Promise((resolve) => {
        const scene = window.__fallstackPipelineScene?.();
        if (!scene) return resolve();
        const started = performance.now();
        let last = scene.cameras.main.worldView.y;
        let still = 0;
        const tick = () => {
          const y = scene.cameras.main.worldView.y;
          still = Math.abs(y - last) < 0.5 ? still + 1 : 0;
          last = y;
          if (still >= 3 || performance.now() - started > timeout) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    timeoutMs
  );
}

// The player must be able to see where they are jumping before they jump.
async function recordTargetVisibility(page, current, target) {
  const view = await page.evaluate((platform) => {
    const scene = window.__fallstackPipelineScene?.();
    const canvas = document.querySelector('#game-canvas canvas');
    if (!scene || !canvas) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const camera = scene.cameras.main;
    const scaleX = canvasRect.width / camera.worldView.width;
    const scaleY = canvasRect.height / camera.worldView.height;
    const layout = scene.layoutPlatform(platform);
    const zoneTag = document.querySelector('.zone-tag')?.getBoundingClientRect();
    const controls = document.querySelector('.touch-controls');
    const controlsRect =
      controls && getComputedStyle(controls).display !== 'none'
        ? controls.getBoundingClientRect()
        : null;
    return {
      left: canvasRect.left + (layout.x - camera.worldView.x) * scaleX,
      right:
        canvasRect.left + (layout.x + layout.width - camera.worldView.x) * scaleX,
      top: canvasRect.top + (layout.y - camera.worldView.y) * scaleY,
      bottom:
        canvasRect.top + (layout.y + layout.height - camera.worldView.y) * scaleY,
      safeLeft: canvasRect.left,
      safeRight: canvasRect.right,
      safeTop: Math.max(canvasRect.top, (zoneTag?.bottom ?? canvasRect.top) + 4),
      safeBottom: Math.min(canvasRect.bottom, controlsRect?.top ?? canvasRect.bottom),
    };
  }, target);
  if (!view) return;
  const offscreen = [];
  if (view.top < view.safeTop) offscreen.push('top');
  if (view.bottom > view.safeBottom) offscreen.push('bottom');
  // A wide ledge may run past the edge; the player only needs part of it.
  if (view.right < view.safeLeft + 24) offscreen.push('left');
  if (view.left > view.safeRight - 24) offscreen.push('right');
  if (offscreen.length === 0) return;
  targetVisibilityFailures.push({
    from: current?.id ?? null,
    target: target.id,
    zone: target.zoneId,
    offscreen,
    ...Object.fromEntries(
      Object.entries(view).map(([key, value]) => [key, round(value)])
    ),
  });
}

function summarizeFrames(frames, cameraY, events, hitchMs) {
  const deltas = [];
  for (let index = 1; index < frames.length; index += 1)
    deltas.push({
      at: frames[index],
      ms: frames[index] - frames[index - 1],
      cameraPx:
        cameraY[index] == null || cameraY[index - 1] == null
          ? 0
          : Math.abs(cameraY[index] - cameraY[index - 1]),
    });
  const sorted = deltas.map((delta) => delta.ms).sort((a, b) => a - b);
  const percentile = (p) =>
    sorted.length
      ? round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))])
      : 0;
  const landEvents = events.filter((event) => event.name === 'land');
  const worstIn = (from, to, key) => {
    const window = deltas.filter((delta) => delta.at > from && delta.at <= to);
    return window.length ? Math.max(...window.map((delta) => delta[key])) : 0;
  };
  const landingWindows = landEvents.map((event) =>
    worstIn(event.at, event.at + 500, 'ms')
  );
  // Largest single-frame camera move right after touchdown: a visible jolt.
  const landingCameraJumps = landEvents.map((event) =>
    worstIn(event.at - 20, event.at + 300, 'cameraPx')
  );
  const median = (values) =>
    values.length
      ? round([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)])
      : 0;
  return {
    frameCount: frames.length,
    medianFrameMs: percentile(0.5),
    p95FrameMs: percentile(0.95),
    p99FrameMs: percentile(0.99),
    longFrameCount: sorted.filter((ms) => ms >= hitchMs).length,
    landings: landingWindows.length,
    landingHitchCount: landingWindows.filter((ms) => ms >= hitchMs).length,
    worstLandingFrameMs: round(Math.max(0, ...landingWindows)),
    medianLandingWorstFrameMs: median(landingWindows),
    landingCameraJoltCount: landingCameraJumps.filter((px) => px >= 24).length,
    worstLandingCameraJumpPx: round(Math.max(0, ...landingCameraJumps)),
    medianLandingCameraJumpPx: median(landingCameraJumps),
  };
}

function parseArgs(args) {
  const values = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('--')) continue;
    const [key, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) values.set(key, inline);
    else if (args[index + 1] && !args[index + 1].startsWith('--'))
      values.set(key, args[++index]);
    else values.set(key, 'true');
  }
  const mobile = values.get('mobile') === 'true';
  const input = values.get('input') ?? (mobile ? 'touch' : 'keyboard');
  if (!['keyboard', 'touch'].includes(input))
    throw new Error(`Unsupported input mode: ${input}`);
  if (values.get('intro-fall') === 'true' && !mobile)
    throw new Error('--intro-fall requires --mobile true');
  return {
    url: values.get('url') ?? 'http://127.0.0.1:8080/game.html',
    output: values.get('output') ?? 'docs/qa/final-pass/full-playthrough',
    browser: values.get('browser') ?? 'chromium',
    width: numberOption(values, 'width', 375),
    height: numberOption(values, 'height', 812),
    deviceScaleFactor: numberOption(values, 'device-scale-factor', 1),
    mobile,
    input,
    maxJumps: numberOption(values, 'max-jumps', 1_500),
    retries: numberOption(values, 'retries', 8),
    canvas: values.get('canvas') !== 'false',
    reducedMotion: values.get('reduced-motion') === 'true',
    video: values.get('video') === 'true',
    screenshots: values.get('screenshots') !== 'false',
    progress: values.get('progress') !== 'false',
    // Chromium's software Canvas compositor can crash while capturing the
    // post-summit modal after a long run. Per-zone captures remain enabled;
    // request this extra artifact explicitly when debugging the summit UI.
    finalScreenshot: values.get('final-screenshot') === 'true',
    boardOnly: values.get('board-only') === 'true',
    introFall: values.get('intro-fall') === 'true',
    input: values.get('input') === 'touch' ? 'touch' : 'keyboard',
    mobile: values.get('mobile') === 'true',
    touch: values.get('touch') === 'true',
    resumeZone: values.get('resume-zone') ?? null,
    requireSummit: values.get('require-summit') !== 'false',
    mockApi: values.get('mock-api') === 'true',
    remoteFallMs: numberOption(values, 'remote-fall-ms', 0),
    cpuThrottle: numberOption(values, 'cpu-throttle', 1),
    hitchMs: numberOption(values, 'hitch-ms', 50),
    directDevvitAsset: values.get('direct-devvit-asset') === 'true',
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
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function recordVisibility(state, phase) {
  const visibility = state.visibility;
  if (
    !visibility ||
    (visibility.visualLeft >= visibility.safeLeft - 0.5 &&
      visibility.visualRight <= visibility.safeRight + 0.5)
  )
    return;
  const side =
    visibility.visualLeft < visibility.safeLeft - 0.5 ? 'left' : 'right';
  const prior = visibilityFailures.at(-1);
  if (
    prior?.side === side &&
    prior?.lastPlatformId === state.lastPlatformId &&
    prior?.attemptId === state.attemptId
  )
    return;
  visibilityFailures.push({
    phase,
    side,
    attemptId: state.attemptId,
    lastPlatformId: state.lastPlatformId,
    player: { x: round(state.x), y: round(state.y) },
    ...visibility,
  });
}
