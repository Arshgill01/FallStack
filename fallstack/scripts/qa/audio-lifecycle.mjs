import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/qa/final-pass/audio-lifecycle'
);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const failures = [];
const report = {
  generatedAt: new Date().toISOString(),
  legacyAndOwnership: null,
  immediateMute: null,
  rapidMusicToggle: null,
  closedContextRecovery: null,
};

try {
  report.legacyAndOwnership = await probeLegacyAndOwnership();
  check(
    report.legacyAndOwnership.sfxLabel === 'SFX On',
    'an explicit new SFX preference wins over the legacy combined mute'
  );
  check(
    report.legacyAndOwnership.legacyValue === null,
    'the legacy combined mute key is removed after migration'
  );
  check(
    report.legacyAndOwnership.contextCount === 1,
    'Fallstack creates one intentional AudioContext'
  );

  report.immediateMute = await probeImmediateMute();
  check(
    report.immediateMute.sourcesStartedAfterMute === 0,
    'SFX Off prevents every queued launch source from starting'
  );

  report.rapidMusicToggle = await probeRapidMusicToggle();
  check(
    report.rapidMusicToggle.activeOscillators <= 5,
    'rapid Music Off/On leaves one drone and bell graph'
  );

  report.closedContextRecovery = await probeClosedContextRecovery();
  check(
    report.closedContextRecovery.pageErrors.length === 0,
    'closed-context recovery emits no page errors'
  );
  check(
    report.closedContextRecovery.contextCount === 2,
    'closed custom audio is replaced by exactly one new context'
  );
  check(
    report.closedContextRecovery.startsAfterClose >= 1,
    'charge audio starts after closed-context recovery'
  );

  report.failures = failures;
  await writeFile(
    path.join(outputDir, 'audio-lifecycle.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}

async function probeLegacyAndOwnership() {
  const context = await instrumentedContext({
    gameplayMuted: 'false',
    musicMuted: 'false',
    legacyMuted: 'true',
  });
  const page = await context.newPage();
  await loadReady(page);
  await page.getByRole('button', { name: 'Guide' }).click();
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => ({
    sfxLabel: [...document.querySelectorAll('button')]
      .find((button) => button.textContent?.startsWith('SFX '))
      ?.textContent?.trim(),
    legacyValue: localStorage.getItem('fallstack:muted'),
    contextCount: window.__fallstackAudioProbe.contexts.length,
  }));
  await context.close();
  return result;
}

async function probeImmediateMute() {
  const context = await instrumentedContext({
    gameplayMuted: 'false',
    musicMuted: 'true',
    legacyMuted: null,
  });
  const page = await context.newPage();
  await loadReady(page);
  await page.getByRole('button', { name: 'Guide' }).click();
  const muteState = await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('fallstack:launch'));
    const sfx = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('SFX On')
    );
    sfx?.click();
    return {
      mutedAt: performance.now(),
      startsAtMute: window.__fallstackAudioProbe.starts.length,
    };
  });
  await page.waitForTimeout(120);
  const result = await page.evaluate(
    ({ mutedAt, startsAtMute }) => ({
      sourcesStartedAtMute: startsAtMute,
      sourcesStartedAfterMute: window.__fallstackAudioProbe.starts.filter(
        (entry) => entry.at > mutedAt
      ).length,
      starts: window.__fallstackAudioProbe.starts,
      diagnostics: window.fallstackAudioDiagnostics?.(),
    }),
    muteState
  );
  await context.close();
  return result;
}

async function probeRapidMusicToggle() {
  const context = await instrumentedContext({
    gameplayMuted: 'true',
    musicMuted: 'false',
    legacyMuted: null,
  });
  const page = await context.newPage();
  await loadReady(page);
  await page.getByRole('button', { name: 'Guide' }).click();
  await page.waitForTimeout(200);
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.getByRole('button', { name: 'Music On' }).click();
    await page.getByRole('button', { name: 'Music Off' }).click();
  }
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => ({
    activeOscillators: window.__fallstackAudioProbe.activeOscillators,
    totalSourceStarts: window.__fallstackAudioProbe.starts.length,
    totalOscillatorStarts: window.__fallstackAudioProbe.starts.filter(
      (entry) => entry.kind === 'oscillator'
    ).length,
    diagnostics: window.fallstackAudioDiagnostics?.(),
  }));
  await context.close();
  return result;
}

async function probeClosedContextRecovery() {
  const context = await instrumentedContext({
    gameplayMuted: 'false',
    musicMuted: 'true',
    legacyMuted: null,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await loadReady(page);
  await page.getByRole('button', { name: 'Guide' }).click();
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('fallstack:charge', { detail: { percent: 40 } })
    );
  });
  await page.waitForTimeout(80);
  const closedAt = await page.evaluate(async () => {
    await Promise.all(
      window.__fallstackAudioProbe.contexts.map((context) => context.close())
    );
    return performance.now();
  });
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('fallstack:charge', { detail: { percent: 0 } })
    );
    window.dispatchEvent(
      new CustomEvent('fallstack:charge', { detail: { percent: 40 } })
    );
  });
  await page.waitForTimeout(120);
  const result = await page.evaluate(
    ({ closedAt, pageErrors }) => ({
      contextCount: window.__fallstackAudioProbe.contexts.length,
      startsAfterClose: window.__fallstackAudioProbe.starts.filter(
        (entry) => entry.at > closedAt
      ).length,
      diagnostics: window.fallstackAudioDiagnostics?.(),
      pageErrors,
    }),
    { closedAt, pageErrors }
  );
  await context.close();
  return result;
}

async function instrumentedContext({
  gameplayMuted,
  musicMuted,
  legacyMuted,
}) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
  });
  await context.addInitScript(
    ({ gameplayMuted, musicMuted, legacyMuted }) => {
      localStorage.setItem('fallstack:gameplay-muted', gameplayMuted);
      localStorage.setItem('fallstack:music-muted', musicMuted);
      if (legacyMuted === null) localStorage.removeItem('fallstack:muted');
      else localStorage.setItem('fallstack:muted', legacyMuted);

      window.__fallstackReady = false;
      window.addEventListener('fallstack:ready', () => {
        window.__fallstackReady = true;
      });
      window.__fallstackAudioProbe = {
        contexts: [],
        starts: [],
        activeOscillators: 0,
      };
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(...args) {
          super(...args);
          window.__fallstackAudioProbe.contexts.push(this);
          const createOscillator = this.createOscillator.bind(this);
          this.createOscillator = () => {
            const oscillator = createOscillator();
            const start = oscillator.start.bind(oscillator);
            oscillator.start = (...startArgs) => {
              window.__fallstackAudioProbe.starts.push({
                at: performance.now(),
                kind: 'oscillator',
              });
              window.__fallstackAudioProbe.activeOscillators += 1;
              oscillator.addEventListener(
                'ended',
                () => {
                  window.__fallstackAudioProbe.activeOscillators -= 1;
                },
                { once: true }
              );
              return start(...startArgs);
            };
            return oscillator;
          };
          const createBufferSource = this.createBufferSource.bind(this);
          this.createBufferSource = () => {
            const source = createBufferSource();
            const start = source.start.bind(source);
            source.start = (...startArgs) => {
              window.__fallstackAudioProbe.starts.push({
                at: performance.now(),
                kind: 'buffer',
              });
              return start(...startArgs);
            };
            return source;
          };
        }
      };
    },
    { gameplayMuted, musicMuted, legacyMuted }
  );
  return context;
}

async function loadReady(page) {
  await page.goto('http://127.0.0.1:8080/game.html', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__fallstackReady, null, {
    timeout: 30_000,
  });
}

function check(condition, message) {
  if (!condition) failures.push(message);
}
