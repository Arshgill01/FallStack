// Connectivity map: simulate several community days through the real API and
// report every cause→effect edge of the shared mutation layer, which edges
// hold, which are known gaps, and where the design is under pressure.
//
//   npm run qa:connectivity                  5 days × 3 seeds, 60 climbers
//   npm run qa:connectivity -- --days 1 --seeds 1 --skip-build
//   npm run qa:connectivity -- --players 120 --steps 5000
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(import.meta.dirname, '../..');
const days = Number(args.days ?? 5);
const seeds = Number(args.seeds ?? 3);
const players = Number(args.players ?? 60);
const steps = Number(args.steps ?? 2500);
const start = args.start ?? new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outputDir = path.resolve(
  root,
  args.output ?? `docs/qa/connectivity/${stamp}`
);

if (!args['skip-build']) await run('npx', ['tsc', '--build']);
const testing = (file) =>
  import(
    pathToFileURL(path.join(root, 'dist/types/server/testing', file)).href
  );
const { runCommunitySimulation } = await testing('simulation.js');
const { CONNECTIVITY_EDGES, KNOWN_CONNECTIVITY_GAPS } = await testing(
  'connectivity-contract.js'
);

const runs = [];
for (let day = 0; day < days; day += 1) {
  const date = addDays(start, day);
  for (let seed = 1; seed <= seeds; seed += 1) {
    const started = Date.now();
    const report = await runCommunitySimulation({
      seed: seed * 7919 + day,
      date,
      players,
      steps,
    });
    runs.push({ ...report, elapsedMs: Date.now() - started });
    const failed = report.edges
      .filter((edge) => edge.failed > 0)
      .map((edge) => edge.id);
    process.stdout.write(
      `${date} seed ${seed}: ${report.metrics.acceptedEvents} accepted events, ` +
        `${report.violations.length} violation(s)${failed.length ? ` [${failed.join(', ')}]` : ''}\n`
    );
  }
}

const edges = Object.entries(CONNECTIVITY_EDGES).map(([id, definition]) => {
  const perRun = runs.map((report) =>
    report.edges.find((edge) => edge.id === id)
  );
  const exercised = sum(perRun.map((edge) => edge?.exercised ?? 0));
  const failed = sum(perRun.map((edge) => edge?.failed ?? 0));
  const probeCount = sum(perRun.map((edge) => edge?.probeCount ?? 0));
  const known = Boolean(KNOWN_CONNECTIVITY_GAPS[id]);
  const status =
    definition.kind === 'probe'
      ? 'probe'
      : failed === 0
        ? exercised === 0
          ? 'unexercised'
          : known
            ? 'gap-not-seen'
            : 'holds'
        : known
          ? 'known-gap'
          : 'new-violation';
  const samples = unique(
    runs.flatMap((report) =>
      definition.kind === 'probe'
        ? (report.edges.find((edge) => edge.id === id)?.samples ?? [])
        : report.violations
            .filter((violation) => violation.edge === id)
            .map((violation) => violation.detail)
    )
  ).slice(0, 4);
  return { id, ...definition, exercised, failed, probeCount, status, samples };
});

const newViolations = edges.filter((edge) => edge.status === 'new-violation');
const summary = {
  generatedAt: new Date().toISOString(),
  verdict: newViolations.length ? 'FAIL' : 'PASS',
  config: { start, days, seeds, players, steps },
  edges,
  runs: runs.map(({ config, metrics, outcomes, finalZones, elapsedMs }) => ({
    config,
    metrics,
    outcomes,
    finalZones,
    elapsedMs,
  })),
};
await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, 'report.json'),
  `${JSON.stringify(summary, null, 2)}\n`
);
await writeFile(
  path.join(outputDir, 'report.md'),
  markdown(summary, KNOWN_CONNECTIVITY_GAPS)
);
process.stdout.write(
  `\nConnectivity map: ${summary.verdict} · ${edges.filter((edge) => edge.status === 'holds').length} edges hold · ` +
    `${edges.filter((edge) => edge.status === 'known-gap').length} known gaps · ${newViolations.length} new violation(s)\n` +
    `Report: ${path.relative(process.cwd(), path.join(outputDir, 'report.md'))}\n`
);
process.exit(newViolations.length ? 1 : 0);

function markdown(report, gaps) {
  const icon = {
    holds: '✅ holds',
    'known-gap': '🟠 known gap',
    'gap-not-seen': '⚪ known gap, not reproduced',
    'new-violation': '🔴 NEW VIOLATION',
    unexercised: '⚪ not exercised',
    probe: '🔎 probe',
  };
  const contract = report.edges.filter((edge) => edge.kind === 'contract');
  const probes = report.edges.filter((edge) => edge.kind === 'probe');
  const lines = [
    `# Connectivity map: ${report.verdict}`,
    '',
    `${report.config.days} day(s) × ${report.config.seeds} seed(s) from ${report.config.start}, ` +
      `${report.config.players} climbers, up to ${report.config.steps} steps per day. ` +
      `Generated ${report.generatedAt}.`,
    '',
    '## Dependency map',
    '',
    '```mermaid',
    mermaid(report.edges),
    '```',
    '',
    '## Contract edges',
    '',
    '| Edge | From → To | Rule | Checked | Failed | Status |',
    '| --- | --- | --- | ---: | ---: | --- |',
    ...contract.map(
      (edge) =>
        `| \`${edge.id}\` | ${edge.from} → ${edge.to} | ${edge.rule} | ${edge.exercised} | ${edge.failed} | ${icon[edge.status]} |`
    ),
    '',
  ];
  const failing = contract.filter((edge) => edge.failed > 0);
  if (failing.length) {
    lines.push('## Failing edges', '');
    for (const edge of failing) {
      lines.push(`### \`${edge.id}\` · ${icon[edge.status]}`, '');
      if (gaps[edge.id]) lines.push(`Why: ${gaps[edge.id]}`, '');
      for (const sample of edge.samples) lines.push(`- ${sample}`);
      lines.push('');
    }
  }
  lines.push(
    '## Design probes',
    '',
    'Not bugs by themselves: counts of places where the shared layer is thin or hidden.',
    '',
    '| Probe | Measures | Total | Per day |',
    '| --- | --- | ---: | ---: |',
    ...probes.map(
      (edge) =>
        `| \`${edge.id}\` | ${edge.rule} | ${edge.probeCount} | ${round(edge.probeCount / report.runs.length)} |`
    ),
    ''
  );
  for (const edge of probes.filter((candidate) => candidate.samples.length)) {
    lines.push(`- **${edge.id}**: ${edge.samples.slice(0, 2).join(' · ')}`);
  }
  lines.push(
    '',
    '## Runs',
    '',
    '| Date | Seed | Accepted | Falls | Clears | Summits | Visible beats | Rendered artifacts (organic) | First organic artifact (step) | Deepest zone | Rejections |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |',
    ...report.runs.map(({ config, metrics, outcomes }) => {
      const rejections = Object.entries(outcomes)
        .filter(([key]) => key.startsWith('rejected') || key.startsWith('http'))
        .map(([key, count]) => `${key.replace('rejected:', '')} ${count}`)
        .join(', ');
      return `| ${config.date} | ${config.seed} | ${metrics.acceptedEvents} | ${metrics.organicFalls} | ${metrics.clears} | ${metrics.summits} | ${metrics.visibleBeats} | ${metrics.renderedArtifacts} (${metrics.organicArtifacts}) | ${metrics.firstOrganicArtifactStep ?? '–'} | ${metrics.zonesReached} | ${rejections || '–'} |`;
    }),
    '',
    'Edges, gaps, and the simulated community live in `src/server/testing/`. ' +
      'Deterministic reproductions for each known gap are in `src/server/connectivity.test.ts`.',
    ''
  );
  return lines.join('\n');
}

// Stage graph of the shared layer; each contract edge is drawn between the
// stages it connects, coloured by status.
function mermaid(edgeReports) {
  const nodes = {
    view: 'Climber view',
    event: 'Fall / clear event',
    validate: 'Server validation',
    counters: 'Site counters',
    snapshot: 'Board snapshot',
    tower: 'Rendered tower',
    receipt: 'Receipt copy',
    hint: 'Realtime hint',
    observer: 'Other climbers',
    beat: 'Remote beat',
    checkpoint: 'Checkpoint',
    result: 'Result summary',
  };
  const placement = {
    'fall.evidence-accepted': ['view', 'validate'],
    'fall.stale-helper-accepted': ['view', 'validate'],
    'fall.attribution': ['event', 'validate'],
    'mutation.caps': ['validate', 'counters'],
    'mutation.counter-delta': ['validate', 'counters'],
    'mutation.locality': ['counters', 'snapshot'],
    'snapshot.zone-rollup': ['counters', 'snapshot'],
    'snapshot.provenance': ['snapshot', 'tower'],
    'receipt.numbers': ['counters', 'receipt'],
    'receipt.response-snapshot': ['snapshot', 'receipt'],
    'receipt.promise-visible': ['receipt', 'tower'],
    'receipt.no-silent-change': ['tower', 'receipt'],
    'realtime.hint': ['counters', 'hint'],
    'remote.convergence': ['hint', 'observer'],
    'remote.quiet-poll': ['observer', 'snapshot'],
    'remote.beat': ['snapshot', 'beat'],
    'clear.target': ['event', 'counters'],
    'clear.resume': ['event', 'checkpoint'],
    'privacy.failure-anonymous': ['receipt', 'beat'],
    'achievement.named': ['counters', 'result'],
  };
  const lines = ['flowchart LR'];
  for (const [id, label] of Object.entries(nodes))
    lines.push(`  ${id}["${label}"]`);
  lines.push(
    '  view --> event',
    '  tower --> view',
    '  beat --> observer',
    '  observer --> view'
  );
  const styles = [];
  let index = 4;
  for (const edge of edgeReports) {
    const place = placement[edge.id];
    if (!place) continue;
    const mark =
      edge.status === 'holds'
        ? '✓'
        : edge.status === 'known-gap' || edge.status === 'new-violation'
          ? '✗'
          : '?';
    lines.push(`  ${place[0]} -->|"${mark} ${edge.id}"| ${place[1]}`);
    const color =
      edge.status === 'holds'
        ? '#2f855a'
        : edge.status === 'known-gap'
          ? '#dd6b20'
          : edge.status === 'new-violation'
            ? '#c53030'
            : '#718096';
    styles.push(`  linkStyle ${index} stroke:${color},stroke-width:2px`);
    index += 1;
  }
  return [...lines, ...styles].join('\n');
}

function addDays(date, offset) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function unique(values) {
  return [...new Set(values)];
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit' });
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${command} ${commandArgs.join(' ')} exited ${code}`)
          )
    );
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      parsed[key] = argv[index + 1];
      index += 1;
    } else parsed[key] = true;
  }
  return parsed;
}
