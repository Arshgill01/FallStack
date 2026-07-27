import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { deriveImpactSites } from '../../dist/types/shared/game/impact-sites.js';
import { MOVEMENT_TUNING } from '../../dist/types/shared/game/movement.js';
import {
  generateDailyTower,
  isRoutePlatform,
  validateTower,
  WORLD_WIDTH,
  ZONES,
} from '../../dist/types/shared/game/tower.js';
import {
  CAMERA_AIR_LOOKAHEAD,
  cameraScrollXForPlayer,
  visibleHorizontalSpan,
} from '../../dist/types/client/game/layout.js';

const outputDir = path.resolve(
  process.argv[2] ?? 'docs/quality-reconstruction/evidence/tower-seed-corpus'
);
const sourceCommit = process.env.FALLSTACK_QA_SOURCE_COMMIT ?? 'unknown';
const seedCount = 365;
const viewportWidths = [320, 375];
const playerHalfWidth = 10;
const minimumReadableLanding = 40;

await mkdir(outputDir, { recursive: true });

const failures = [];
const distributions = {
  routePlatforms: [],
  firstCheckpointJump: [],
  minimumRouteWidth: [],
  minimumWallMargin: [],
  maximumHorizontalStep: [],
  maximumVerticalStep: [],
};
const viewportMinimums = Object.fromEntries(
  viewportWidths.map((width) => [width, Number.POSITIVE_INFINITY])
);
const chunkArchetypes = new Map();
let routeTransitions = 0;
let impactSites = 0;
let hazardLayouts = 0;

for (let index = 0; index < seedCount; index += 1) {
  const date = new Date(Date.UTC(2026, 0, 1 + index));
  const dateKey = date.toISOString().slice(0, 10);
  const tower = generateDailyTower(`fallstack-${dateKey}`);
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((left, right) => right.y - left.y);
  const sites = deriveImpactSites(tower);
  const hazards = sites.map((site) => ({
    id: `${site.id}:qa-hazard`,
    zoneId: site.zoneId,
    ...site.hazardSlot,
    kind: 'obstacle',
  }));
  const towerValid = validateTower(tower);
  const hazardsValid = validateTower({
    ...tower,
    platforms: [...tower.platforms, ...hazards],
  });

  if (!towerValid) failures.push(`${tower.seed}: baseline route is invalid`);
  if (!hazardsValid)
    failures.push(`${tower.seed}: active hazards invalidate the default route`);

  const firstCheckpointIndex = route.findIndex((platform) =>
    platform.id.includes('checkpoint')
  );
  const widths = route.map((platform) => platform.width);
  const wallMargins = route
    .filter(
      (platform) =>
        platform.id !== 'start' &&
        platform.id !== 'summit' &&
        !platform.id.includes('checkpoint')
    )
    .map((platform) =>
      Math.min(platform.x, WORLD_WIDTH - platform.x - platform.width)
    );
  const horizontalSteps = [];
  const verticalSteps = [];

  for (let routeIndex = 0; routeIndex < route.length - 1; routeIndex += 1) {
    const from = route[routeIndex];
    const target = route[routeIndex + 1];
    const fromCenter = from.x + from.width / 2;
    const targetCenter = target.x + target.width / 2;
    const horizontalStep = Math.abs(targetCenter - fromCenter);
    const verticalStep = from.y - target.y;
    horizontalSteps.push(horizontalStep);
    verticalSteps.push(verticalStep);
    routeTransitions += 1;

    for (const viewportWidth of viewportWidths) {
      const direction = targetCenter < fromCenter ? -1 : 1;
      const takeoffX =
        direction < 0
          ? from.x + playerHalfWidth
          : from.x + from.width - playerHalfWidth;
      const scrollX = cameraScrollXForPlayer(
        takeoffX,
        viewportWidth,
        WORLD_WIDTH,
        direction * CAMERA_AIR_LOOKAHEAD
      );
      const visibleLanding = visibleHorizontalSpan(
        target.x + playerHalfWidth,
        target.x + target.width - playerHalfWidth,
        scrollX,
        viewportWidth
      );
      viewportMinimums[viewportWidth] = Math.min(
        viewportMinimums[viewportWidth],
        visibleLanding
      );
      if (visibleLanding < minimumReadableLanding) {
        failures.push(
          `${tower.seed}: ${from.id} → ${target.id} exposes ${round(visibleLanding)}px at ${viewportWidth}px`
        );
      }
    }
  }

  distributions.routePlatforms.push(route.length);
  distributions.firstCheckpointJump.push(firstCheckpointIndex);
  distributions.minimumRouteWidth.push(Math.min(...widths));
  distributions.minimumWallMargin.push(Math.min(...wallMargins));
  distributions.maximumHorizontalStep.push(Math.max(...horizontalSteps));
  distributions.maximumVerticalStep.push(Math.max(...verticalSteps));
  impactSites += sites.length;
  hazardLayouts += 1;

  for (const chunk of tower.chunks) {
    chunkArchetypes.set(
      chunk.archetype,
      (chunkArchetypes.get(chunk.archetype) ?? 0) + 1
    );
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  source: {
    commit: sourceCommit,
    environment: 'current Mac',
  },
  scope: {
    kind: 'deterministic static invariant corpus',
    firstDate: '2026-01-01',
    lastDate: '2026-12-31',
    seeds: seedCount,
    zonesPerSeed: ZONES.length,
    viewportWidths,
    note: 'This report measures generator bounds, declared-movement reachability, artifact-free route preservation, and camera-readable landing space. It does not simulate player skill or approve subjective difficulty.',
  },
  movementContract: {
    worldWidth: WORLD_WIDTH,
    reachableHorizontal: MOVEMENT_TUNING.reachableHorizontal,
    reachableVertical: MOVEMENT_TUNING.reachableVertical,
    cameraLookahead: CAMERA_AIR_LOOKAHEAD,
    minimumReadableLanding,
  },
  totals: {
    routeTransitions,
    impactSites,
    hazardLayouts,
    chunkArchetypes: Object.fromEntries(
      [...chunkArchetypes.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
  },
  ranges: Object.fromEntries(
    Object.entries(distributions).map(([name, values]) => [name, range(values)])
  ),
  minimumVisibleLandingByViewport: Object.fromEntries(
    Object.entries(viewportMinimums).map(([width, value]) => [
      width,
      round(value),
    ])
  ),
  failures,
};

await writeFile(
  path.join(outputDir, 'tower-corpus.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
process.stdout.write(
  `${JSON.stringify(
    {
      seeds: seedCount,
      routeTransitions,
      impactSites,
      minimumVisibleLandingByViewport: report.minimumVisibleLandingByViewport,
      ranges: report.ranges,
      failures: failures.length,
    },
    null,
    2
  )}\n`
);

assert.equal(failures.length, 0, failures.slice(0, 20).join('\n'));

function range(values) {
  return {
    minimum: round(Math.min(...values)),
    maximum: round(Math.max(...values)),
  };
}

function round(value) {
  return Math.round(value * 10) / 10;
}
