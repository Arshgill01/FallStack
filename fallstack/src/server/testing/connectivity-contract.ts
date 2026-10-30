// The connectivity contract: every way one climber's action is supposed to
// reach another climber, written as named edges that the community harness
// checks after each simulated action. Contract edges must never fail. Probe
// edges measure design pressure (hidden or uncalmable mutations) that is not a
// bug by itself but tells the next iteration where the shared layer is thin.
import type { BoardSnapshot, MutationBeat } from '../../shared/game/board.js';
import type {
  Artifact,
  FailureBucket,
  SiteSnapshot,
  ZoneId,
  ZoneStatus,
} from '../../shared/game/mutation.js';
import {
  CONTRIBUTOR_BUCKET_CAP,
  CONTRIBUTOR_DAILY_FALL_CAP,
  CONTRIBUTOR_SAVE_CAP,
  CONTRIBUTOR_SUMMIT_CAP,
  CONTRIBUTOR_ZONE_CLEAR_CAP,
} from '../../shared/game/mutation-plans.js';
import type { MutationReceipt } from '../../shared/game/mutation-receipts.js';
import {
  echoKeyForEvent,
  parseBoardEcho,
  realtimeChannelForBoard,
} from '../../shared/realtime.js';
import { zoneById } from '../../shared/game/tower.js';
import { bucketDrivesVisibleSlot, siteFace } from '../../shared/game/forming.js';
import { resolveClearRescuers } from '../../shared/game/mutation-events.js';

export type EdgeKind = 'contract' | 'probe';

export type EdgeDefinition = {
  from: string;
  to: string;
  rule: string;
  kind: EdgeKind;
};

export const CONNECTIVITY_EDGES = {
  'fall.attribution': {
    from: 'fall observation',
    to: 'impact site + failure bucket',
    rule: 'The server credits the site and bucket the climber actually failed at.',
    kind: 'contract',
  },
  'fall.evidence-accepted': {
    from: 'client view',
    to: 'server validation',
    rule: 'A fall built from what the client can see is never rejected as invalid.',
    kind: 'contract',
  },
  'fall.stale-helper-accepted': {
    from: 'helper touched in a stale view',
    to: 'server validation',
    rule: 'Touching a helper that another climber has since displaced still records the fall.',
    kind: 'contract',
  },
  'mutation.counter-delta': {
    from: 'accepted event',
    to: 'site counters + totals + revision',
    rule: 'Exactly one counter moves by one; totals and revision move by one; nothing else changes.',
    kind: 'contract',
  },
  'mutation.locality': {
    from: 'accepted event at one site',
    to: 'every other site',
    rule: 'No other site changes its counters, status, or rendered artifact.',
    kind: 'contract',
  },
  'mutation.caps': {
    from: 'contributor history',
    to: 'acceptance',
    rule: `Each climber moves a site bucket at most ${CONTRIBUTOR_BUCKET_CAP}x, falls at most ${CONTRIBUTOR_DAILY_FALL_CAP}x/day, clears a zone at most ${CONTRIBUTOR_ZONE_CLEAR_CAP}x, summits ${CONTRIBUTOR_SUMMIT_CAP}x.`,
    kind: 'contract',
  },
  'receipt.numbers': {
    from: 'receipt',
    to: 'authoritative board',
    rule: 'Receipt before/after counters and revisions match the board the receipt describes.',
    kind: 'contract',
  },
  'receipt.response-snapshot': {
    from: 'response snapshot',
    to: 'authoritative board',
    rule: 'The snapshot returned with a receipt is the board everyone else will load.',
    kind: 'contract',
  },
  'receipt.promise-visible': {
    from: 'receipt visible change',
    to: 'rendered tower',
    rule: 'When a receipt says an artifact spawned, upgraded, or a site turned, every climber can see it.',
    kind: 'contract',
  },
  'receipt.no-silent-change': {
    from: 'rendered tower change',
    to: 'receipt',
    rule: 'If the rendered artifact at a site changes, the receipt that caused it announces a visible change.',
    kind: 'contract',
  },
  'receipt.every-fall-visible': {
    from: 'accepted event',
    to: 'rendered site face',
    rule: 'Every accepted event below a slot’s ceiling changes what the site draws (artifact, forming silhouette, or tier pip), so nobody’s fall is invisible.',
    kind: 'contract',
  },
  'snapshot.provenance': {
    from: 'site counters',
    to: 'artifact labels + headline',
    rule: 'Artifact counts, opening/community splits, and the headline agree with the counters.',
    kind: 'contract',
  },
  'snapshot.zone-rollup': {
    from: 'site counters',
    to: 'zone counters',
    rule: 'Zone counters are the sum of their sites; rendered artifacts belong to the zone.',
    kind: 'contract',
  },
  'realtime.hint': {
    from: 'accepted mutation',
    to: 'realtime channel',
    rule: 'Each accepted mutation sends one revision hint on the board channel; rejections send none.',
    kind: 'contract',
  },
  'realtime.echo': {
    from: 'accepted mutation',
    to: 'every open client',
    rule: 'The hint carries an echo of exactly what happened (site, bucket, count, visible change) so other climbers see it live; fall echoes name nobody.',
    kind: 'contract',
  },
  'remote.convergence': {
    from: 'another climber’s mutation',
    to: 'observer view after sync',
    rule: 'After a hint or poll, an observer sees the exact authoritative board.',
    kind: 'contract',
  },
  'remote.quiet-poll': {
    from: 'unchanged board',
    to: 'observer sync',
    rule: 'Polling an unchanged board never downloads a full snapshot.',
    kind: 'contract',
  },
  'remote.beat': {
    from: 'visible mutation',
    to: 'observer remote beat',
    rule: 'Every visible mutation since the observer’s revision is in recentMutations (window 20).',
    kind: 'contract',
  },
  'clear.target': {
    from: 'zone clear',
    to: 'most-scarred site',
    rule: 'A clean clear reinforces the site in its zone with the most failures.',
    kind: 'contract',
  },
  'clear.saves': {
    from: 'clear after standing on community artifacts',
    to: 'those artifacts’ saves',
    rule: 'An accepted clear adds one save to each valid rescuer in its zone the climber has not thanked today, and to nothing else.',
    kind: 'contract',
  },
  'clear.resume': {
    from: 'zone clear',
    to: 'climber checkpoint',
    rule: 'A clear advances only the clearing climber’s checkpoint.',
    kind: 'contract',
  },
  'privacy.failure-anonymous': {
    from: 'failure',
    to: 'shared copy',
    rule: 'Fall receipts and beats never name the climber who fell.',
    kind: 'contract',
  },
  'achievement.named': {
    from: 'summit / stabilize / height',
    to: 'result summary',
    rule: 'Positive achievements name the climber who earned them.',
    kind: 'contract',
  },
  'probe.hidden-artifact': {
    from: 'threshold crossed',
    to: 'rendered tower',
    rule: 'Earned site artifacts that are not rendered because a site shows only one.',
    kind: 'probe',
  },
  'probe.uncalmable-curse': {
    from: 'cursed brick',
    to: 'clean clears',
    rule: 'Cursed sites that clean clears cannot reach because another site in the zone has more failures.',
    kind: 'probe',
  },
  'probe.zone-site-status': {
    from: 'site statuses',
    to: 'zone status',
    rule: 'Zones whose status disagrees with every one of their sites.',
    kind: 'probe',
  },
  'probe.beats-collapsed': {
    from: 'several visible mutations between syncs',
    to: 'one remote beat',
    rule: 'Visible mutations an observer never sees called out because only the newest beat is shown.',
    kind: 'probe',
  },
  'probe.stabilizer-title': {
    from: 'clean clears',
    to: 'best stabilizer title',
    rule: 'Climbers with more total clean clears than the title holder, who cannot take it because the title counts one zone capped at 3.',
    kind: 'probe',
  },
  'probe.shared-encounter': {
    from: 'other climbers’ mutations',
    to: 'a climber’s next fall or clear',
    rule: 'Events where the site already carried mutations from someone else.',
    kind: 'probe',
  },
} as const satisfies Record<string, EdgeDefinition>;

export type EdgeId = keyof typeof CONNECTIVITY_EDGES;

export type Violation = {
  edge: EdgeId;
  step: number;
  actor: string;
  detail: string;
};

export class ContractLedger {
  readonly exercised = new Map<EdgeId, number>();
  readonly failed = new Map<EdgeId, number>();
  readonly violations: Violation[] = [];
  readonly probes = new Map<EdgeId, number>();
  readonly probeSamples = new Map<EdgeId, string[]>();
  step = 0;
  actor = '';
  #maxViolationsPerEdge: number;

  constructor(maxViolationsPerEdge = 25) {
    this.#maxViolationsPerEdge = maxViolationsPerEdge;
  }

  check(edge: EdgeId, holds: boolean, detail: () => string): boolean {
    this.exercised.set(edge, (this.exercised.get(edge) ?? 0) + 1);
    if (holds) return true;
    const failures = (this.failed.get(edge) ?? 0) + 1;
    this.failed.set(edge, failures);
    if (failures <= this.#maxViolationsPerEdge)
      this.violations.push({
        edge,
        step: this.step,
        actor: this.actor,
        detail: detail(),
      });
    return false;
  }

  probe(edge: EdgeId, count: number, sample?: () => string) {
    if (count <= 0) return;
    this.probes.set(edge, (this.probes.get(edge) ?? 0) + count);
    const samples = this.probeSamples.get(edge) ?? [];
    if (sample && samples.length < 5) samples.push(sample());
    this.probeSamples.set(edge, samples);
  }

  failingEdges(): EdgeId[] {
    return [...this.failed.keys()];
  }
}

// Independent model of contribution caps, kept separate from the server's
// counters so a cap bug cannot hide behind the code it is checking.
export class CapModel {
  readonly #siteBuckets = new Map<string, number>();
  readonly #falls = new Map<string, number>();
  readonly #zoneClears = new Map<string, number>();
  readonly #summits = new Map<string, number>();

  wouldAcceptFall(contributor: string, siteId: string, bucket: FailureBucket) {
    return (
      (this.#siteBuckets.get(`${contributor}|${siteId}|${bucket}`) ?? 0) <
        CONTRIBUTOR_BUCKET_CAP &&
      (this.#falls.get(contributor) ?? 0) < CONTRIBUTOR_DAILY_FALL_CAP
    );
  }

  recordFall(contributor: string, siteId: string, bucket: FailureBucket) {
    bump(this.#siteBuckets, `${contributor}|${siteId}|${bucket}`);
    bump(this.#falls, contributor);
  }

  wouldAcceptClear(contributor: string, zoneId: string) {
    return (
      (this.#zoneClears.get(`${contributor}|${zoneId}`) ?? 0) <
      CONTRIBUTOR_ZONE_CLEAR_CAP
    );
  }

  recordClear(contributor: string, zoneId: string) {
    bump(this.#zoneClears, `${contributor}|${zoneId}`);
  }

  wouldAcceptSummit(contributor: string) {
    return (this.#summits.get(contributor) ?? 0) < CONTRIBUTOR_SUMMIT_CAP;
  }

  recordSummit(contributor: string) {
    bump(this.#summits, contributor);
  }

  readonly #saves = new Map<string, number>();

  wouldAcceptSave(contributor: string, artifactId: string) {
    return (
      (this.#saves.get(`${contributor}|${artifactId}`) ?? 0) <
      CONTRIBUTOR_SAVE_CAP
    );
  }

  recordSave(contributor: string, artifactId: string) {
    bump(this.#saves, `${contributor}|${artifactId}`);
  }

  // Lets callers skip actions the climber could not contribute anyway.
  fallsLeft(contributor: string) {
    return CONTRIBUTOR_DAILY_FALL_CAP - (this.#falls.get(contributor) ?? 0);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const COUNTERS = [
  'short_jump',
  'overjump',
  'wall_bonk',
  'helper_overuse',
  'successfulClears',
] as const;
type Counter = (typeof COUNTERS)[number];

export function renderedArtifactsAt(
  snapshot: BoardSnapshot,
  siteId: string
): Artifact[] {
  return snapshot.zones
    .flatMap((zone) => zone.artifacts)
    .filter((artifact) => artifact.siteId === siteId);
}

// The first rendered artifact at a site, optionally of one type.
export function renderedArtifactAt(
  snapshot: BoardSnapshot,
  siteId: string,
  type?: Artifact['type']
): Artifact | undefined {
  return renderedArtifactsAt(snapshot, siteId).find(
    (artifact) => !type || artifact.type === type
  );
}

// Everything a climber can see change at a site: each artifact's shape and
// intensity tier, independent of draw order.
function siteSignature(snapshot: BoardSnapshot, siteId: string): string {
  return (
    renderedArtifactsAt(snapshot, siteId)
      .map((artifact) => `${artifact.type}:${artifact.tier}`)
      .sort()
      .join('+') || 'none'
  );
}

function siteById(snapshot: BoardSnapshot, siteId: string) {
  return snapshot.sites.find((site) => site.id === siteId);
}

function failureTotal(site: SiteSnapshot): number {
  return (
    site.counters.short_jump +
    site.counters.overjump +
    site.counters.wall_bonk +
    site.counters.helper_overuse
  );
}

export type MutationCheck = {
  ledger: ContractLedger;
  before: BoardSnapshot;
  after: BoardSnapshot;
  receipt: MutationReceipt;
  responseSnapshot: BoardSnapshot | undefined;
  expectedAccepted: boolean;
  newHints: {
    channel: string;
    boardId: string;
    revision: number;
    echo?: unknown;
  }[];
  counter: Counter | null;
  actorUsername: string | null;
};

// Shared checks for any event that can move a site counter.
export function checkMutation(input: MutationCheck) {
  const { ledger, before, after, receipt } = input;
  ledger.check(
    'mutation.caps',
    receipt.accepted === input.expectedAccepted,
    () =>
      `expected accepted=${input.expectedAccepted}, got ${receipt.accepted} (${receipt.rejection ?? 'none'}): ${receipt.copy}`
  );

  const accepted = receipt.accepted;
  const siteId = receipt.siteId;
  const delta = accepted && siteId && input.counter ? 1 : 0;
  const movedCounters: string[] = [];
  for (const site of after.sites) {
    const prior = siteById(before, site.id);
    if (!prior) continue;
    for (const counter of COUNTERS) {
      const expected =
        prior.counters[counter] +
        (site.id === siteId && counter === input.counter ? delta : 0);
      if (site.counters[counter] !== expected)
        movedCounters.push(
          `${site.name}.${counter} ${prior.counters[counter]}→${site.counters[counter]} (expected ${expected})`
        );
    }
  }
  const expectedRevision = before.revision + (accepted ? 1 : 0);
  const totalsOk =
    after.revision === expectedRevision &&
    after.totalFalls ===
      before.totalFalls +
        (accepted && input.counter !== 'successfulClears' && input.counter
          ? 1
          : 0) &&
    after.totalClears ===
      before.totalClears +
        (accepted && input.counter === 'successfulClears' ? 1 : 0);
  ledger.check(
    'mutation.counter-delta',
    movedCounters.length === 0 && totalsOk,
    () =>
      `revision ${before.revision}→${after.revision} (expected ${expectedRevision}); falls ${before.totalFalls}→${after.totalFalls}; clears ${before.totalClears}→${after.totalClears}; ${movedCounters.join('; ')}`
  );

  const changedElsewhere = after.sites.filter((site) => {
    if (site.id === siteId) return false;
    const prior = siteById(before, site.id);
    return (
      !prior ||
      prior.status !== site.status ||
      siteSignature(before, site.id) !== siteSignature(after, site.id)
    );
  });
  ledger.check(
    'mutation.locality',
    changedElsewhere.length === 0,
    () =>
      `also changed: ${changedElsewhere.map((site) => site.name).join(', ')}`
  );

  if (siteId && input.counter) {
    const prior = siteById(before, siteId);
    const next = siteById(after, siteId);
    ledger.check(
      'receipt.numbers',
      receipt.counterBefore === prior?.counters[input.counter] &&
        receipt.counterAfter === next?.counters[input.counter] &&
        receipt.revisionBefore === before.revision &&
        receipt.revisionAfter === after.revision,
      () =>
        `receipt ${receipt.counterBefore}→${receipt.counterAfter} r${receipt.revisionBefore}→${receipt.revisionAfter}; board ${prior?.counters[input.counter!]}→${next?.counters[input.counter!]} r${before.revision}→${after.revision}`
    );
  }

  if (input.responseSnapshot) {
    ledger.check(
      'receipt.response-snapshot',
      boardsEquivalent(input.responseSnapshot, after),
      () =>
        `response r${input.responseSnapshot!.revision} vs board r${after.revision}`
    );
  }

  checkVisibleChange(input);

  const channel = realtimeChannelForBoard(after.boardId);
  const expectedHints = accepted ? 1 : 0;
  ledger.check(
    'realtime.hint',
    input.newHints.length === expectedHints &&
      input.newHints.every(
        (hint) => hint.channel === channel && hint.revision === after.revision
      ),
    () =>
      `expected ${expectedHints} hint(s) at r${after.revision}, got ${JSON.stringify(input.newHints)}`
  );

  if (accepted && input.newHints.length === 1) {
    const echo = parseBoardEcho(input.newHints[0]!.echo);
    const expectedKind =
      input.counter === null
        ? 'summit'
        : input.counter === 'successfulClears'
          ? 'clear'
          : 'fall';
    const problems: string[] = [];
    if (!echo) problems.push('missing or malformed echo');
    else {
      if (echo.kind !== expectedKind)
        problems.push(`kind ${echo.kind} vs ${expectedKind}`);
      if (echo.key !== echoKeyForEvent(receipt.eventId))
        problems.push('key does not match the event');
      if (echo.siteId !== receipt.siteId || echo.bucket !== receipt.bucket)
        problems.push(`site/bucket ${echo.siteId}/${echo.bucket}`);
      if (echo.count !== receipt.counterAfter)
        problems.push(`count ${echo.count} vs ${receipt.counterAfter}`);
      if (echo.visibleChange !== receipt.visibleChange)
        problems.push(`change ${echo.visibleChange} vs ${receipt.visibleChange}`);
      if (expectedKind === 'fall' && echo.climber !== null)
        problems.push(`fall echo names ${echo.climber}`);
      if (
        expectedKind !== 'fall' &&
        input.actorUsername &&
        echo.climber !== `u/${input.actorUsername}`
      )
        problems.push(`positive echo names ${echo.climber}`);
    }
    ledger.check('realtime.echo', problems.length === 0, () =>
      problems.join('; ')
    );
  }

  if (input.counter && input.counter !== 'successfulClears') {
    const beat = after.recentMutations.find(
      (candidate) => candidate.revision === receipt.revisionAfter
    );
    const texts = [receipt.copy, beat?.copy ?? ''];
    // Display names reach shared copy only as `u/name` (see api.ts).
    const named = texts.some(
      (text) =>
        text.includes('u/') ||
        (input.actorUsername !== null &&
          new RegExp(`\\b${escapeRegExp(input.actorUsername)}\\b`, 'i').test(
            text
          ))
    );
    ledger.check(
      'privacy.failure-anonymous',
      !named,
      () => `failure copy names a climber: ${texts.join(' | ')}`
    );
  }
}

function checkVisibleChange(input: MutationCheck) {
  const { ledger, before, after, receipt } = input;
  const siteId = receipt.siteId;
  if (!siteId || !input.counter) return;
  const prior = siteSignature(before, siteId);
  const next = siteSignature(after, siteId);
  const statusBefore = siteById(before, siteId)?.status;
  const status = siteById(after, siteId)?.status;
  const rendersChanged = prior !== next;
  const change = receipt.visibleChange;
  const describe = () =>
    `${receipt.siteName} ${prior}/${statusBefore} → ${next}/${status}: "${receipt.copy}"`;

  if (change === 'artifact_spawned' || change === 'artifact_upgraded') {
    ledger.check(
      'receipt.promise-visible',
      rendersChanged,
      () => `${change}, but nothing new renders at ${describe()}`
    );
  } else if (change === 'site_cursed') {
    const overgrown =
      (statusBefore !== status &&
        (status === 'Cursed' || status === 'Haunted')) ||
      (rendersChanged &&
        renderedArtifactsAt(after, siteId).some(
          (artifact) => artifact.tier === 'saturated'
        ));
    ledger.check(
      'receipt.promise-visible',
      overgrown,
      () =>
        `site_cursed, but the site did not visibly overgrow at ${describe()}`
    );
  } else if (change === 'site_reinforced' || change === 'site_stabilized') {
    const expected: ZoneStatus =
      change === 'site_reinforced' ? 'Reinforced' : 'Stabilized';
    ledger.check(
      'receipt.promise-visible',
      status === expected,
      () => `${change}, but the status is ${status} at ${describe()}`
    );
  }

  const priorSite = siteById(before, siteId);
  const nextSite = siteById(after, siteId);
  const bucket = input.counter === 'successfulClears' ? 'successful_clear' : input.counter;
  if (
    receipt.accepted &&
    priorSite &&
    nextSite &&
    bucketDrivesVisibleSlot(priorSite.counters, bucket)
  ) {
    ledger.check(
      'receipt.every-fall-visible',
      siteFace(priorSite) !== siteFace(nextSite),
      () => `${receipt.siteName} drew the same face after ${describe()}`
    );
  }

  if (receipt.accepted && (rendersChanged || statusBefore !== status)) {
    ledger.check(
      'receipt.no-silent-change',
      change !== 'mark_added' && change !== 'none',
      () => `the site changed under a plain receipt at ${describe()}`
    );
  }
}

// Structural checks that hold for any board any climber can load.
export function checkSnapshot(ledger: ContractLedger, snapshot: BoardSnapshot) {
  const problems: string[] = [];
  for (const zone of snapshot.zones) {
    for (const artifact of zone.artifacts) {
      const site = siteById(snapshot, artifact.siteId);
      if (!site) {
        problems.push(`${artifact.id} has no site`);
        continue;
      }
      const counter =
        artifact.bucket === 'successful_clear'
          ? 'successfulClears'
          : artifact.bucket;
      if (artifact.count !== site.counters[counter])
        problems.push(
          `${artifact.id} count ${artifact.count} vs counter ${site.counters[counter]}`
        );
      if (artifact.seededCount + artifact.organicCount !== artifact.count)
        problems.push(
          `${artifact.id} ${artifact.seededCount}+${artifact.organicCount}≠${artifact.count}`
        );
      if (artifact.organicCount !== site.organicCounters[counter])
        problems.push(
          `${artifact.id} organic ${artifact.organicCount} vs ${site.organicCounters[counter]}`
        );
      if (
        !artifact.label.includes(String(artifact.count)) &&
        !artifact.label.includes(String(artifact.organicCount))
      )
        problems.push(
          `${artifact.id} label "${artifact.label}" hides its count`
        );
    }
  }
  const organicFailures = snapshot.sites.reduce(
    (sum, site) =>
      sum +
      site.organicCounters.short_jump +
      site.organicCounters.overjump +
      site.organicCounters.wall_bonk +
      site.organicCounters.helper_overuse,
    0
  );
  if (organicFailures !== snapshot.organicFalls)
    problems.push(
      `organic site failures ${organicFailures} vs organicFalls ${snapshot.organicFalls}`
    );
  if (!snapshot.headline.includes(`${snapshot.organicFalls} community`))
    problems.push(
      `headline "${snapshot.headline}" vs ${snapshot.organicFalls}`
    );
  ledger.check('snapshot.provenance', problems.length === 0, () =>
    problems.slice(0, 4).join('; ')
  );

  const rollup: string[] = [];
  for (const zone of snapshot.zones) {
    const sites = snapshot.sites.filter((site) => site.zoneId === zone.id);
    for (const counter of COUNTERS) {
      const sum = sites.reduce(
        (total, site) => total + site.counters[counter],
        0
      );
      if (sum !== zone.counters[counter])
        rollup.push(
          `${zone.name}.${counter} ${zone.counters[counter]} vs sites ${sum}`
        );
    }
    const bounds = zoneById(zone.id);
    for (const artifact of zone.artifacts) {
      if (artifact.zoneId !== zone.id)
        rollup.push(`${artifact.id} rendered in ${zone.name}`);
      if (
        artifact.y < bounds.yTop ||
        artifact.y + artifact.height > bounds.yBottom
      )
        rollup.push(`${artifact.id} outside ${zone.name} bounds`);
    }
  }
  ledger.check('snapshot.zone-rollup', rollup.length === 0, () =>
    rollup.slice(0, 4).join('; ')
  );
}

// Design-pressure measurements over a board, counted per sample.
export function probeSnapshot(ledger: ContractLedger, snapshot: BoardSnapshot) {
  for (const site of snapshot.sites) {
    const rendered = renderedArtifactsAt(snapshot, site.id);
    ledger.probe(
      'probe.hidden-artifact',
      Math.max(0, site.artifacts.length - rendered.length),
      () =>
        `${site.name}: earned ${site.artifacts.map((artifact) => artifact.type).join(' + ')}, renders ${rendered.map((artifact) => artifact.type).join(' + ') || 'nothing'}`
    );
  }
  for (const zone of snapshot.zones) {
    const sites = snapshot.sites.filter((site) => site.zoneId === zone.id);
    const target = [...sites].sort(
      (left, right) => failureTotal(right) - failureTotal(left)
    )[0];
    for (const site of sites) {
      if (site === target) continue;
      if (!renderedArtifactAt(snapshot, site.id, 'cursed_brick')) continue;
      ledger.probe(
        'probe.uncalmable-curse',
        1,
        () =>
          `${site.name} (${failureTotal(site)} failures) is cursed, but clears go to ${target?.name} (${target ? failureTotal(target) : 0})`
      );
    }
    if (sites.length > 0 && sites.every((site) => site.status !== zone.status))
      ledger.probe(
        'probe.zone-site-status',
        1,
        () =>
          `${zone.name} reads ${zone.status}; sites read ${sites.map((site) => site.status).join('/')}`
      );
  }
}

export function checkSaves(input: {
  ledger: ContractLedger;
  before: BoardSnapshot;
  after: BoardSnapshot;
  receipt: MutationReceipt;
  zoneId: ZoneId;
  helperArtifactIds: string[];
  caps: CapModel;
  contributor: string;
}) {
  const { before, after, receipt } = input;
  const expected = receipt.accepted
    ? resolveClearRescuers(before, input.zoneId, input.helperArtifactIds)
        .map((rescuer) => rescuer.id)
        .filter((id) => input.caps.wouldAcceptSave(input.contributor, id))
    : [];
  for (const id of expected) input.caps.recordSave(input.contributor, id);
  const problems: string[] = [];
  const ids = new Set([
    ...Object.keys(before.saves),
    ...Object.keys(after.saves),
  ]);
  for (const id of ids) {
    const delta = (after.saves[id] ?? 0) - (before.saves[id] ?? 0);
    const want = expected.includes(id) ? 1 : 0;
    if (delta !== want) problems.push(`${id} moved ${delta}, expected ${want}`);
  }
  const credited = (receipt.saves ?? []).map((save) => save.artifactId).sort();
  if (credited.join() !== [...expected].sort().join())
    problems.push(`receipt thanked ${credited.join() || 'nothing'}, expected ${expected.join() || 'nothing'}`);
  for (const id of expected) {
    const artifact = after.zones
      .flatMap((zone) => zone.artifacts)
      .find((candidate) => candidate.id === id);
    if (artifact && artifact.saves !== after.saves[id])
      problems.push(`${id} renders caught ${artifact.saves}, board has ${after.saves[id]}`);
  }
  input.ledger.check('clear.saves', problems.length === 0, () =>
    problems.slice(0, 4).join('; ')
  );
}

export function checkClearTarget(
  ledger: ContractLedger,
  before: BoardSnapshot,
  receipt: MutationReceipt,
  zoneId: string
) {
  const sites = before.sites.filter((site) => site.zoneId === zoneId);
  const most = Math.max(...sites.map(failureTotal));
  const chosen = sites.find((site) => site.id === receipt.siteId);
  ledger.check(
    'clear.target',
    Boolean(chosen) && failureTotal(chosen!) === most,
    () =>
      `clear credited ${chosen?.name ?? receipt.siteId} (${chosen ? failureTotal(chosen) : '?'} failures); most-scarred has ${most}`
  );
}

// Observer side: after syncing, the observer must hold the authoritative
// board and must have been offered every visible beat it missed.
export function checkObserverSync(input: {
  ledger: ContractLedger;
  previous: BoardSnapshot;
  synced: BoardSnapshot;
  authoritative: BoardSnapshot;
  fullFetches: number;
  visibleBeats: MutationBeat[];
}) {
  const { ledger, previous, synced, authoritative } = input;
  if (previous.revision === authoritative.revision) {
    ledger.check(
      'remote.quiet-poll',
      input.fullFetches === 0,
      () =>
        `downloaded ${input.fullFetches} full snapshot(s) at unchanged r${previous.revision}`
    );
    return;
  }
  ledger.check(
    'remote.convergence',
    boardsEquivalent(synced, authoritative),
    () => `observer at r${synced.revision}, board at r${authoritative.revision}`
  );
  const missed = input.visibleBeats.filter(
    (beat) => beat.revision > previous.revision
  );
  const offered = new Set(synced.recentMutations.map((beat) => beat.revision));
  const window = missed.slice(-20);
  ledger.check(
    'remote.beat',
    window.every((beat) => offered.has(beat.revision)),
    () =>
      `missing beats ${window
        .filter((beat) => !offered.has(beat.revision))
        .map((beat) => `r${beat.revision} ${beat.copy}`)
        .join('; ')}`
  );
  ledger.probe(
    'probe.beats-collapsed',
    Math.max(0, missed.length - 1),
    () =>
      `observer jumped r${previous.revision}→r${synced.revision}; ${missed.length} visible changes, one beat shown`
  );
}

export function boardsEquivalent(left: BoardSnapshot, right: BoardSnapshot) {
  if (left.boardId !== right.boardId || left.revision !== right.revision)
    return false;
  if (
    left.totalFalls !== right.totalFalls ||
    left.totalClears !== right.totalClears ||
    left.totalSummits !== right.totalSummits
  )
    return false;
  const saveIds = new Set([
    ...Object.keys(left.saves),
    ...Object.keys(right.saves),
  ]);
  for (const id of saveIds)
    if ((left.saves[id] ?? 0) !== (right.saves[id] ?? 0)) return false;
  return left.sites.every((site) => {
    const other = siteById(right, site.id);
    return (
      other !== undefined &&
      COUNTERS.every(
        (counter) => site.counters[counter] === other.counters[counter]
      )
    );
  });
}

// Contract edges that currently fail, with the reason. Each entry has a
// deterministic reproduction in connectivity.test.ts that fails once the gap
// is fixed, so this list can only shrink.
export const KNOWN_CONNECTIVITY_GAPS: Partial<Record<EdgeId, string>> = {};
