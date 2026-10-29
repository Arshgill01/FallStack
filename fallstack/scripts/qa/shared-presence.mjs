// End-to-end check of the shared board as climbers feel it: real browser
// clients, the real /api handlers, one shared in-memory Redis, and realtime
// broadcasts delivered the way Devvit delivers them (a window message). Every
// browser is muted. Screenshots use page.screenshot, which works headless on
// macOS where the CDP canvas capture helper does not.
//
//   npm run build && npx tsc --build && node scripts/qa/shared-presence.mjs
import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { chromium } from 'playwright';
import { createBoardStore, boardSnapshotFor } from '../../dist/types/server/board-store.js';
import { createApi } from '../../dist/types/server/routes/api.js';
import { InMemoryRedis } from '../../dist/types/server/testing/in-memory-redis.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.resolve(
  process.argv[2] ?? path.join(root, 'docs/qa/shared-presence')
);
await mkdir(outputDir, { recursive: true });

const COMMUNITY = {
  subredditId: 't5_fallstack_qa',
  subredditName: 'fallstack',
};
const redis = new InMemoryRedis();
const pages = new Map();
const broadcasts = [];
const errors = [];

function storeFor(userId) {
  return createBoardStore({ redis, context: { ...COMMUNITY, userId } });
}

function appFor(userId) {
  const app = new Hono();
  app.route(
    '/api',
    createApi({
      context: {
        postId: 't3_presence_qa',
        subredditName: COMMUNITY.subredditName,
        username: userId,
      },
      reddit: { getCurrentUsername: async () => userId },
      realtime: { send: async (channel, message) => broadcast(channel, message) },
      boardStore: storeFor(userId),
      now: Date.now,
    })
  );
  return app;
}

async function broadcast(channel, message) {
  broadcasts.push({ channel, message });
  await Promise.all(
    [...pages.values()].map((page) =>
      page
        .evaluate(
          ({ channel, message }) =>
            window.postMessage(
              {
                type: 'devvit-message',
                data: {
                  realtimeEvent: { event: { channel, data: { msg: message } } },
                },
              },
              '*'
            ),
          { channel, message }
        )
        .catch(() => {})
    )
  );
}

// Other climbers who fell before anyone opened the post.
async function seedFall(userId, siteName, bucket) {
  const store = storeFor(userId);
  const state = await store.loadBoardState();
  const site = boardSnapshotFor(state).sites.find((item) => item.name === siteName);
  assert.ok(site, `site ${siteName}`);
  return store.recordFallMutation({
    state,
    eventId: `seed:${userId}:${siteName}:${bucket}:${Math.random().toString(36).slice(2)}`,
    fall: { zoneId: site.zoneId, siteId: site.id, siteName: site.name, bucket },
    highestY: site.y ?? 6000,
    username: `u/${userId}`,
  });
}

async function openClimber(browser, userId) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('fallstack:gameplay-muted', 'true');
    localStorage.setItem('fallstack:music-muted', 'true');
    window.__fallstackFindScene = () => {
      const rootElement = document.querySelector('#root');
      if (!rootElement) return null;
      const key = Object.keys(rootElement).find((name) =>
        name.startsWith('__reactContainer$')
      );
      const container = key ? rootElement[key] : null;
      const stack = [container?.current ?? container].filter(Boolean);
      const seen = new Set();
      while (stack.length) {
        const fiber = stack.pop();
        if (!fiber || seen.has(fiber)) continue;
        seen.add(fiber);
        let hook = fiber.memoizedState;
        while (hook) {
          const scene = hook.memoizedState?.current?.scene?.keys?.FallstackScene;
          if (scene) return scene;
          hook = hook.next;
        }
        if (fiber.child) stack.push(fiber.child);
        if (fiber.sibling) stack.push(fiber.sibling);
      }
      return null;
    };
  });
  const app = appFor(userId);
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const response = await app.fetch(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.method() === 'GET' ? undefined : request.postData(),
      })
    );
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body: await response.text(),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${userId}: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${userId}: ${message.text()}`);
  });
  pages.set(userId, page);
  await page.goto(`${baseUrl}/game.html`);
  await page.waitForFunction(() =>
    Boolean(
      window.__fallstackFindScene?.()?.controlsReady &&
        window.fallstackSnapshot &&
        document.querySelector('.game-shell')?.dataset.gameplayReady === 'true'
    )
  );
  await page.waitForTimeout(400);
  return page;
}

async function echoState(page) {
  return page.evaluate(() => {
    const layer = window.__fallstackFindScene()?.echoLayer;
    if (!layer) return null;
    const active = layer['#active'] ?? null;
    const texts = window
      .__fallstackFindScene()
      .children.list.filter((child) => child.type === 'Text' && child.visible)
      .map((child) => child.text);
    return {
      active: texts.filter((text) => /^\+1 |grew|deepened|overgrew|cleared|reinforced|stabilized|summit/.test(text)).length,
      markers: {
        above: texts.find((text) => text.startsWith('↑')) ?? null,
        below: texts.find((text) => text.startsWith('↓')) ?? null,
      },
      stamps: texts.filter((text) => /^\+1 |A fall/.test(text)),
      unused: active,
    };
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
}

const server = await serveStatic(path.join(root, 'dist/client'));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ['--mute-audio', '--no-sandbox', '--disable-dev-shm-usage'],
});
const report = { steps: [] };

try {
  // Forming: two community wall bonks at First Gap before anyone arrives.
  await seedFall('seed_a', 'First Gap', 'wall_bonk');
  await seedFall('seed_b', 'First Gap', 'wall_bonk');
  const alice = await openClimber(browser, 'alice');
  const forming = await alice.evaluate(() =>
    window.fallstackSnapshot.sites.find((site) => site.name === 'First Gap')
      .counters
  );
  assert.equal(forming.wall_bonk, 2);
  await shot(alice, '01-forming-first-gap');
  report.labels = await alice.evaluate(() => {
    const scene = window.__fallstackFindScene();
    return scene.artifactLabels.map((label) => ({ text: label.text, visible: label.visible, y: Math.round(label.y) }));
  });
  report.steps.push({ step: 'forming', firstGap: forming });

  // Echo: bob really falls in his browser; alice sees it at the same site
  // the moment the server accepts it, and bob does not echo himself.
  const bob = await openClimber(browser, 'bob');
  const echoesBefore = broadcasts.length;
  await bob.keyboard.down('ArrowLeft');
  await bob.waitForFunction(() => window.fallstackSnapshot?.organicFalls >= 3, null, {
    timeout: 8_000,
  });
  await bob.keyboard.up('ArrowLeft');
  assert.equal(broadcasts.length, echoesBefore + 1, 'one broadcast per fall');
  const bobEcho = broadcasts.at(-1).message.echo;
  assert.equal(bobEcho.kind, 'fall');
  assert.equal(bobEcho.climber, null, 'fall echoes are anonymous');
  await alice.waitForTimeout(260);
  const aliceEcho = await echoState(alice);
  const bobSelf = await echoState(bob);
  await shot(alice, '02-echo-alice-sees-bob');
  assert.equal(aliceEcho.active, 1, 'alice renders bob’s fall');
  assert.equal(bobSelf.active, 0, 'bob does not echo his own fall');
  report.steps.push({ step: 'echo', echo: bobEcho, alice: aliceEcho, bob: bobSelf });

  // Off-screen: carol falls far above, through the real API.
  const carol = appFor('carol');
  const high = await alice.evaluate(() => {
    const site = window.fallstackSnapshot.sites.find((item) =>
      item.zoneId === 'ring_citadel'
    );
    return { zoneId: site.zoneId, x: site.helperSlot.x, y: site.helperSlot.y };
  });
  const boardNow = await alice.evaluate(() => ({
    boardId: window.fallstackSnapshot.boardId,
    revision: window.fallstackSnapshot.revision,
  }));
  const carolResponse = await carol.fetch(
    new Request('http://local/api/record-fall', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: 'fall:carol_far_above_1',
        boardId: boardNow.boardId,
        boardRevision: boardNow.revision,
        attemptId: 'carol_far_above_1',
        respawnZoneId: high.zoneId,
        fallX: high.x,
        fallY: high.y + 200,
        highestY: high.y,
        lastPlatformId: null,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 40,
        launchDirection: 1,
        timestamp: Date.now(),
      }),
    })
  );
  assert.equal(carolResponse.status, 200, await carolResponse.clone().text());
  await alice.waitForTimeout(200);
  const offscreen = await echoState(alice);
  await shot(alice, '03-echo-offscreen-marker');
  assert.match(offscreen.markers.above ?? '', /↑/);
  report.steps.push({ step: 'offscreen', alice: offscreen });

  report.broadcasts = broadcasts.length;
  report.errors = errors;
  await writeFile(
    path.join(outputDir, 'shared-presence.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  server.close();
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
  const staticServer = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    const file = path.join(dir, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    try {
      if (!file.startsWith(dir) || !(await stat(file)).isFile()) throw new Error('missing');
      response.writeHead(200, {
        'content-type': types[path.extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    staticServer.listen(0, '127.0.0.1', () => resolve(staticServer))
  );
}
