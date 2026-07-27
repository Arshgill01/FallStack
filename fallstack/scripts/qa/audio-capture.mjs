import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);
const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/audio-capture'
);
const audioPath = path.join(outputDir, 'final-master.webm');
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
    for (const name of ['ready', 'charge', 'launch', 'land', 'fall']) {
      window.addEventListener(`fallstack:${name}`, (event) => {
        window.__fallstackAudioEvents.push({
          name,
          at: performance.now(),
          detail: event.detail ?? null,
        });
      });
    }
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/game.html?qa=audio', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__fallstackAudioEvents.some((event) => event.name === 'ready'),
    null,
    { timeout: 30_000 }
  );

  await page.evaluate(async () => {
    if (
      !window.fallstackAudioCapture ||
      typeof window.fallstackAudioCapture.start !== 'function'
    ) {
      throw new Error(
        'Final-master capture is unavailable. Rebuild with the ?qa=audio capture seam.'
      );
    }
    await window.fallstackAudioCapture.start();
  });

  await page.keyboard.down('Space');
  await page.waitForTimeout(260);
  await page.keyboard.up('Space');

  const diagnostics = [];
  for (let elapsed = 0; elapsed < 5_500; elapsed += 100) {
    diagnostics.push(await page.evaluate(() => window.fallstackAudioDiagnostics?.()));
    await page.waitForTimeout(100);
  }

  const capture = await page.evaluate(async () => {
    if (
      !window.fallstackAudioCapture ||
      typeof window.fallstackAudioCapture.stop !== 'function'
    ) {
      throw new Error('Final-master capture stopped being available.');
    }
    const blob = await window.fallstackAudioCapture.stop();
    return {
      mimeType: blob.type,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      events: window.__fallstackAudioEvents,
    };
  });

  assert.ok(capture.bytes.length > 1_000, 'captured audio is not empty');
  assert.ok(
    diagnostics.some((sample) => (sample?.outputPeak ?? 0) > 0.001),
    'final master reports a non-silent peak'
  );
  assert.ok(
    diagnostics.some((sample) => (sample?.outputRms ?? 0) > 0.0001),
    'final master reports non-silent RMS'
  );
  const launch = capture.events.find((event) => event.name === 'launch');
  assert.ok(launch, 'captured interaction includes a launch');
  assert.equal(
    capture.events.some(
      (event) => event.name === 'land' && event.at < launch.at
    ),
    false,
    'settling the opening checkpoint does not emit a landing'
  );
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
  assert.ok(audioStream, 'capture contains an audio stream');
  assert.ok(Number(probe.format?.duration) >= 5, 'capture spans the interaction');

  const report = {
    generatedAt: new Date().toISOString(),
    artifact: path.relative(process.cwd(), audioPath),
    byteLength: capture.bytes.length,
    mimeType: capture.mimeType,
    stream: audioStream,
    durationSeconds: Number(probe.format.duration),
    maxOutputPeak: Math.max(
      ...diagnostics.map((sample) => sample?.outputPeak ?? 0)
    ),
    maxOutputRms: Math.max(
      ...diagnostics.map((sample) => sample?.outputRms ?? 0)
    ),
    events: capture.events,
  };
  await writeFile(
    path.join(outputDir, 'audio-capture.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
