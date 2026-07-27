import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/audio-palette'
);
const label = process.argv[3] ?? 'current';
const audioPath = path.join(outputDir, `${label}.webm`);
const baseUrl = process.env.FALLSTACK_QA_BASE_URL ?? 'http://127.0.0.1:8080';
await mkdir(outputDir, { recursive: true });

const cues = [
  {
    name: 'charge-cancel',
    id: 'charge-start',
    detail: {},
    chargeMs: 360,
    cancel: true,
    reviewMs: 760,
  },
  {
    name: 'launch-low',
    id: 'launch',
    detail: { chargePercent: 42 },
    chargeMs: 200,
    reviewMs: 800,
  },
  {
    name: 'launch-mid',
    id: 'launch',
    detail: { chargePercent: 68 },
    chargeMs: 520,
    reviewMs: 1_120,
  },
  {
    name: 'launch-full',
    id: 'launch',
    detail: { chargePercent: 100 },
    chargeMs: 900,
    reviewMs: 1_520,
  },
  {
    name: 'land-stone-soft',
    id: 'land',
    detail: {
      zoneId: 'orbital_scrapyard',
      material: 'stone',
      surface: 'route',
      impactSpeed: 180,
    },
    reviewMs: 520,
  },
  {
    name: 'land-stone-hard',
    id: 'land',
    detail: {
      zoneId: 'orbital_scrapyard',
      material: 'stone',
      surface: 'route',
      impactSpeed: 920,
    },
    reviewMs: 560,
  },
  {
    name: 'land-metal',
    id: 'land',
    detail: {
      zoneId: 'pulsar_spine',
      material: 'metal',
      surface: 'route',
      impactSpeed: 620,
    },
    reviewMs: 560,
  },
  {
    name: 'land-ghost',
    id: 'land',
    detail: {
      zoneId: 'comet_reef',
      material: 'ghost',
      surface: 'artifact',
      impactSpeed: 520,
    },
    reviewMs: 620,
  },
  {
    name: 'wall-bonk',
    id: 'wall-bonk',
    detail: {
      zoneId: 'crater_foundry',
      side: 'right',
      impactSpeed: 360,
    },
    reviewMs: 520,
  },
  {
    name: 'ghost-collapse',
    id: 'artifact-collapse',
    detail: {
      zoneId: 'comet_reef',
      artifactType: 'ghost_platform',
    },
    reviewMs: 620,
  },
  {
    name: 'cursed-collapse',
    id: 'artifact-collapse',
    detail: {
      zoneId: 'nebula_vault',
      artifactType: 'cursed_brick',
    },
    reviewMs: 620,
  },
  { name: 'fall', id: 'fall', detail: {}, reviewMs: 620 },
  { name: 'mutation-stamp', id: 'mutation', detail: {}, reviewMs: 560 },
  { name: 'checkpoint', id: 'checkpoint', detail: {}, reviewMs: 760 },
  { name: 'summit', id: 'summit', detail: {}, reviewMs: 1_200 },
];

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
    localStorage.setItem('fallstack:music-muted', 'true');
    localStorage.removeItem('fallstack:muted');
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/game.html?qa=audio`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () =>
      typeof window.fallstackAudioCapture?.start === 'function' &&
      typeof window.fallstackAudioDiagnostics === 'function',
    null,
    { timeout: 30_000 }
  );
  await page.evaluate(() => window.fallstackAudioCapture.start());

  const results = [];
  for (const cue of cues) {
    const play = async (id, detail) =>
      page.evaluate(
        ({ id, detail }) => {
          if (typeof window.fallstackAudioPreview === 'function') {
            window.fallstackAudioPreview(id, detail);
            return 'qa-preview-api';
          }

          const root = document.querySelector('#root');
          const containerKey = root
            ? Object.keys(root).find((key) =>
                key.startsWith('__reactContainer$')
              )
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
              if (
                candidate &&
                typeof candidate.play === 'function' &&
                typeof candidate.startCapture === 'function'
              ) {
                candidate.play(id, id === 'land' ? detail.zoneId : undefined);
                return 'legacy-react-ref';
              }
              hook = hook.next;
            }
            if (fiber.child) stack.push(fiber.child);
            if (fiber.sibling) stack.push(fiber.sibling);
          }
          throw new Error('ProceduralSound was not discoverable.');
        },
        { id, detail }
      );
    const stopCharge = async () =>
      page.evaluate(() => {
        if (typeof window.fallstackAudioStopPreview === 'function') {
          window.fallstackAudioStopPreview();
          return 'qa-preview-api';
        }

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
            if (
              candidate &&
              typeof candidate.stopCharge === 'function' &&
              typeof candidate.startCapture === 'function'
            ) {
              candidate.stopCharge();
              return 'legacy-react-ref';
            }
            hook = hook.next;
          }
          if (fiber.child) stack.push(fiber.child);
          if (fiber.sibling) stack.push(fiber.sibling);
        }
        throw new Error('ProceduralSound was not discoverable.');
      });

    let playbackPath;
    if (cue.chargeMs !== undefined) {
      playbackPath = await play('charge-start', {});
    } else {
      playbackPath = await play(cue.id, cue.detail);
    }

    const samples = [];
    let chargeResolved = cue.chargeMs === undefined;
    for (let elapsed = 0; elapsed < cue.reviewMs; elapsed += 40) {
      if (!chargeResolved && elapsed >= cue.chargeMs) {
        playbackPath = cue.cancel
          ? await stopCharge()
          : await play(cue.id, cue.detail);
        chargeResolved = true;
      }
      samples.push(
        await page.evaluate(() => window.fallstackAudioDiagnostics())
      );
      await page.waitForTimeout(40);
    }
    const maxPeak = Math.max(...samples.map((sample) => sample.outputPeak));
    const maxRms = Math.max(...samples.map((sample) => sample.outputRms));
    assert.ok(maxPeak > 0.001, `${cue.name} produces audible signal`);
    results.push({
      name: cue.name,
      id: cue.id,
      detail: cue.detail,
      chargeMs: cue.chargeMs,
      cancel: cue.cancel ?? false,
      playbackPath,
      maxPeak,
      maxRms,
    });
    await page.waitForTimeout(120);
  }

  const capture = await page.evaluate(async () => {
    const blob = await window.fallstackAudioCapture.stop();
    return {
      mimeType: blob.type,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    };
  });
  assert.ok(capture.bytes.length > 1_000, 'palette capture is not empty');
  await writeFile(audioPath, Buffer.from(capture.bytes));

  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,codec_type,sample_rate,channels',
    '-of',
    'json',
    audioPath,
  ]);
  const probe = JSON.parse(stdout);
  const audioStream = probe.streams?.find(
    (stream) => stream.codec_type === 'audio'
  );
  assert.ok(audioStream, 'palette capture contains audio');

  const report = {
    generatedAt: new Date().toISOString(),
    label,
    artifact: path.relative(process.cwd(), audioPath),
    byteLength: capture.bytes.length,
    mimeType: capture.mimeType,
    stream: audioStream,
    durationSeconds: Number(probe.format.duration),
    cues: results,
  };
  await writeFile(
    path.join(outputDir, `${label}.json`),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
