import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, webkit } from 'playwright';
import { captureScreenshot } from './capture-screenshot.mjs';

const args = process.argv.slice(2);
const outputDir = path.resolve(
  args.find((value) => !value.startsWith('--')) ?? 'output/qa/frame-pacing'
);
const url =
  args.find((value) => value.startsWith('--url='))?.slice('--url='.length) ??
  'http://127.0.0.1:8080/game.html';
const repetitions = Number(
  args
    .find((value) => value.startsWith('--repetitions='))
    ?.slice('--repetitions='.length) ?? 2
);
const screenshots = !args.includes('--screenshots=false');
if (!Number.isInteger(repetitions) || repetitions < 1)
  throw new Error(`Invalid repetition count: ${repetitions}`);

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const CONTROL_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/605.1.15';
const scenarios = [
  {
    name: 'chromium-generic-desktop',
    browserName: 'chromium',
  },
  {
    name: 'webkit-safari-profile',
    browserName: 'webkit',
  },
  {
    name: 'webkit-generic-desktop',
    browserName: 'webkit',
    userAgent: CONTROL_USER_AGENT,
  },
];

await mkdir(outputDir, { recursive: true });
const browsers = {
  chromium: await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  }),
  webkit: await webkit.launch({ headless: true }),
};
const runs = [];
const checks = [];

try {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const scenario of scenarios) {
      const run = await runScenario({
        ...scenario,
        repetition,
        browser: browsers[scenario.browserName],
      });
      runs.push(run);
    }
  }

  for (const run of runs) {
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
      run.events.launches === 3 && run.events.lands + run.events.falls >= 3,
      `${run.id} completes three real keyboard launches and recoveries`,
      run.events,
      { launches: 3, outcomes: '>= 3' }
    );
  }

  const chromiumRuns = runs.filter(
    (run) => run.name === 'chromium-generic-desktop'
  );
  for (const run of chromiumRuns) {
    check(
      run.surface.profile === 'desktop-canvas-budget' &&
        run.surface.renderScale > 1 &&
        run.surface.renderScale < 2 &&
        run.surface.backingPixels <= 1_602_000,
      `${run.id} uses the bounded desktop Canvas profile`,
      run.surface,
      {
        profile: 'desktop-canvas-budget',
        renderScale: '> 1 and < 2',
        backingPixels: '<= 1,602,000',
      }
    );
    check(
      run.activeFrames.effectiveFps >= 55 &&
        run.activeFrames.medianMs <= 19 &&
        run.activeFrames.p95Ms <= 28,
      `${run.id} stays inside the Chromium frame budget`,
      run.activeFrames,
      { effectiveFps: '>= 55', medianMs: '<= 19', p95Ms: '<= 28' }
    );
  }

  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const candidate = runs.find(
      (run) =>
        run.name === 'webkit-safari-profile' && run.repetition === repetition
    );
    const generic = runs.find(
      (run) =>
        run.name === 'webkit-generic-desktop' && run.repetition === repetition
    );
    if (!candidate || !generic)
      throw new Error(`Missing WebKit pair ${repetition}`);

    check(
      candidate.surface.profile === 'desktop-safari-canvas' &&
        candidate.surface.renderScale === 1 &&
        closeTo(candidate.surface.backingScale, 1) &&
        candidate.surface.backingPixels <= 565_000,
      `${candidate.id} activates the desktop Safari profile`,
      candidate.surface,
      {
        profile: 'desktop-safari-canvas',
        renderScale: 1,
        backingScale: 1,
        backingPixels: '<= 565,000',
      }
    );
    check(
      generic.surface.profile === 'desktop-canvas-budget' &&
        generic.surface.renderScale > 1 &&
        generic.surface.renderScale < 2 &&
        generic.surface.backingPixels <= 1_602_000,
      `${generic.id} uses the engine-independent Canvas budget`,
      generic.surface,
      {
        profile: 'desktop-canvas-budget',
        renderScale: '> 1 and < 2',
        backingPixels: '<= 1,602,000',
      }
    );
    check(
      candidate.activeFrames.medianMs <= 95 &&
        candidate.activeFrames.p95Ms <= 135 &&
        candidate.activeFrames.over120ms <= 2,
      `${candidate.id} stays inside the software-WebKit safety budget`,
      candidate.activeFrames,
      { medianMs: '<= 95', p95Ms: '<= 135', over120ms: '<= 2' }
    );
    check(
      generic.activeFrames.medianMs <= 95 &&
        generic.activeFrames.p95Ms <= 135 &&
        generic.activeFrames.over120ms <= 2,
      `${generic.id} stays inside the generic software-WebKit safety budget`,
      generic.activeFrames,
      { medianMs: '<= 95', p95Ms: '<= 135', over120ms: '<= 2' }
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    url,
    repetitions,
    screenshotsEnabled: screenshots,
    note: 'Playwright WebKit on Linux is a software-composited compatibility runner, not Mac Safari hardware. Its loose ceiling detects severe regressions only; gameplay-feel.mjs owns cross-engine input, update, camera, and presentation gates.',
    passed: checks.every((item) => item.passed),
    checks,
    runs,
  };
  await writeFile(
    path.join(outputDir, 'frame-pacing.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  const failures = checks.filter((item) => !item.passed);
  if (failures.length > 0)
    throw new Error(
      `Frame-pacing gate failed: ${failures.map((item) => item.name).join('; ')}`
    );
} finally {
  await Promise.all(Object.values(browsers).map((browser) => browser.close()));
}

async function runScenario(input) {
  const context = await input.browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: 2,
    userAgent: input.userAgent,
  });
  await installProbe(context);
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () =>
        window.__fallstackFindScene?.()?.controlsReady &&
        document.querySelector('#game-canvas canvas') &&
        !document.querySelector('.loading-overlay'),
      null,
      { timeout: 30_000 }
    );
    await page.waitForTimeout(400);

    const surface = await page.evaluate(() => {
      const container = document.querySelector('#game-canvas');
      const canvas = container.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      const scene = window.__fallstackFindScene();
      return {
        buildId: window.fallstackBuildId,
        profile: container.dataset.renderProfile,
        renderScale: Number(container.dataset.renderScale),
        rendererType: scene.game.renderer.type,
        devicePixelRatio: window.devicePixelRatio,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        backing: { width: canvas.width, height: canvas.height },
        css: { width: rect.width, height: rect.height },
        backingPixels: canvas.width * canvas.height,
        backingScale: canvas.width / rect.width,
        userAgent: navigator.userAgent,
      };
    });
    const idleFrames = await measureFrames(page, 2_500);

    await page.evaluate(() => {
      const probe = {
        intervals: [],
        previous: performance.now(),
        running: true,
      };
      window.__fallstackActiveFrameProbe = probe;
      const frame = (now) => {
        if (!probe.running) return;
        probe.intervals.push(now - probe.previous);
        probe.previous = now;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    for (const direction of ['ArrowRight', 'ArrowLeft', 'ArrowRight']) {
      await page.waitForFunction(
        () => {
          const scene = window.__fallstackFindScene();
          const body = scene.player.body;
          return (
            !scene.charging &&
            (body.blocked.down || body.touching.down) &&
            Math.abs(body.velocity.y) < 2
          );
        },
        null,
        { timeout: input.browserName === 'webkit' ? 12_000 : 6_000 }
      );
      const before = await page.evaluate(() => ({
        launches: window.__fallstackFrameQa.launches,
        outcomes:
          window.__fallstackFrameQa.lands + window.__fallstackFrameQa.falls,
      }));
      await page.keyboard.down(direction);
      await page.keyboard.down('Space');
      await page.waitForTimeout(180);
      await page.keyboard.up(direction);
      await page.keyboard.up('Space');
      await page.waitForFunction(
        (count) => window.__fallstackFrameQa.launches > count,
        before.launches,
        { timeout: input.browserName === 'webkit' ? 5_000 : 2_500 }
      );
      await page.waitForFunction(
        (count) =>
          window.__fallstackFrameQa.lands + window.__fallstackFrameQa.falls >
          count,
        before.outcomes,
        { timeout: input.browserName === 'webkit' ? 12_000 : 6_000 }
      );
    }

    const activeIntervals = await page.evaluate(() => {
      const probe = window.__fallstackActiveFrameProbe;
      probe.running = false;
      return probe.intervals.slice(1);
    });
    const id = `${input.name}-${input.repetition}`;
    if (screenshots && input.repetition === 1)
      await captureScreenshot(page, {
        locator: page.locator('#game-canvas canvas'),
        path: path.join(outputDir, `${input.name}.png`),
      });

    return {
      id,
      name: input.name,
      browserName: input.browserName,
      browserVersion: input.browser.version(),
      repetition: input.repetition,
      surface,
      idleFrames,
      activeFrames: summarize(activeIntervals),
      events: await page.evaluate(() => ({ ...window.__fallstackFrameQa })),
      pageErrors,
      consoleErrors,
      unexpectedConsoleErrors: consoleErrors.filter(
        (message) => !message.startsWith('Failed to load resource:')
      ),
    };
  } finally {
    await context.close();
  }
}

async function installProbe(context) {
  await context.addInitScript(() => {
    window.__fallstackFrameQa = { launches: 0, lands: 0, falls: 0 };
    const eventCounters = {
      launch: 'launches',
      land: 'lands',
      fall: 'falls',
    };
    for (const [eventName, counter] of Object.entries(eventCounters)) {
      window.addEventListener(`fallstack:${eventName}`, () => {
        window.__fallstackFrameQa[counter] += 1;
      });
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
  });
}

async function measureFrames(page, durationMs) {
  const intervals = await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const values = [];
        let previous = performance.now();
        const started = previous;
        const frame = (now) => {
          values.push(now - previous);
          previous = now;
          if (now - started >= duration) resolve(values.slice(1));
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    durationMs
  );
  return summarize(intervals);
}

function summarize(intervals) {
  const sorted = [...intervals].sort((left, right) => left - right);
  const totalMs = intervals.reduce((total, value) => total + value, 0);
  return {
    samples: intervals.length,
    effectiveFps: round((intervals.length * 1_000) / totalMs),
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    maxMs: round(sorted.at(-1) ?? 0),
    over34ms: intervals.filter((value) => value > 34).length,
    over50ms: intervals.filter((value) => value > 50).length,
    over100ms: intervals.filter((value) => value > 100).length,
    over120ms: intervals.filter((value) => value > 120).length,
  };
}

function percentile(sorted, ratio) {
  return (
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0
  );
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function closeTo(actual, expected) {
  return Math.abs(actual - expected) <= 0.01;
}

function check(passed, name, actual, expected) {
  checks.push({ passed, name, actual, expected });
}
