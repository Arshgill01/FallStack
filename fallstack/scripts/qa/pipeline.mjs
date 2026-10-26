// One-command gameplay QA: build, serve dist/client, then let the playthrough
// bot actually climb the tower on phone and desktop profiles with simulated
// concurrent players and phone-class CPU. Fails on page errors, off-screen
// ledges, framing/visibility regressions, landing hitches, or stalled climbs.
//
//   npm run qa:pipeline                 quick pass (first ~60 jumps per profile)
//   npm run qa:pipeline -- --full       climb to the summit on every profile
//   npm run qa:pipeline -- --profiles iphone,laptop --skip-build
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const PROFILES = {
  iphone: { width: 390, height: 844, dpr: 3, touch: true, cpu: 4 },
  android: { width: 412, height: 915, dpr: 2.625, touch: true, cpu: 4 },
  'small-phone': { width: 360, height: 640, dpr: 2, touch: true, cpu: 4 },
  laptop: { width: 1440, height: 900, dpr: 2, touch: false, cpu: 1 },
  desktop: { width: 1280, height: 800, dpr: 1, touch: false, cpu: 1 },
};

// Share of landings allowed to contain a frame of at least hitchMs.
const MAX_LANDING_HITCH_RATE = 0.1;

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(import.meta.dirname, '../..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputDir = path.resolve(
  root,
  args.output ?? `docs/qa/pipeline/${stamp}`
);
const selected = (args.profiles ?? Object.keys(PROFILES).join(','))
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
for (const name of selected)
  if (!PROFILES[name])
    throw new Error(
      `Unknown profile "${name}". Known: ${Object.keys(PROFILES).join(', ')}`
    );

if (!args['skip-build']) {
  await run('npm', ['run', 'type-check']);
  await run('npm', ['run', 'build']);
}
await mkdir(outputDir, { recursive: true });

const server = await serveStatic(path.join(root, 'dist/client'));
const baseUrl = `http://127.0.0.1:${server.address().port}/game.html`;
const results = [];
try {
  for (const name of selected) {
    const profile = PROFILES[name];
    const profileDir = path.join(outputDir, name);
    const botArgs = [
      'scripts/qa/full-playthrough.mjs',
      '--url',
      baseUrl,
      '--output',
      profileDir,
      '--width',
      String(profile.width),
      '--height',
      String(profile.height),
      '--device-scale-factor',
      String(profile.dpr),
      '--cpu-throttle',
      String(profile.cpu),
      '--mock-api',
      'true',
      '--remote-fall-ms',
      String(args['remote-fall-ms'] ?? 1500),
      '--canvas',
      'false',
      '--require-summit',
      args.full ? 'true' : 'false',
      '--max-jumps',
      String(args.full ? 1500 : Number(args['max-jumps'] ?? 60)),
      ...(profile.touch
        ? ['--mobile', 'true', '--touch', 'true', '--input', 'touch']
        : []),
    ];
    process.stdout.write(
      `\n▶ ${name} (${profile.width}x${profile.height} @${profile.dpr}x, cpu ${profile.cpu}x)\n`
    );
    const started = Date.now();
    const exitCode = await run('node', botArgs, { allowFailure: true });
    results.push(
      await collect(name, profile, profileDir, exitCode, Date.now() - started)
    );
  }
} finally {
  server.close();
}

const summary = renderSummary(results);
await writeFile(path.join(outputDir, 'summary.md'), summary);
await writeFile(
  path.join(outputDir, 'summary.json'),
  `${JSON.stringify(results, null, 2)}\n`
);
process.stdout.write(
  `\n${summary}\nReport: ${path.relative(root, outputDir)}/summary.md\n`
);
if (results.some((result) => result.problems.length > 0)) process.exitCode = 1;

async function collect(name, profile, dir, exitCode, elapsedMs) {
  const report =
    (await readJson(path.join(dir, 'playthrough.json'))) ??
    (await readJson(path.join(dir, 'failure.json')));
  const problems = [];
  if (!report) {
    problems.push('bot produced no report');
    return { name, profile, exitCode, elapsedMs, problems };
  }
  if (report.error)
    problems.push(`bot crashed: ${report.error.message ?? report.error}`);
  const frames = report.frameStats ?? {};
  const hitchRate = frames.landings
    ? frames.landingHitchCount / frames.landings
    : 0;
  if (report.pageErrors?.length)
    problems.push(
      `${report.pageErrors.length} page error(s): ${report.pageErrors[0]}`
    );
  if (report.framingFailures?.length)
    problems.push(
      `${report.framingFailures.length} landing(s) left the next ledge under the HUD`
    );
  if (report.visibilityFailures?.length)
    problems.push(
      `${report.visibilityFailures.length} moment(s) with the player outside the frame`
    );
  if (report.targetVisibilityFailures?.length)
    problems.push(
      `${report.targetVisibilityFailures.length} jump(s) where the target ledge was off-screen`
    );
  if (hitchRate > MAX_LANDING_HITCH_RATE)
    problems.push(
      `${Math.round(hitchRate * 100)}% of landings hitched (worst ${frames.worstLandingFrameMs}ms)`
    );
  const joltRate = frames.landings
    ? frames.landingCameraJoltCount / frames.landings
    : 0;
  if (joltRate > MAX_LANDING_HITCH_RATE)
    problems.push(
      `${Math.round(joltRate * 100)}% of landings jolted the camera (worst ${frames.worstLandingCameraJumpPx}px in one frame)`
    );
  if (args.full && !report.completed) problems.push('did not reach the summit');
  if (report.mockApi?.errors?.length)
    problems.push(
      `${report.mockApi.errors.length} rejected API call(s): ${report.mockApi.errors[0]}`
    );
  return {
    name,
    profile,
    exitCode,
    elapsedMs,
    completed: Boolean(report.completed),
    jumps: report.totalJumps ?? report.landings?.length ?? 0,
    falls: report.failureCount ?? report.failures?.length ?? 0,
    zone: report.finalState?.currentZone ?? null,
    frames,
    hitchRate: Math.round(hitchRate * 1000) / 10,
    remoteFalls: report.mockApi?.remoteFalls ?? 0,
    problems,
  };
}

function renderSummary(rows) {
  const lines = [
    `# Gameplay pipeline: ${rows.every((row) => row.problems.length === 0) ? 'PASS' : 'FAIL'}`,
    '',
    `Mode: ${args.full ? 'full climb' : 'quick'} · ${new Date().toISOString()}`,
    '',
    '| Profile | Jumps | Falls | Reached | Median frame | p95 frame | Landing hitches | Worst landing frame | Landing camera jolts | Problems |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const f = row.frames ?? {};
    lines.push(
      `| ${row.name} | ${row.jumps ?? '–'} | ${row.falls ?? '–'} | ${row.completed ? 'summit' : (row.zone ?? '–')} | ${f.medianFrameMs ?? '–'}ms | ${f.p95FrameMs ?? '–'}ms | ${f.landingHitchCount ?? 0}/${f.landings ?? 0} (${row.hitchRate ?? 0}%) | ${f.worstLandingFrameMs ?? '–'}ms | ${f.landingCameraJoltCount ?? 0} (worst ${f.worstLandingCameraJumpPx ?? 0}px) | ${row.problems.length} |`
    );
  }
  for (const row of rows.filter((candidate) => candidate.problems.length)) {
    lines.push(
      '',
      `## ${row.name}`,
      '',
      ...row.problems.map((problem) => `- ${problem}`)
    );
  }
  return `${lines.join('\n')}\n`;
}

function serveStatic(dir) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
  };
  const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://x').pathname
    );
    const file = path.join(
      dir,
      path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
    );
    try {
      if (!file.startsWith(dir) || !(await stat(file)).isFile())
        throw new Error('missing');
      response.writeHead(200, {
        'content-type': types[path.extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve(server))
  );
}

function run(command, commandArgs, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0 || allowFailure) resolve(code ?? 1);
      else
        reject(new Error(`${command} ${commandArgs.join(' ')} exited ${code}`));
    });
  });
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2);
    if (inline !== undefined) values[key] = inline;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--'))
      values[key] = argv[++index];
    else values[key] = true;
  }
  return values;
}
