// In-browser stand-in for the Devvit /api routes, built from the same shared
// game logic the server uses. Optionally simulates other players falling so
// realtime reconciliation (applied on landing) is exercised during a run.
import {
  createBoardIdentity,
  createBoardSnapshot,
  mutationBeatForReceipt,
} from '../../../dist/types/shared/game/board.js';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from '../../../dist/types/shared/game/events.js';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  FAILURE_BUCKETS,
  SEEDED_TOTAL_FALLS,
  ZONE_IDS,
} from '../../../dist/types/shared/game/mutation.js';
import {
  resolveClearSite,
  resolveFallObservation,
} from '../../../dist/types/shared/game/mutation-events.js';
import {
  planClearMutation,
  planFallMutation,
  planSummitMutation,
} from '../../../dist/types/shared/game/mutation-plans.js';

export function createBoardApiMock({ remoteFallIntervalMs = 0 } = {}) {
  const seed = createDailySeed(new Date());
  const identity = createBoardIdentity({
    communityId: 't5_fallstack_qa',
    communityName: 'fallstack',
    ...seed,
  });
  const siteCounters = createSeededSiteCounters(seed.dailySeed);
  const receipts = new Map();
  const recentMutations = [];
  const stats = { remoteFalls: 0, falls: 0, clears: 0, summits: 0, errors: [] };
  let revision = SEEDED_TOTAL_FALLS;
  let totalFalls = SEEDED_TOTAL_FALLS;
  let totalClears = 0;
  let totalSummits = 0;
  let resumeZone = null;

  function snapshot() {
    return createBoardSnapshot(
      identity,
      deriveSnapshot({
        ...seed,
        counters: createSeededCounters(),
        siteCounters,
        totalFalls,
        totalClears,
        totalSummits,
        achievements: createInitialAchievements(),
      }),
      revision,
      recentMutations.slice(-12)
    );
  }

  function applyReceipt(plan, eventId) {
    receipts.set(eventId, plan.receipt);
    if (!plan.applyMutation) return;
    revision = plan.receipt.revisionAfter;
    const beat = mutationBeatForReceipt(plan.receipt);
    if (beat) recentMutations.push(beat);
  }

  // Another climber somewhere in the tower falls: bumps the revision the way
  // a real concurrent player would, so the client defers and then applies it.
  function simulateRemoteFall() {
    const siteIds = Object.keys(siteCounters);
    const siteId = siteIds[Math.floor(Math.random() * siteIds.length)];
    const bucket = FAILURE_BUCKETS[Math.floor(Math.random() * 3)];
    siteCounters[siteId][bucket] += 1;
    totalFalls += 1;
    revision += 1;
    stats.remoteFalls += 1;
  }

  const timer =
    remoteFallIntervalMs > 0
      ? setInterval(simulateRemoteFall, remoteFallIntervalMs)
      : null;

  async function handle(route) {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    try {
      if (method === 'GET' && pathname === '/api/init-game') {
        return json(route, {
          type: 'initGame',
          postId: 'post_pipeline_qa',
          postUrl: null,
          supportUrl: null,
          username: 'qa-climber',
          resume: { zoneId: resumeZone ?? ZONE_IDS[0], mode: 'account' },
          snapshot: snapshot(),
        });
      }
      if (method === 'GET' && pathname === '/api/board-revision') {
        return json(route, {
          type: 'boardRevision',
          boardId: identity.boardId,
          revision,
        });
      }
      if (method === 'POST' && pathname === '/api/record-fall') {
        const body = request.postDataJSON();
        const parsed = validateRecordFallRequest(body, Date.now());
        if (!parsed.ok) return reject(route, `invalid fall: ${parsed.message}`);
        const resolved = resolveFallObservation(parsed.value, snapshot());
        if (!resolved.ok)
          return reject(
            route,
            `unresolved fall: ${resolved.message ?? resolved.error}`
          );
        const fall = resolved.value;
        const plan = planFallMutation({
          eventId: body.eventId,
          boardId: identity.boardId,
          revision,
          siteId: fall.siteId,
          siteName: fall.siteName,
          bucket: fall.bucket,
          siteCounters: { ...siteCounters[fall.siteId] },
          contributorBucketCount: 0,
          contributorDailyFallCount: 0,
          existingReceipt: receipts.get(body.eventId) ?? null,
        });
        if (plan.applyMutation) {
          siteCounters[fall.siteId][fall.bucket] += 1;
          totalFalls += 1;
        }
        applyReceipt(plan, body.eventId);
        stats.falls += 1;
        return json(route, {
          type: 'recordFall',
          counted: plan.receipt.accepted,
          message: plan.receipt.copy,
          receipt: plan.receipt,
          snapshot: snapshot(),
        });
      }
      if (method === 'POST' && pathname === '/api/record-clear') {
        const body = request.postDataJSON();
        const parsed = validateRecordClearRequest(body, Date.now());
        if (!parsed.ok)
          return reject(route, `invalid clear: ${parsed.message}`);
        const site = resolveClearSite(snapshot(), body.zoneId);
        if (!site) return reject(route, `no clear site for ${body.zoneId}`);
        const plan = planClearMutation({
          eventId: body.eventId,
          boardId: identity.boardId,
          revision,
          siteId: site.siteId,
          siteName: site.siteName,
          siteCounters: { ...siteCounters[site.siteId] },
          contributorClearCount: 0,
          existingReceipt: receipts.get(body.eventId) ?? null,
        });
        if (plan.applyMutation) {
          siteCounters[site.siteId].successfulClears += 1;
          totalClears += 1;
        }
        applyReceipt(plan, body.eventId);
        resumeZone = body.zoneId;
        stats.clears += 1;
        return json(route, {
          type: 'recordClear',
          counted: plan.receipt.accepted,
          message: plan.receipt.copy,
          receipt: plan.receipt,
          resume: { zoneId: body.zoneId, mode: 'account' },
          snapshot: snapshot(),
        });
      }
      if (method === 'POST' && pathname === '/api/record-summit') {
        const body = request.postDataJSON();
        const parsed = validateRecordSummitRequest(body, Date.now());
        if (!parsed.ok)
          return reject(route, `invalid summit: ${parsed.message}`);
        const plan = planSummitMutation({
          eventId: body.eventId,
          boardId: identity.boardId,
          revision,
          contributorSummitCount: 0,
          existingReceipt: receipts.get(body.eventId) ?? null,
        });
        if (plan.applyMutation) totalSummits += 1;
        applyReceipt(plan, body.eventId);
        stats.summits += 1;
        return json(route, {
          type: 'recordSummit',
          counted: plan.receipt.accepted,
          message: plan.receipt.copy,
          receipt: plan.receipt,
          snapshot: snapshot(),
        });
      }
      return reject(route, `unhandled ${method} ${pathname}`, 404);
    } catch (error) {
      return reject(route, String(error), 500);
    }
  }

  function reject(route, message, status = 400) {
    stats.errors.push(message);
    return json(route, { status: 'error', message }, status);
  }

  return {
    handle,
    stats,
    stop: () => timer && clearInterval(timer),
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
