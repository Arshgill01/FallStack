import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, firefox, webkit } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const args = parseArgs(process.argv.slice(2));
const outputDir = path.resolve(args.output);
const allScenarios = [
  {
    name: 'chromium-desktop-compact',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    input: 'keyboard',
    budget: 'hardware',
  },
  {
    name: 'chromium-desktop-fullscreen',
    browserName: 'chromium',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    input: 'keyboard',
    budget: 'hardware',
  },
  {
    name: 'firefox-desktop-compact',
    browserName: 'firefox',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    input: 'keyboard',
    budget: 'hardware',
  },
  {
    name: 'webkit-desktop-compact',
    browserName: 'webkit',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    input: 'keyboard',
    budget: 'software-webkit',
  },
  {
    name: 'chromium-mobile-touch',
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    input: 'touch',
    isMobile: true,
    hasTouch: true,
    budget: 'hardware',
  },
];
const scenarios = args.scenarios.length
  ? allScenarios.filter((item) => args.scenarios.includes(item.name))
  : allScenarios;
if (scenarios.length === 0)
  throw new Error(`No scenarios matched: ${args.scenarios.join(', ')}`);

await mkdir(outputDir, { recursive: true });
const browserTypes = { chromium, firefox, webkit };
const runs = [];
const checks = [];
let activeRun = null;
try {
  for (let repetition = 1; repetition <= args.repetitions; repetition += 1) {
    for (const scenario of scenarios) {
      activeRun = `${scenario.name}-${repetition}`;
      const run = await runScenario(scenario, repetition);
      runs.push(run);
      addRunChecks(run);
    }
  }
} catch (error) {
  await writeFile(
    path.join(outputDir, 'failure.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        activeRun,
        completedRuns: runs.map((run) => run.id),
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      },
      null,
      2
    )}\n`
  );
  throw error;
}

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    url: args.url,
    commit: process.env.FALLSTACK_QA_SOURCE_COMMIT ?? 'unknown',
  },
  repetitions: args.repetitions,
  jumpsPerRun: args.jumps,
  screenshotsEnabled: args.screenshots,
  passed: checks.every((item) => item.passed),
  note:
    'Linux Playwright WebKit is a software-composited comparative runner. ' +
    'No sample, including a slow frame, is filtered from timing or camera metrics.',
  checks,
  runs,
};
await writeFile(
  path.join(outputDir, 'gameplay-feel.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
process.stdout.write(
  args.quiet
    ? `${JSON.stringify(
        {
          passed: report.passed,
          runs: runs.map((run) => ({
            id: run.id,
            launches: run.events.launches,
            frameP95Ms: run.frameTiming.p95,
            updateP95Ms: run.updateTiming.p95,
            inputToMotionP95Ms: run.inputToVisibleMotion.p95,
            cameraStepP99: run.camera.continuous.step.p99,
          })),
          failures: checks
            .filter((item) => !item.passed)
            .map((item) => item.name),
        },
        null,
        2
      )}\n`
    : `${JSON.stringify(report, null, 2)}\n`
);

const failures = checks.filter((item) => !item.passed);
if (failures.length > 0) {
  throw new Error(
    `Gameplay-feel gate failed: ${failures.map((item) => item.name).join('; ')}`
  );
}

async function runScenario(scenario, repetition) {
  const id = `${scenario.name}-${repetition}`;
  const artifactDir = path.join(outputDir, id);
  await mkdir(artifactDir, { recursive: true });
  const browser = await browserTypes[scenario.browserName].launch({
    headless: true,
    ...(scenario.browserName === 'chromium'
      ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] }
      : {}),
  });
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: scenario.deviceScaleFactor,
    isMobile: scenario.isMobile ?? false,
    hasTouch: scenario.hasTouch ?? false,
    ...(args.video
      ? {
          recordVideo: {
            dir: artifactDir,
            size: scenario.viewport,
          },
        }
      : {}),
  });
  await installProbe(context);
  if (args.trace)
    await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        window.__fallstackFindScene?.()?.controlsReady &&
        document.querySelector('#game-canvas canvas') &&
        !document.querySelector('.loading-overlay'),
      null,
      { timeout: 30_000 }
    );
    await page.evaluate(() => {
      window.__fallstackFindScene().restoreCheckpoint('ring_citadel');
    });
    await page.waitForFunction(
      () => {
        const scene = window.__fallstackFindScene?.();
        if (!scene?.player) return false;
        const body = scene.player.body;
        return body.blocked.down || body.touching.down;
      },
      null,
      { timeout: scenario.browserName === 'webkit' ? 12_000 : 6_000 }
    );
    await page.evaluate(() => window.__fallstackFeelProbe.start());
    await page.waitForTimeout(500);

    const pointerDriver =
      scenario.input === 'touch'
        ? await createTouchDriver(context, page, scenario.browserName)
        : null;
    for (let index = 0; index < args.jumps; index += 1) {
      await performJump(page, scenario, pointerDriver, index);
    }
    await page.waitForTimeout(400);
    const raw = await page.evaluate(() => window.__fallstackFeelProbe.stop());
    if (args.screenshots) {
      await captureScreenshot(page, {
        path: path.join(artifactDir, 'final.png'),
        animations: 'disabled',
      });
    }
    const surface = await readSurface(page);
    const metrics = summarizeRun(raw);
    return {
      id,
      scenario: scenario.name,
      browserName: scenario.browserName,
      browserVersion: browser.version(),
      budget: scenario.budget,
      viewport: scenario.viewport,
      deviceScaleFactor: scenario.deviceScaleFactor,
      input: scenario.input,
      surface,
      events: metrics.events,
      frameTiming: metrics.frameTiming,
      updateTiming: metrics.updateTiming,
      inputLatency: metrics.inputLatency,
      inputToVisibleMotion: metrics.inputToVisibleMotion,
      inputToCameraResponse: metrics.inputToCameraResponse,
      camera: metrics.camera,
      layout: metrics.layout,
      longTasks: metrics.longTasks,
      layoutShifts: metrics.layoutShifts,
      pageErrors,
      consoleErrors,
      unexpectedConsoleErrors: consoleErrors.filter(
        (message) => !message.startsWith('Failed to load resource:')
      ),
    };
  } finally {
    if (args.trace)
      await context.tracing.stop({ path: path.join(artifactDir, 'trace.zip') });
    await context.close();
    await browser.close();
  }
}

async function performJump(page, scenario, pointerDriver, index) {
  await page.waitForFunction(
    () => {
      const scene = window.__fallstackFindScene?.();
      if (!scene?.player) return false;
      const body = scene.player.body;
      return (
        !scene.charging &&
        (body.blocked.down || body.touching.down) &&
        Math.abs(body.velocity.y) < 2
      );
    },
    null,
    { timeout: scenario.browserName === 'webkit' ? 12_000 : 6_000 }
  );
  const before = await page.evaluate(() => ({
    launches: window.__fallstackFeelProbe.count('launch'),
    outcomes:
      window.__fallstackFeelProbe.count('land') +
      window.__fallstackFeelProbe.count('fall'),
  }));

  if (scenario.input === 'touch') {
    const jump = page.getByRole('button', {
      name: 'Hold to charge; release to leap',
    });
    const box = await jump.boundingBox();
    if (!box) throw new Error(`${scenario.name} jump control has no bounds`);
    await pointerDriver.down({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    await page.waitForTimeout(170 + (index % 2) * 30);
    await pointerDriver.up();
  } else {
    const direction = index % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(direction);
    await page.keyboard.down('Space');
    await page.waitForTimeout(170 + (index % 2) * 30);
    await page.keyboard.up('Space');
    await page.keyboard.up(direction);
  }

  await page.waitForFunction(
    (count) => window.__fallstackFeelProbe.count('launch') > count,
    before.launches,
    { timeout: scenario.browserName === 'webkit' ? 5_000 : 2_500 }
  );
  await page.waitForFunction(
    (count) =>
      window.__fallstackFeelProbe.count('land') +
        window.__fallstackFeelProbe.count('fall') >
      count,
    before.outcomes,
    { timeout: scenario.browserName === 'webkit' ? 12_000 : 6_000 }
  );
}

async function createTouchDriver(context, page, browserName) {
  if (browserName !== 'chromium') {
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

async function readSurface(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#game-canvas');
    const canvas = container.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      buildId: window.fallstackBuildId,
      profile: container.dataset.renderProfile,
      renderScale: Number(container.dataset.renderScale),
      devicePixelRatio: window.devicePixelRatio,
      backing: { width: canvas.width, height: canvas.height },
      css: { width: rect.width, height: rect.height },
      backingPixels: canvas.width * canvas.height,
      userAgent: navigator.userAgent,
    };
  });
}

async function installProbe(context) {
  await context.addInitScript(() => {
    const probe = {
      active: false,
      events: [],
      frames: [],
      updates: [],
      longTasks: [],
      layoutShifts: [],
      previousFrameAt: null,
      sceneHooked: null,
      frameNumber: 0,
      layout: null,
      count(name) {
        return this.events.filter((event) => event.name === name).length;
      },
      start() {
        this.active = true;
        this.events = [];
        this.frames = [];
        this.updates = [];
        this.longTasks = [];
        this.layoutShifts = [];
        this.previousFrameAt = null;
        this.frameNumber = 0;
        this.layout = null;
      },
      stop() {
        this.active = false;
        return {
          events: this.events,
          frames: this.frames,
          updates: this.updates,
          longTasks: this.longTasks,
          layoutShifts: this.layoutShifts,
        };
      },
    };
    window.__fallstackFeelProbe = probe;
    const copyDetail = (event) => {
      const detail = event.detail;
      if (!detail || typeof detail !== 'object') return null;
      try {
        return JSON.parse(JSON.stringify(detail));
      } catch {
        return null;
      }
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
        if (!probe.active) return;
        probe.events.push({
          name,
          at: performance.now(),
          detail: copyDetail(event),
        });
      });
    }
    const inputEvent = (event) => {
      if (!probe.active) return;
      const target =
        event.target instanceof Element
          ? (event.target.closest('button')?.getAttribute('aria-label') ?? null)
          : null;
      probe.events.push({
        name: event.type,
        at: performance.now(),
        code: event.code ?? null,
        pointerType: event.pointerType ?? null,
        target,
      });
    };
    for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup']) {
      window.addEventListener(name, inputEvent, true);
    }
    window.__fallstackFindScene = () => {
      const root = document.querySelector('#root');
      if (!root) return null;
      const containerKey = Object.keys(root).find((key) =>
        key.startsWith('__reactContainer$')
      );
      const container = containerKey ? root[containerKey] : null;
      const stack = [container?.current ?? container].filter(Boolean);
      const seen = new Set();
      while (stack.length > 0) {
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
    const sample = (now) => {
      const scene = window.__fallstackFindScene?.();
      if (scene && probe.sceneHooked !== scene) {
        probe.sceneHooked = scene;
        scene.events.on('preupdate', (_time, delta) => {
          if (probe.active)
            probe.updates.push({ at: performance.now(), delta });
        });
      }
      if (probe.active && scene?.player) {
        const player = scene.player;
        const body = player.body;
        const worldView = scene.cameras.main.worldView;
        if (probe.frameNumber % 10 === 0 || probe.layout === null) {
          const canvasRect = scene.game.canvas.getBoundingClientRect();
          const shellRect = document
            .querySelector('.game-shell')
            ?.getBoundingClientRect();
          const towerRect = document
            .querySelector('.tower-wrap')
            ?.getBoundingClientRect();
          probe.layout = {
            canvas: rect(canvasRect),
            shell: shellRect ? rect(shellRect) : null,
            tower: towerRect ? rect(towerRect) : null,
          };
        }
        probe.frames.push({
          at: now,
          frameMs:
            probe.previousFrameAt === null ? 0 : now - probe.previousFrameAt,
          playerX: player.x,
          playerY: player.y,
          velocityX: body.velocity.x,
          velocityY: body.velocity.y,
          grounded: Boolean(body.blocked.down || body.touching.down),
          charging: Boolean(scene.charging),
          zone: scene.currentZone,
          cameraX: worldView.x,
          cameraY: worldView.y,
          cameraScrollX: scene.cameras.main.scrollX,
          cameraScrollY: scene.cameras.main.scrollY,
          cameraTargetX: scene.cameraTargetX(player.x),
          cameraTargetY: scene.cameraTargetY(player.y),
          cameraLookaheadX: scene.cameraLookaheadX(),
          cameraLookaheadY: scene.cameraLookaheadY(),
          ...probe.layout,
        });
        probe.previousFrameAt = now;
        probe.frameNumber += 1;
      }
      requestAnimationFrame(sample);
    };
    const rect = (value) => ({
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
    });
    requestAnimationFrame(sample);

    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((list) => {
          if (!probe.active) return;
          for (const entry of list.getEntries()) {
            probe.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        }).observe({ type: 'longtask', buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          if (!probe.active) return;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              probe.layoutShifts.push({
                startTime: entry.startTime,
                value: entry.value,
              });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
    }
  });
}

function summarizeRun(raw) {
  const frames = raw.frames.filter(
    (item, index) => index > 0 && item.frameMs > 0
  );
  const updates = raw.updates.map((item) => item.delta);
  const launches = raw.events.filter((item) => item.name === 'launch');
  const lands = raw.events.filter((item) => item.name === 'land');
  const falls = raw.events.filter((item) => item.name === 'fall');
  const releases = raw.events.filter(
    (item) =>
      (item.name === 'keyup' && item.code === 'Space') ||
      (item.name === 'pointerup' &&
        item.target === 'Hold to charge; release to leap')
  );
  const inputLatencies = launches
    .map((launch) => {
      const release = releases.filter((item) => item.at <= launch.at).at(-1);
      return release ? launch.at - release.at : null;
    })
    .filter((value) => value !== null);
  const releasePairs = launches
    .map((launch) => ({
      launch,
      release: releases.filter((item) => item.at <= launch.at).at(-1),
    }))
    .filter((pair) => pair.release);
  const inputToVisibleMotion = releasePairs
    .map(({ release }) => {
      const before = [...frames]
        .reverse()
        .find((frame) => frame.at <= release.at);
      if (!before) return null;
      const visible = frames.find(
        (frame) =>
          frame.at > release.at &&
          Math.hypot(
            frame.playerX - before.playerX,
            frame.playerY - before.playerY
          ) > 0.5
      );
      return visible ? visible.at - release.at : null;
    })
    .filter((value) => value !== null);
  const inputToCameraResponse = releasePairs
    .map(({ release }) => {
      const before = [...frames]
        .reverse()
        .find((frame) => frame.at <= release.at);
      if (!before) return null;
      const visible = frames.find(
        (frame) =>
          frame.at > release.at &&
          Math.hypot(
            frame.cameraX - before.cameraX,
            frame.cameraY - before.cameraY
          ) > 0.5
      );
      return visible ? visible.at - release.at : null;
    })
    .filter((value) => value !== null);
  const cameraSteps = [];
  const cameraSpeeds = [];
  const cameraAccelerations = [];
  const cameraMotion = [];
  const playerScreenSteps = [];
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const dt = Math.max(0.001, (current.at - previous.at) / 1_000);
    const dx = current.cameraX - previous.cameraX;
    const dy = current.cameraY - previous.cameraY;
    const respawnTransition = raw.events.some(
      (event) =>
        event.name === 'fall' &&
        event.at > previous.at &&
        event.at <= current.at
    );
    cameraSteps.push(Math.hypot(dx, dy));
    cameraSpeeds.push(dy / dt);
    const previousScreenY = previous.playerY - previous.cameraY;
    const currentScreenY = current.playerY - current.cameraY;
    const playerScreenStep = Math.abs(currentScreenY - previousScreenY);
    playerScreenSteps.push(playerScreenStep);
    if (cameraSpeeds.length > 1) {
      const lastSpeed = cameraSpeeds.at(-2);
      const acceleration = Math.abs(cameraSpeeds.at(-1) - lastSpeed) / dt;
      cameraAccelerations.push(acceleration);
      cameraMotion.push({
        at: current.at,
        dtMs: current.at - previous.at,
        step: Math.hypot(dx, dy),
        speed: cameraSpeeds.at(-1),
        acceleration,
        playerScreenStep,
        playerY: current.playerY,
        velocityY: current.velocityY,
        grounded: current.grounded,
        charging: current.charging,
        lookaheadY: current.cameraLookaheadY,
        nearestEvent: nearestEvent(raw.events, current.at),
        respawnTransition,
      });
    }
  }
  return {
    events: {
      launches: launches.length,
      lands: lands.length,
      falls: falls.length,
      clears: raw.events.filter((item) => item.name === 'clear').length,
      summits: raw.events.filter((item) => item.name === 'summit').length,
      zones: raw.events
        .filter((item) => item.name === 'zone')
        .map((item) => item.detail?.zoneId),
    },
    frameTiming: summarizeValues(frames.map((item) => item.frameMs)),
    updateTiming: summarizeValues(updates),
    inputLatency: summarizeValues(inputLatencies),
    inputToVisibleMotion: summarizeValues(inputToVisibleMotion),
    inputToCameraResponse: summarizeValues(inputToCameraResponse),
    camera: {
      step: summarizeValues(cameraSteps),
      verticalSpeed: summarizeSigned(cameraSpeeds),
      acceleration: summarizeValues(cameraAccelerations),
      playerScreenStep: summarizeValues(playerScreenSteps),
      largestAccelerationSamples: [...cameraMotion]
        .sort((left, right) => right.acceleration - left.acceleration)
        .slice(0, 8)
        .map(roundObject),
      continuous: summarizeContinuousCamera(cameraMotion),
      respawnTransitions: cameraMotion.filter((item) => item.respawnTransition)
        .length,
      maxTargetError: round(
        Math.max(
          0,
          ...frames.map((item) =>
            Math.hypot(
              item.cameraTargetX - item.cameraScrollX,
              item.cameraTargetY - item.cameraScrollY
            )
          )
        )
      ),
    },
    layout: summarizeLayout(frames),
    longTasks: {
      count: raw.longTasks.length,
      totalMs: round(
        raw.longTasks.reduce((total, item) => total + item.duration, 0)
      ),
      maxMs: round(Math.max(0, ...raw.longTasks.map((item) => item.duration))),
    },
    layoutShifts: {
      count: raw.layoutShifts.length,
      score: round(
        raw.layoutShifts.reduce((total, item) => total + item.value, 0)
      ),
    },
  };
}

function summarizeContinuousCamera(motion) {
  const continuous = motion.filter((item, index) => {
    return (
      !item.respawnTransition &&
      !motion[index - 1]?.respawnTransition &&
      !motion[index + 1]?.respawnTransition
    );
  });
  return {
    step: summarizeValues(continuous.map((item) => item.step)),
    playerScreenStep: summarizeValues(
      continuous.map((item) => item.playerScreenStep)
    ),
    acceleration: summarizeValues(continuous.map((item) => item.acceleration)),
  };
}

function nearestEvent(events, at) {
  const candidates = events
    .map((event) => ({ name: event.name, deltaMs: event.at - at }))
    .filter((event) => Math.abs(event.deltaMs) <= 120)
    .sort((left, right) => Math.abs(left.deltaMs) - Math.abs(right.deltaMs));
  return candidates[0] ?? null;
}

function roundObject(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === 'number' ? round(item) : item,
    ])
  );
}

function summarizeLayout(frames) {
  const first = frames[0];
  if (!first) return { maxCanvasDelta: 0, maxShellDelta: 0, maxTowerDelta: 0 };
  const maxDelta = (key) =>
    Math.max(0, ...frames.map((frame) => rectDelta(first[key], frame[key])));
  return {
    maxCanvasDelta: round(maxDelta('canvas')),
    maxShellDelta: round(maxDelta('shell')),
    maxTowerDelta: round(maxDelta('tower')),
  };
}

function rectDelta(left, right) {
  if (!left || !right) return 0;
  return Math.max(
    Math.abs(left.x - right.x),
    Math.abs(left.y - right.y),
    Math.abs(left.width - right.width),
    Math.abs(left.height - right.height)
  );
}

function summarizeValues(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    samples: values.length,
    mean: round(values.length ? total / values.length : 0),
    median: round(percentile(sorted, 0.5)),
    p95: round(percentile(sorted, 0.95)),
    p99: round(percentile(sorted, 0.99)),
    max: round(sorted.at(-1) ?? 0),
    over34ms: values.filter((value) => value > 34).length,
    over50ms: values.filter((value) => value > 50).length,
    over100ms: values.filter((value) => value > 100).length,
  };
}

function summarizeSigned(values) {
  const absolute = values.map(Math.abs);
  return {
    ...summarizeValues(absolute),
    min: round(Math.min(0, ...values)),
    maxSigned: round(Math.max(0, ...values)),
  };
}

function addRunChecks(run) {
  check(
    run.pageErrors.length === 0,
    `${run.id} has no page exceptions`,
    run.pageErrors,
    []
  );
  check(
    run.unexpectedConsoleErrors.length === 0,
    `${run.id} has no unexpected console errors`,
    run.unexpectedConsoleErrors,
    []
  );
  check(
    run.events.launches === args.jumps &&
      run.events.lands + run.events.falls >= args.jumps,
    `${run.id} completes every real-input jump and recovery`,
    run.events,
    { launches: args.jumps, outcomes: `>= ${args.jumps}` }
  );
  check(
    run.inputLatency.samples === args.jumps,
    `${run.id} correlates every release to a launch`,
    run.inputLatency,
    { samples: args.jumps }
  );
  check(
    run.inputToVisibleMotion.samples === args.jumps &&
      run.inputToCameraResponse.samples === args.jumps,
    `${run.id} correlates every release to visible player and camera motion`,
    {
      player: run.inputToVisibleMotion,
      camera: run.inputToCameraResponse,
    },
    { samples: args.jumps }
  );
  check(
    run.layout.maxCanvasDelta <= 0.5 &&
      run.layout.maxShellDelta <= 0.5 &&
      run.layout.maxTowerDelta <= 0.5 &&
      run.layoutShifts.score === 0,
    `${run.id} does not relayout the gameplay surface during jumps`,
    { layout: run.layout, layoutShifts: run.layoutShifts },
    { maxDelta: '<= 0.5px', layoutShiftScore: 0 }
  );

  if (run.budget === 'software-webkit') {
    check(
      run.updateTiming.p95 <= 100 && run.updateTiming.over100ms <= 1,
      `${run.id} stays inside the software-WebKit update safety budget`,
      run.updateTiming,
      { p95: '<= 100ms', over100ms: '<= 1' }
    );
    check(
      run.inputLatency.p95 <= 125,
      `${run.id} applies release input by the next software-WebKit update`,
      run.inputLatency,
      { p95: '<= 125ms' }
    );
    check(
      run.inputToVisibleMotion.p95 <= 225 &&
        run.inputToCameraResponse.p95 <= 175,
      `${run.id} presents motion within the software-WebKit response budget`,
      {
        player: run.inputToVisibleMotion,
        camera: run.inputToCameraResponse,
      },
      { playerP95: '<= 225ms', cameraP95: '<= 175ms' }
    );
    check(
      run.camera.continuous.step.p99 <= 18 &&
        run.camera.continuous.step.max <= 24 &&
        run.camera.continuous.playerScreenStep.p99 <= 60 &&
        run.camera.continuous.playerScreenStep.max <= 65,
      `${run.id} keeps continuous camera steps bounded despite slow software frames`,
      run.camera.continuous,
      {
        stepP99: '<= 18px',
        stepMax: '<= 24px',
        playerScreenStepP99: '<= 60px',
        playerScreenStepMax: '<= 65px',
      }
    );
  } else {
    const frameRatio =
      run.frameTiming.over34ms / Math.max(1, run.frameTiming.samples);
    const updateRatio =
      run.updateTiming.over34ms / Math.max(1, run.updateTiming.samples);
    check(
      run.frameTiming.p95 <= 25 && frameRatio <= 0.01,
      `${run.id} delivers browser frames without recurring stalls`,
      { ...run.frameTiming, over34msRatio: round(frameRatio) },
      { p95: '<= 25ms', over34msRatio: '<= 1%' }
    );
    check(
      run.updateTiming.p95 <= 25 && updateRatio <= 0.01,
      `${run.id} advances Phaser without recurring stalls`,
      { ...run.updateTiming, over34msRatio: round(updateRatio) },
      { p95: '<= 25ms', over34msRatio: '<= 1%' }
    );
    check(
      run.inputLatency.p95 <= 34,
      `${run.id} launches within two 60 Hz frames of release`,
      run.inputLatency,
      { p95: '<= 34ms' }
    );
    check(
      run.inputToVisibleMotion.p95 <= 50 && run.inputToCameraResponse.p95 <= 67,
      `${run.id} presents player and camera response without hidden input lag`,
      {
        player: run.inputToVisibleMotion,
        camera: run.inputToCameraResponse,
      },
      { playerP95: '<= 50ms', cameraP95: '<= 67ms' }
    );
    const mobile = run.input === 'touch';
    check(
      run.camera.continuous.step.p99 <= (mobile ? 14 : 6) &&
        run.camera.continuous.step.max <= (mobile ? 20 : 8) &&
        run.camera.continuous.playerScreenStep.p99 <= (mobile ? 16 : 15) &&
        run.camera.continuous.playerScreenStep.max <= (mobile ? 22 : 18) &&
        run.camera.continuous.acceleration.p99 <= 18_000 &&
        run.camera.continuous.acceleration.max <= 25_000,
      `${run.id} keeps camera motion continuous through charge, launch, apex, and landing`,
      run.camera.continuous,
      mobile
        ? {
            stepP99: '<= 14px',
            stepMax: '<= 20px',
            playerScreenStepP99: '<= 16px',
            playerScreenStepMax: '<= 22px',
            accelerationP99: '<= 18000',
            accelerationMax: '<= 25000',
          }
        : {
            stepP99: '<= 6px',
            stepMax: '<= 8px',
            playerScreenStepP99: '<= 15px',
            playerScreenStepMax: '<= 18px',
            accelerationP99: '<= 18000',
            accelerationMax: '<= 25000',
          }
    );
  }
}

function check(passed, name, actual, expected) {
  checks.push({ passed, name, actual, expected });
}

function percentile(sorted, ratio) {
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0
  );
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function parseArgs(values) {
  const options = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const [key, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) options.set(key, inline);
    else if (values[index + 1] && !values[index + 1].startsWith('--')) {
      options.set(key, values[++index]);
    } else options.set(key, 'true');
  }
  const repetitions = numberOption(options, 'repetitions', 1);
  const jumps = numberOption(options, 'jumps', 4);
  return {
    url: options.get('url') ?? 'http://127.0.0.1:8080/game.html',
    output: options.get('output') ?? 'output/qa/gameplay-feel',
    repetitions,
    jumps,
    video: options.get('video') === 'true',
    screenshots: options.get('screenshots') !== 'false',
    trace: options.get('trace') === 'true',
    quiet: options.get('quiet') === 'true',
    scenarios: (options.get('scenario') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

function numberOption(options, key, fallback) {
  const value = Number(options.get(key));
  if (!Number.isInteger(value) || value < 1) return fallback;
  return value;
}
