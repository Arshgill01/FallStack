import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const outputDir = path.resolve(
  args.find((value) => !value.startsWith('--')) ??
    'docs/qa/final-pass/audio-endurance'
);
const durationSeconds = Number(
  args
    .find((value) => value.startsWith('--duration-seconds='))
    ?.slice('--duration-seconds='.length) ?? 600
);
assert.ok(
  Number.isFinite(durationSeconds) && durationSeconds >= 20,
  'duration must be at least 20 seconds'
);
const durationMs = durationSeconds * 1_000;
const baseUrl = (
  process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080'
).replace(/\/$/, '');
const audioPath = path.join(outputDir, 'final-master.webm');
const spectrumPath = path.join(outputDir, 'final-master-spectrum.png');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ],
});

try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  await context.addInitScript(() => {
    localStorage.setItem('fallstack:gameplay-muted', 'false');
    localStorage.setItem('fallstack:music-muted', 'false');
    localStorage.removeItem('fallstack:muted');
    window.__fallstackAudioEvents = [];
    window.__fallstackAudioSamples = [];
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
        window.__fallstackAudioEvents.push({
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
          const game = hook.memoizedState?.current;
          const scene = game?.scene?.keys?.FallstackScene;
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
  await page.goto(`${baseUrl}/game.html?qa=audio`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () =>
      window.__fallstackFindScene?.()?.controlsReady &&
      typeof window.fallstackAudioCapture?.start === 'function' &&
      typeof window.fallstackAudioDiagnostics === 'function',
    null,
    { timeout: 30_000 }
  );
  await page.evaluate(async () => {
    await window.fallstackAudioCapture.start();
    window.__fallstackAudioSampleTimer = window.setInterval(() => {
      window.__fallstackAudioSamples.push({
        at: performance.now(),
        diagnostics: window.fallstackAudioDiagnostics(),
      });
    }, 250);
  });

  const startedAt = Date.now();
  const actions = [];
  const waitUntil = async (fraction) => {
    const remaining =
      Math.round(durationMs * fraction) - (Date.now() - startedAt);
    if (remaining > 0) await page.waitForTimeout(remaining);
  };
  const record = (name, evidenceKind, result) =>
    actions.push({
      name,
      evidenceKind,
      atMs: Date.now() - startedAt,
      result,
    });
  const setZone = async (fraction, name, zoneId) => {
    await waitUntil(fraction);
    const result = await page.evaluate((id) => {
      const scene = window.__fallstackFindScene();
      scene.restoreCheckpoint(id);
      return {
        currentZone: scene.currentZone,
        respawnZone: scene.respawnZone,
        playerY: scene.player.y,
      };
    }, zoneId);
    assert.equal(result.respawnZone, zoneId);
    record(name, 'QA-positioned production scene', result);
  };
  const charge = async (fraction, name) => {
    await waitUntil(fraction);
    await page.keyboard.down('Space');
    await page.waitForTimeout(520);
    await page.keyboard.up('Space');
    record(name, 'real keyboard input', { chargeMs: 520 });
  };
  const fall = async (fraction, name) => {
    await waitUntil(fraction);
    const previousCount = eventCount(await readEvents(page), 'fall');
    await page.evaluate(() => {
      const scene = window.__fallstackFindScene();
      scene.player.body.reset(scene.player.x, scene.player.y + 4_000);
    });
    await page.waitForFunction(
      (count) =>
        window.__fallstackAudioEvents.filter((event) => event.name === 'fall')
          .length > count,
      previousCount
    );
    record(
      name,
      'QA-positioned player, production fall detection',
      lastEvent(await readEvents(page), 'fall').detail
    );
  };
  const toggleInGuide = async (fraction, prefix) => {
    await waitUntil(fraction);
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    await page.getByRole('dialog', { name: 'How to climb' }).waitFor();
    const button = page.getByRole('button', {
      name: new RegExp(`^${prefix} `),
    });
    const before = (await button.textContent()).trim();
    await button.click();
    const off = (await button.textContent()).trim();
    const pauseMs = Math.max(350, Math.min(5_000, durationMs * 0.015));
    await page.waitForTimeout(pauseMs);
    await button.click();
    const on = (await button.textContent()).trim();
    await page.getByRole('button', { name: 'Return to climb' }).click();
    record(`${prefix.toLowerCase()}-off-on`, 'real UI input', {
      before,
      off,
      on,
      pauseMs,
    });
  };

  await setZone(0.01, 'lower-ruins', 'orbital_scrapyard');
  await charge(0.03, 'lower-ruins-launch');
  await toggleInGuide(0.13, 'SFX');
  await fall(0.24, 'opening-fall');
  await setZone(0.34, 'bell-shaft', 'ring_citadel');
  await charge(0.37, 'bell-shaft-launch');
  await waitUntil(0.46);
  const checkpoint = await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    const detail = {
      attemptId: 'qa-audio-endurance-checkpoint',
      zoneId: scene.respawnZone,
      highestY: scene.player.y,
    };
    window.dispatchEvent(new CustomEvent('fallstack:clear', { detail }));
    return detail;
  });
  record(
    'checkpoint-response',
    'QA-authored detail, production event handler',
    checkpoint
  );
  await toggleInGuide(0.56, 'Music');
  await setZone(0.66, 'moon-roof', 'black_hole_chapel');
  await charge(0.69, 'moon-roof-launch');
  await fall(0.76, 'moon-roof-fall');
  await setZone(0.86, 'summit', 'event_horizon_crown');
  await waitUntil(0.88);
  const summit = await page.evaluate(() => {
    const scene = window.__fallstackFindScene();
    scene.onLand(scene.player, {
      getData(key) {
        if (key === 'platformId' || key === 'kind') return 'summit';
        return undefined;
      },
    });
    return true;
  });
  assert.equal(summit, true);
  await page.waitForFunction(() =>
    window.__fallstackAudioEvents.some((event) => event.name === 'summit')
  );
  record(
    'summit-response',
    'QA-authored contact, production summit handler',
    lastEvent(await readEvents(page), 'summit').detail
  );
  await waitUntil(1);

  const capture = await page.evaluate(async () => {
    window.clearInterval(window.__fallstackAudioSampleTimer);
    const blob = await window.fallstackAudioCapture.stop();
    return {
      mimeType: blob.type,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      events: window.__fallstackAudioEvents,
      samples: window.__fallstackAudioSamples,
    };
  });
  assert.ok(capture.bytes.length > 1_000, 'endurance capture is not empty');
  assert.ok(
    capture.samples.some((sample) => sample.diagnostics.outputPeak > 0.001),
    'final master reports a non-silent peak'
  );
  const firstLaunch = lastEvent(
    capture.events.filter((event) => event.name === 'launch').slice(0, 1),
    'launch'
  );
  assert.equal(
    capture.events.some(
      (event) => event.name === 'land' && event.at < firstLaunch.at
    ),
    false,
    'opening settlement does not emit a landing'
  );
  assert.ok(eventCount(capture.events, 'launch') >= 3);
  assert.ok(eventCount(capture.events, 'fall') >= 2);
  assert.ok(eventCount(capture.events, 'clear') >= 1);
  assert.ok(eventCount(capture.events, 'summit') >= 1);
  assert.deepEqual(
    actions
      .filter((action) => action.name.endsWith('-off-on'))
      .map((action) => [action.result.off, action.result.on]),
    [
      ['SFX Off', 'SFX On'],
      ['Music Off', 'Music On'],
    ]
  );

  await writeFile(audioPath, Buffer.from(capture.bytes));
  const probe = await probeAudio(audioPath);
  assert.ok(probe.durationSeconds >= durationSeconds - 0.75);
  const loudness = await measureLoudness(audioPath);
  assert.ok(loudness.truePeakDbfs < -1, 'true peak remains below -1 dBFS');
  await execFileAsync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    audioPath,
    '-lavfi',
    'showspectrumpic=s=1200x600:legend=1:color=fiery:scale=log',
    spectrumPath,
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    source: {
      surface: 'local production build',
      url: `${baseUrl}/game.html?qa=audio`,
      viewport: { width: 375, height: 812 },
      interaction:
        'Real keyboard/UI input with tagged QA checkpoint positioning and production event handlers.',
    },
    requestedDurationSeconds: durationSeconds,
    enduranceGateEligible: probe.durationSeconds >= 600,
    approvalNotice:
      'Signal checks do not approve composition, timbre, repetition, fatigue, or mix taste. Human listening remains required.',
    artifact: path.relative(process.cwd(), audioPath),
    spectrum: path.relative(process.cwd(), spectrumPath),
    byteLength: capture.bytes.length,
    mimeType: capture.mimeType,
    stream: probe.stream,
    durationSeconds: probe.durationSeconds,
    loudness,
    maxOutputPeak: Math.max(
      ...capture.samples.map((sample) => sample.diagnostics.outputPeak)
    ),
    maxOutputRms: Math.max(
      ...capture.samples.map((sample) => sample.diagnostics.outputRms)
    ),
    sampledContextStates: [
      ...new Set(
        capture.samples.map((sample) => sample.diagnostics.contextState)
      ),
    ],
    actions,
    events: capture.events,
  };
  await writeFile(
    path.join(outputDir, 'audio-endurance.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        completed: true,
        outputDir,
        durationSeconds: probe.durationSeconds,
        enduranceGateEligible: report.enduranceGateEligible,
        loudness,
        actionCount: actions.length,
        launchCount: eventCount(capture.events, 'launch'),
        fallCount: eventCount(capture.events, 'fall'),
      },
      null,
      2
    )}\n`
  );
} finally {
  await browser.close();
}

async function readEvents(page) {
  return page.evaluate(() => window.__fallstackAudioEvents);
}

function eventCount(events, name) {
  return events.filter((event) => event.name === name).length;
}

function lastEvent(events, name) {
  const event = events.filter((candidate) => candidate.name === name).at(-1);
  assert.ok(event, `${name} event is present`);
  return event;
}

async function probeAudio(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,codec_type,sample_rate,channels',
    '-of',
    'json',
    filePath,
  ]);
  const probe = JSON.parse(stdout);
  const stream = probe.streams?.find(
    (candidate) => candidate.codec_type === 'audio'
  );
  assert.ok(stream, 'capture contains an audio stream');
  return { durationSeconds: Number(probe.format.duration), stream };
}

async function measureLoudness(filePath) {
  const { stderr } = await execFileAsync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostats',
      '-i',
      filePath,
      '-af',
      'ebur128=peak=true',
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 10 * 1024 * 1024 }
  );
  return {
    integratedLufs: lastMetric(stderr, /I:\s+(-?\d+(?:\.\d+)?) LUFS/g),
    loudnessRangeLu: lastMetric(stderr, /LRA:\s+(-?\d+(?:\.\d+)?) LU/g),
    truePeakDbfs: lastMetric(stderr, /Peak:\s+(-?\d+(?:\.\d+)?) dBFS/g),
  };
}

function lastMetric(output, pattern) {
  const matches = [...output.matchAll(pattern)];
  assert.ok(matches.length > 0, `FFmpeg metric ${pattern} is present`);
  return Number(matches.at(-1)[1]);
}
