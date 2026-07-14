# Shared Mutation Architecture

Status: implemented and evidence-backed architecture, 2026-07-14.

## What Fallstack is selling

> Everyone in the community climbs one daily tower, and their failures and clean clears physically rewrite the route for the next climbers.

The jump is the input. The shared tower is the product. A player must be able to answer all three questions without opening a tutorial or result card:

1. What did earlier climbers change here?
2. What did my action change?
3. What will the community make this place become next?

If the experience proves only that counters increased, it has not proved the product.

## Scope reality

Devvit Redis is isolated per app installation, which normally means per subreddit. The native v1 board can therefore be **community-global**: every Fallstack post in one installation can resolve to the same daily board. It is not automatically cross-subreddit or cross-Reddit. The official Redis documentation says cross-community state needs an explicitly designed shared service over server-side HTTP fetch.

- Native v1 label: `One community · one tower · today`.
- Native board identity: server-derived installation scope + UTC date + tower version.
- Cross-community global board: a later infrastructure decision requiring explicit approval, an external authority, operational ownership, abuse controls, and a migration plan.
- The client must never invent or choose board scope, Redis keys, installation identity, or display identity.

Reference: [Devvit Redis data storage and cross-community constraint](https://developers.reddit.com/docs/capabilities/server/redis).

## M0 baseline schematic

```text
UTC date
  -> dailySeed
  -> procedural ledges
  -> Phaser run
  -> client classifies fall bucket + zone
  -> POST /api/record-fall
  -> Redis date-wide counters inside one installation
  -> derive zone status + up to three fixed-slot artifacts
  -> full snapshot response
  -> Phaser rebuilds artifact visuals and collision bodies
```

Baseline authority split:

| Layer | Current responsibility | Evidence |
| --- | --- | --- |
| Pure game logic | Daily seed, 12 large zones, generated platforms, aggregate counters, fixed artifact slots, status/result derivation | `src/shared/game/tower.ts`, `mutation.ts` before M1 |
| Phaser client | Movement, collisions, attempt IDs, fall detection, failure classification, local event emission, artifact bodies | `src/client/game-app.tsx` |
| React shell | Snapshot fetch, 45-second refresh, event POSTs, banners, stats, result dialog | `src/client/game-app.tsx` |
| Devvit server | Validation, caps, Redis deltas, achievements, snapshot response | `src/server/routes/api.ts` |
| Redis | Seed deltas, totals, caps, seen-event keys, achievements | date-prefixed keys in `api.ts` |

## Implemented M1 schematic

```text
dailySeed -> generated tower -> three deterministic ImpactSites per zone
                                      | actual approach + anchor platform IDs
zone counters -> bucket-to-site map --+ helper / hazard / ghost slot
                                      |
                                      v
                      artifact with site identity + seeded/organic count
                                      |
                                      v
                        Phaser visual + collision body at real route geometry
```

M1 removed the fixed coordinate table. `zones.ts` now owns shared zone constants, `impact-sites.ts` derives stable anchors from adjacent route platforms, and `mutation.ts` derives artifacts from those sites. The opening artifact is `First Gap`; the advertised 37 seeded failures now equal the actual seeded bucket sum; snapshots and artifacts expose seeded versus organic additions.

M2 closed the event-authority boundary. Phaser now sends bounded observation evidence; shared pure logic validates referenced platform/helper IDs against the generated tower, resolves a real impact site, and derives the failure bucket. The server—not the client—owns the persistent site and bucket decision.

## What is real today

- Players in the same installation and UTC day resolve to one explicit community board identity and revision.
- Falls, clears, and summits are authenticated through server context rather than client-supplied usernames.
- Contributions, idempotency receipts, exact site counters, totals, board revision, achievements, and visible history beats are queued in one watched Redis transaction with bounded retry.
- The production board store and API expose narrow injectable system boundaries. A Redis-compatible controlled harness executes the real store/route code and proves ordered conflict retries, duplicate idempotency, caps, stale-day rejection, monotonic achievements, history bounds, and TTL without changing the production endpoint interface.
- Aggregate per-site counters deterministically derive visible artifacts and zone labels at real generated impact sites.
- Seeded state ensures the shared-mutation promise is visible before traffic exists, and seeded versus organic counts are exposed separately.
- Accepted falls return a structured receipt; React shows the board/site/counter proof and Phaser outlines the exact site.
- Artifact collision bodies are rebuilt from the latest snapshot at respawn after the event is emitted.
- Visible clients poll one metadata field through `/api/board-revision`; they fetch and derive a full snapshot only after a newer revision or daily board identity appears.
- The installed Devvit 0.13.7 playtest accepted two hosted fall transactions from client A (`R37 → R39`), and independent client B reconciled to `R39` and the upgraded First Gap without reload.

These foundations now make an accepted fall contextual, legible, mechanically meaningful, and visible in the shared daily story. Ghost and cursed artifacts have deterministic per-attempt rules, newer revisions reconcile only at safe collision points, and Tower Memory consumes the same bounded board history. The remaining release gate is direct first-time human comprehension, not the local domain, persistence adapter, or presentation contract.

## Shortcomings

| Severity | Gap | Current evidence | Product consequence |
| --- | --- | --- | --- |
| P1 | First-time comprehension is unmeasured | runtime and Figma states answer scope, earlier cause, personal delta, and next consequence, but the five-person check is unrun | Release confidence still lacks direct human evidence |
| P1 | Finalized historical board archive is absent | Tower Memory is an honest live board and the false relic promise is removed; prior sealed boards are not yet retrievable in-product | The current day has a story, but later retrospective/community recap features need a separate archive contract |
| P2 | A simultaneous hosted watch conflict has not been deliberately forced | hosted Devvit accepted two real writes with ordered revisions and reconciled a second client; forced two-user conflicts, duplicate tabs, caps, retry exhaustion, and partial-write absence are proven in the Redis-compatible production-store harness | A future Devvit transaction regression may require a hosted load harness to diagnose |

## Target schematic

```text
server-derived BoardId
  = installation scope + UTC date + towerVersion
             |
             v
dailySeed -> generated tower -> deterministic ImpactSites anchored to platform IDs
             |                                 |
             |                                 v
             |                     seeded + organic site counters
             |                                 |
Phaser attempt -> FallObservation ------------>|
                 (coordinates, platform/helper evidence, charge)
                                                   |
                                                   v
                                  pure server-side classification
                                                   |
                                                   v
                          transactional cap + event + counter + revision
                                                   |
                                                   v
                              MutationReceipt + BoardSnapshot
                                                   |
                       +---------------------------+------------------+
                       |                                              |
              in-world site change                         bounded tower chronicle
              exact before/after                           recent threshold events
```

## Target product contracts

### Board identity

```ts
type BoardScope = 'community';

type BoardIdentity = {
  boardId: string;       // server-generated opaque ID
  scope: BoardScope;
  scopeLabel: string;    // authenticated/sanitized community label
  dateKey: string;
  dailySeed: string;
  towerVersion: number;
};
```

All endpoints resolve the current board from authenticated server context and current time. The client submits the last board ID/revision only for stale-state detection.

### Impact sites

An impact site is a deterministic mutation anchor attached to generated route geometry, not an arbitrary fall object.

```ts
type ImpactSite = {
  id: string;
  name: string;
  zoneId: ZoneId;
  anchorPlatformId: string;
  approachPlatformId: string;
  helperSlot: Rect;
  hazardSlot: Rect;
  ghostSlot: Rect;
  baselinePathIds: string[];
};
```

Rules:

- Generate two or three candidate sites per zone from actual adjacent route platforms.
- The site ID is stable for one `dailySeed` and `towerVersion`.
- Helpful artifacts may shorten or widen an optional route but never become required.
- Hazard variants may add timing or risk but may not invalidate the known baseline path.
- The opening site must be visible at spawn and deliberately aligned with the first jump.

### Observations and server classification

The client reports a bounded observation; it does not choose the persistent mutation.

```ts
type FallObservation = {
  eventId: string;
  boardId: string;
  boardRevision: number;
  attemptId: string;
  respawnZoneId: ZoneId;
  fallX: number;
  fallY: number;
  highestY: number;
  lastPlatformId: string | null;
  lastHelperArtifactId: string | null;
  wallBonkPlatformId: string | null;
  launchChargePercent: number;
  launchDirection: -1 | 0 | 1;
  timestamp: number;
};
```

Pure logic validates IDs against the generated tower, resolves the nearest eligible impact site, and derives one of the four settled failure buckets. This is anti-nonsense validation, not impossible server-authoritative physics. Per-user caps remain required.

### Mutation receipt

Every accepted or rejected action returns structured proof.

```ts
type MutationReceipt = {
  eventId: string;
  boardId: string;
  accepted: boolean;
  rejection:
    | 'duplicate'
    | 'capped'
    | 'stale'
    | 'invalid'
    | 'unavailable'
    | null;
  revisionBefore: number;
  revisionAfter: number;
  siteId: string | null;
  siteName: string | null;
  bucket: FailureBucket | 'successful_clear' | null;
  counterBefore: number | null;
  counterAfter: number | null;
  nextThreshold: number | null;
  visibleChange:
    | 'mark_added'
    | 'artifact_spawned'
    | 'artifact_upgraded'
    | 'site_cursed'
    | 'site_reinforced'
    | 'site_stabilized'
    | 'none';
  copy: string;
};
```

The first-fall UI is rendered from this receipt. Prose is secondary to the structured before/after proof.

### Snapshot and history

```ts
type BoardSnapshot = BoardIdentity & {
  revision: number;
  seededTotals: BoardTotals;
  organicTotals: BoardTotals;
  combinedTotals: BoardTotals;
  sites: SiteSnapshot[];
  zones: ZoneSnapshot[];
  recentMutations: MutationBeat[]; // threshold/state beats only, capped
  achievements: AchievementState;
  result: ResultSummary;
};
```

- Preserve aggregate storage. Do not store per-frame paths or every fall as world objects.
- Retain event IDs/receipts only for idempotency through the daily TTL.
- Retain at most 20 recent **visible mutation beats**, not every failure.
- Separate seeded and organic totals so UI can say “the day opened scarred; the community added N more.”
- A monotonically increasing revision lets clients reconcile and announce remote changes.

## Persistence design

Use a small known set of daily keys or hashes; Devvit cannot globally scan for lost keys.

```text
fallstack:board:<boardId>:meta
fallstack:board:<boardId>:counters
fallstack:board:<boardId>:contributors
fallstack:board:<boardId>:events
fallstack:board:<boardId>:achievements
fallstack:board:<boardId>:recent-mutations
```

One event transaction must atomically:

1. prove the event ID is new;
2. read/enforce the authenticated contributor cap;
3. increment the selected site counter and board total;
4. increment board revision;
5. write the deterministic receipt;
6. append a recent mutation only when a visible threshold/state changed.

Use Devvit `watch`/`multi`/`exec` because correctness depends on several related reads and writes. Retry a transaction conflict a small bounded number of times. A quota or transaction failure must return a non-accepted receipt and preserve read-only play. Do not reserve an event outside the transaction.

## Client experience

### Before input

- Say who shares this board: `One community · one tower · today`.
- Show one site name, count, artifact, mechanical effect, and next threshold in the opening architecture.
- Keep the actual jump unobscured.
- Distinguish seeded opening state from organic additions without saying “fake” or “demo.”

### After the player acts

- Highlight the exact site for roughly five seconds so the structured receipt and physical mark can be read together.
- Show `before -> after`, what changed now, and what happens next.
- If capped, say the climb still counts locally but did not reshape shared state.
- If persistence fails, never pretend the board changed.

### When someone else changes the board

- Use revision changes to pulse only the affected site.
- Announce a concise remote beat such as `3 falls raised First Gap.`
- Do not interrupt an active jump with a modal or rebuild collision bodies while the player is airborne; reconcile at land/respawn/checkpoint.

### Whole-board view

- Replace the generic `Result` entry point with `Tower Memory` or equivalent.
- Present a compact vertical map of the current shared tower: major zones, active scars, stabilized sites, latest visible changes, and summit status.
- It is a reliquary/chronicle, not a leaderboard dashboard.
- The first viewport still proves the hook without opening it.

## Non-negotiable invariants

- Shared mutation is spatially anchored to generated tower geometry.
- The server derives board identity, impact site, failure bucket, display identity, and Redis keys.
- One event produces at most one persistent mutation receipt.
- Helpful and cursed variants never remove the default clear path.
- Failure remains anonymous/aggregate; positive achievements may name users.
- Visible artifact caps remain enforced per site/zone.
- Collision changes apply at safe reconciliation points.
- Offline/local fallback is labeled local and never presented as global truth.
- Cross-subreddit scope is not claimed without an approved shared authority.
