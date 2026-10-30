// Drives a simulated community through the real API and checks the
// connectivity contract after every action. `ConnectivityRun` is the checked
// action layer used by scripted scenarios; `runCommunitySimulation` adds a
// seeded population of climbers whose odds react to what they can see, so the
// help/distort feedback loop runs the way it does on a live board.
import type { ApiErrorResponse } from '../../shared/api.js';
import type { BoardSnapshot, MutationBeat } from '../../shared/game/board.js';
import {
  earnedRescuers,
  TOP_ZONE_ID,
  ZONE_IDS,
  type FailureBucket,
  type ZoneId,
} from '../../shared/game/mutation.js';
import type { MutationReceipt } from '../../shared/game/mutation-receipts.js';
import { MAX_CLEAR_HELPERS } from '../../shared/game/events.js';
import {
  createCommunity,
  type ApiCall,
  type Community,
  type FallIntent,
  type Player,
  type PlayerIdentity,
} from './community.js';
import {
  CONNECTIVITY_EDGES,
  CapModel,
  ContractLedger,
  checkClearTarget,
  checkMutation,
  checkObserverSync,
  checkSaves,
  checkSnapshot,
  probeSnapshot,
  renderedArtifactsAt,
  type EdgeId,
  type Violation,
} from './connectivity-contract.js';

type ReceiptBody = { receipt?: MutationReceipt; snapshot?: BoardSnapshot };

export class ConnectivityRun {
  readonly ledger: ContractLedger;
  readonly caps = new CapModel();
  readonly visibleBeats: MutationBeat[] = [];
  readonly outcomes = new Map<string, number>();
  // siteId -> contributor -> accepted contributions, for shared-encounter probes.
  readonly #contributions = new Map<string, Map<string, number>>();
  readonly #zoneClears = new Map<string, number>();
  readonly #totalClears = new Map<string, number>();
  #bestStabilizer = { name: '', contributor: '', clears: 0 };

  constructor(
    readonly community: Community,
    ledger = new ContractLedger()
  ) {
    this.ledger = ledger;
  }

  async fall(player: Player, intent: FallIntent) {
    const before = await this.begin(player);
    const hintStart = this.community.hints.length;
    const viewRevision = player.view?.revision ?? -1;
    const request = player.buildFall(intent);
    if (!request) return null;
    const usesHelper = request.lastHelperArtifactId !== null;
    const call = await player.resend<ReceiptBody>('/record-fall', request);
    const receipt = receiptOf(call);
    const invalid = !call.ok && receipt?.rejection === 'invalid';
    const evidenceEdge: EdgeId =
      usesHelper && viewRevision < before.revision
        ? 'fall.stale-helper-accepted'
        : 'fall.evidence-accepted';
    this.ledger.check(
      evidenceEdge,
      !invalid,
      () =>
        `${intent.bucket} at ${siteName(before, intent.siteId)} rejected: ${errorMessage(call)} (view r${viewRevision}, board r${before.revision}, helper ${request.lastHelperArtifactId})`
    );
    this.count(receipt ? receiptOutcome(receipt) : `http-${call.status}`);
    if (!receipt || invalid) return call;

    const after = await this.community.authoritative();
    this.ledger.check(
      'fall.attribution',
      receipt.siteId === intent.siteId && receipt.bucket === intent.bucket,
      () =>
        `intended ${intent.bucket} at ${siteName(before, intent.siteId)}, credited ${receipt.bucket} at ${receipt.siteName}`
    );
    this.probeEncounter(player, before, intent.siteId);
    const expectedAccepted = this.caps.wouldAcceptFall(
      player.contributorKey,
      intent.siteId,
      intent.bucket
    );
    if (receipt.accepted)
      this.caps.recordFall(player.contributorKey, intent.siteId, intent.bucket);
    checkMutation({
      ledger: this.ledger,
      before,
      after,
      receipt,
      responseSnapshot: (call.body as ReceiptBody).snapshot,
      expectedAccepted,
      newHints: this.community.hints.slice(hintStart),
      counter: intent.bucket,
      actorUsername: usernameOf(player.identity),
    });
    this.finish(after, receipt, player);
    return call;
  }

  async clear(player: Player, zoneId: ZoneId, helperArtifactIds: string[] = []) {
    const before = await this.begin(player);
    const hintStart = this.community.hints.length;
    const othersResume = await this.resumeSnapshot(player);
    const call = await player.clear(zoneId, helperArtifactIds);
    const receipt = receiptOf(call);
    this.count(receipt ? receiptOutcome(receipt) : `http-${call.status}`);
    if (!receipt || !call.ok) return call;
    const after = await this.community.authoritative();
    checkClearTarget(this.ledger, before, receipt, zoneId);
    if (receipt.siteId) this.probeEncounter(player, before, receipt.siteId);
    const expectedAccepted = this.caps.wouldAcceptClear(
      player.contributorKey,
      zoneId
    );
    if (receipt.accepted) this.caps.recordClear(player.contributorKey, zoneId);
    checkSaves({
      ledger: this.ledger,
      before,
      after,
      receipt,
      zoneId,
      helperArtifactIds,
      caps: this.caps,
      contributor: player.contributorKey,
    });
    checkMutation({
      ledger: this.ledger,
      before,
      after,
      receipt,
      responseSnapshot: (call.body as ReceiptBody).snapshot,
      expectedAccepted,
      newHints: this.community.hints.slice(hintStart),
      counter: 'successfulClears',
      actorUsername: usernameOf(player.identity),
    });
    const nextZone = ZONE_IDS[ZONE_IDS.indexOf(zoneId) + 1];
    const resumeChanged = await this.resumeChangedFor(othersResume);
    this.ledger.check(
      'clear.resume',
      player.resume?.zoneId === nextZone && resumeChanged.length === 0,
      () =>
        `clearer resumes at ${player.resume?.zoneId} (expected ${nextZone}); others moved: ${resumeChanged.join(', ')}`
    );
    if (receipt.accepted) {
      // Best stabilizer = most accepted clears in a single zone; ties keep
      // the earlier holder. Tracked independently of the server's fields.
      const zoneClears = bump(
        this.#zoneClears,
        `${player.contributorKey}|${zoneId}`
      );
      bump(this.#totalClears, player.contributorKey);
      if (zoneClears > this.#bestStabilizer.clears)
        this.#bestStabilizer = {
          name: displayName(player.identity),
          contributor: player.contributorKey,
          clears: zoneClears,
        };
      this.ledger.check(
        'achievement.named',
        after.result.bestStabilizerUsername === this.#bestStabilizer.name,
        () =>
          `best stabilizer reads ${after.result.bestStabilizerUsername}, expected ${this.#bestStabilizer.name}`
      );
    }
    this.finish(after, receipt, player);
    return call;
  }

  async summit(player: Player) {
    const before = await this.begin(player);
    const hintStart = this.community.hints.length;
    const call = await player.summit();
    const receipt = receiptOf(call);
    this.count(receipt ? receiptOutcome(receipt) : `http-${call.status}`);
    if (!receipt || !call.ok) return call;
    const after = await this.community.authoritative();
    const expectedAccepted = this.caps.wouldAcceptSummit(player.contributorKey);
    if (receipt.accepted) this.caps.recordSummit(player.contributorKey);
    checkMutation({
      ledger: this.ledger,
      before,
      after,
      receipt,
      responseSnapshot: (call.body as ReceiptBody).snapshot,
      expectedAccepted,
      newHints: this.community.hints.slice(hintStart),
      counter: null,
      actorUsername: usernameOf(player.identity),
    });
    const username = usernameOf(player.identity);
    if (receipt.accepted && before.totalSummits === 0 && username) {
      this.ledger.check(
        'achievement.named',
        after.result.firstSummitUsername === `u/${username}`,
        () =>
          `first summit reads ${after.result.firstSummitUsername}, expected u/${username}`
      );
    }
    this.finish(after, receipt, player);
    return call;
  }

  async sync(player: Player) {
    if (!player.view) {
      await player.init();
      return;
    }
    const previous = player.view;
    const { fullFetches } = await player.poll();
    const authoritative = await this.community.authoritative();
    checkObserverSync({
      ledger: this.ledger,
      previous,
      synced: player.view,
      authoritative,
      fullFetches,
      visibleBeats: this.visibleBeats,
    });
  }

  probeFinal(snapshot: BoardSnapshot) {
    probeSnapshot(this.ledger, snapshot);
    const holder = this.#bestStabilizer;
    const holderTotal = this.#totalClears.get(holder.contributor) ?? 0;
    const outclimbed = [...this.#totalClears].filter(
      ([contributor, total]) =>
        contributor !== holder.contributor && total > holderTotal
    );
    this.ledger.probe(
      'probe.stabilizer-title',
      outclimbed.length,
      () =>
        `${holder.name} holds best stabilizer with ${holderTotal} clean clears; ${outclimbed.length} climber(s) have more (top ${Math.max(...outclimbed.map(([, total]) => total))})`
    );
  }

  private async begin(player: Player) {
    this.ledger.step += 1;
    this.ledger.actor = player.name;
    if (!player.view) await player.init();
    return this.community.authoritative();
  }

  private finish(
    after: BoardSnapshot,
    receipt: MutationReceipt,
    player: Player
  ) {
    checkSnapshot(this.ledger, after);
    if (!receipt.accepted) return;
    const beat = after.recentMutations.find(
      (candidate) => candidate.revision === receipt.revisionAfter
    );
    if (beat) this.visibleBeats.push(beat);
    if (receipt.siteId) {
      const bySite = this.#contributions.get(receipt.siteId) ?? new Map();
      bySite.set(
        player.contributorKey,
        (bySite.get(player.contributorKey) ?? 0) + 1
      );
      this.#contributions.set(receipt.siteId, bySite);
    }
  }

  private probeEncounter(
    player: Player,
    before: BoardSnapshot,
    siteId: string
  ) {
    const others = [
      ...(this.#contributions.get(siteId) ?? new Map<string, number>()),
    ]
      .filter(([contributor]) => contributor !== player.contributorKey)
      .reduce((sum, [, count]) => sum + count, 0);
    const rendered = renderedArtifactsAt(before, siteId)
      .map((artifact) => artifact.type)
      .join(' + ');
    this.ledger.probe(
      'probe.shared-encounter',
      others > 0 ? 1 : 0,
      () =>
        `${player.name} met ${siteName(before, siteId)} carrying ${others} mutation(s) from others (renders ${rendered || 'nothing'})`
    );
  }

  private async resumeSnapshot(except: Player) {
    const others = this.players.filter(
      (player) => player !== except && player.identity.kind === 'account'
    );
    return Promise.all(
      others.map(async (player) => ({
        player,
        zoneId: (await player.peekResume()).zoneId,
      }))
    );
  }

  private async resumeChangedFor(before: { player: Player; zoneId: ZoneId }[]) {
    const changed: string[] = [];
    for (const entry of before) {
      const now = (await entry.player.peekResume()).zoneId;
      if (now !== entry.zoneId)
        changed.push(`${entry.player.name} ${entry.zoneId}→${now}`);
    }
    return changed;
  }

  readonly players: Player[] = [];

  join(name: string, identity: PlayerIdentity) {
    const player = this.community.join(name, identity);
    this.players.push(player);
    return player;
  }

  private count(outcome: string) {
    this.outcomes.set(outcome, (this.outcomes.get(outcome) ?? 0) + 1);
  }
}

export type SimulationConfig = {
  seed: number;
  date: string;
  players: number;
  steps: number;
  accountShare?: number;
  loidShare?: number;
  // Added to each climber's skill (0.5-0.92) to get per-jump success odds.
  jumpEase?: number;
};

export type EdgeReport = {
  id: EdgeId;
  kind: 'contract' | 'probe';
  from: string;
  to: string;
  rule: string;
  exercised: number;
  failed: number;
  probeCount: number;
  samples: string[];
};

export type SimulationReport = {
  config: SimulationConfig;
  outcomes: Record<string, number>;
  edges: EdgeReport[];
  violations: Violation[];
  metrics: {
    acceptedEvents: number;
    organicFalls: number;
    clears: number;
    saves: number;
    summits: number;
    visibleBeats: number;
    renderedArtifacts: number;
    organicArtifacts: number;
    firstOrganicArtifactStep: number | null;
    zonesReached: number;
  };
  finalZones: {
    name: string;
    status: string;
    artifacts: string[];
  }[];
};

type Climber = {
  player: Player;
  skill: number;
  zoneIndex: number;
  siteIndex: number;
  budget: number;
  sessionsLeft: number;
  syncDiligence: number;
};

export async function runCommunitySimulation(
  config: SimulationConfig
): Promise<SimulationReport> {
  const random = mulberry32(config.seed);
  const community = createCommunity({
    start: new Date(`${config.date}T08:00:00.000Z`),
  });
  const run = new ConnectivityRun(community);
  const accountShare = config.accountShare ?? 0.8;
  const loidShare = config.loidShare ?? 0.15;
  const climbers: Climber[] = Array.from(
    { length: config.players },
    (_, index) => {
      const roll = random();
      const name = `climber${index + 1}`;
      const identity: PlayerIdentity =
        roll < accountShare
          ? { kind: 'account', userId: `t2_${name}`, username: name }
          : roll < accountShare + loidShare
            ? { kind: 'loid', loid: `loid_${name}` }
            : { kind: 'anonymous' };
      return {
        player: run.join(name, identity),
        skill: 0.5 + random() * 0.42,
        zoneIndex: 0,
        siteIndex: 0,
        budget: 0,
        sessionsLeft: 1 + Math.floor(random() * 3),
        syncDiligence: 0.3 + random() * 0.6,
      };
    }
  );

  let firstOrganicArtifactStep: number | null = null;
  let zonesReached = 0;

  for (let step = 0; step < config.steps; step += 1) {
    const active = climbers.filter(
      (climber) => climber.budget > 0 || climber.sessionsLeft > 0
    );
    if (active.length === 0) break;
    const climber = active[Math.floor(random() * active.length)]!;
    community.clock.advance(2_000 + Math.floor(random() * 40_000));

    if (climber.budget <= 0) {
      climber.sessionsLeft -= 1;
      climber.budget = 6 + Math.floor(random() * 14);
      if (climber.player.view) await run.sync(climber.player);
      else await climber.player.init();
      const resume = climber.player.resume?.zoneId ?? ZONE_IDS[0];
      climber.zoneIndex =
        climber.player.identity.kind === 'account'
          ? ZONE_IDS.indexOf(resume)
          : 0;
      climber.siteIndex = 0;
      continue;
    }

    // Realtime hints arrive while playing; diligent clients apply them sooner.
    if (climber.player.hasPendingHint() && random() < climber.syncDiligence) {
      await run.sync(climber.player);
    } else if (random() < 0.05) {
      await run.sync(climber.player);
    }

    const view = climber.player.view!;
    const zoneId = ZONE_IDS[climber.zoneIndex]!;
    const sites = view.sites.filter((site) => site.zoneId === zoneId);
    climber.budget -= 1;

    if (climber.siteIndex >= sites.length) {
      if (zoneId === TOP_ZONE_ID) {
        await run.summit(climber.player);
        climber.budget = 0;
        climber.sessionsLeft = 0;
      } else {
        // The climber stood on some of the zone's community rescuers on the
        // way up; now and then a client reports one that does not exist.
        const helpers = earnedRescuers(view.sites)
          .filter((rescuer) => rescuer.zoneId === zoneId && random() < 0.5)
          .map((rescuer) => rescuer.id);
        if (random() < 0.05) helpers.unshift(`${sites[0]?.id ?? 'x'}-forged`);
        // The shipped client sends at most this many, like the scene does.
        await run.clear(
          climber.player,
          zoneId,
          helpers.slice(0, MAX_CLEAR_HELPERS)
        );
        climber.zoneIndex += 1;
        climber.siteIndex = 0;
        zonesReached = Math.max(zonesReached, climber.zoneIndex);
      }
      continue;
    }

    const site = sites[climber.siteIndex]!;
    const rendered = renderedArtifactsAt(view, site.id).map(
      (artifact) => artifact.type
    );
    let success = climber.skill + (config.jumpEase ?? 0.12);
    if (rendered.includes('corpse_stack') || rendered.includes('mercy_nail'))
      success += 0.08;
    if (rendered.includes('ghost_platform')) success += 0.04;
    if (rendered.includes('cursed_brick')) success -= 0.08;
    if (site.status === 'Cursed') success -= 0.04;
    if (random() < Math.min(0.97, success)) {
      climber.siteIndex += 1;
      continue;
    }

    climber.siteIndex = 0;
    const helper = climber.player.visibleHelperAt(site.id);
    const bucket: FailureBucket =
      helper && random() < 0.35 ? 'helper_overuse' : pickBucket(random);
    await run.fall(climber.player, { siteId: site.id, bucket });
    if (firstOrganicArtifactStep === null) {
      const board = climber.player.view;
      if (
        board?.zones.some((zone) =>
          zone.artifacts.some((artifact) => artifact.organicCount > 0)
        )
      )
        firstOrganicArtifactStep = step;
    }
  }

  const final = await community.authoritative();
  run.probeFinal(final);
  const rendered = final.zones.flatMap((zone) => zone.artifacts);
  return {
    config,
    outcomes: Object.fromEntries(run.outcomes),
    edges: edgeReports(run.ledger),
    violations: run.ledger.violations,
    metrics: {
      acceptedEvents: final.revision - (final.totalFalls - final.organicFalls),
      organicFalls: final.organicFalls,
      clears: final.totalClears,
      saves: Object.values(final.saves).reduce((sum, value) => sum + value, 0),
      summits: final.totalSummits,
      visibleBeats: run.visibleBeats.length,
      renderedArtifacts: rendered.length,
      organicArtifacts: rendered.filter((artifact) => artifact.organicCount > 0)
        .length,
      firstOrganicArtifactStep,
      zonesReached,
    },
    finalZones: final.zones.map((zone) => ({
      name: zone.name,
      status: zone.status,
      artifacts: zone.artifacts.map(
        (artifact) =>
          `${artifact.type} ×${artifact.count} @ ${artifact.siteName}`
      ),
    })),
  };
}

export function edgeReports(ledger: ContractLedger): EdgeReport[] {
  return (Object.keys(CONNECTIVITY_EDGES) as EdgeId[]).map((id) => ({
    id,
    ...CONNECTIVITY_EDGES[id],
    exercised: ledger.exercised.get(id) ?? 0,
    failed: ledger.failed.get(id) ?? 0,
    probeCount: ledger.probes.get(id) ?? 0,
    samples: ledger.probeSamples.get(id) ?? [],
  }));
}

function pickBucket(random: () => number): FailureBucket {
  const roll = random();
  if (roll < 0.5) return 'short_jump';
  if (roll < 0.75) return 'overjump';
  return 'wall_bonk';
}

function receiptOf(call: ApiCall<unknown>): MutationReceipt | null {
  return (call.body as ReceiptBody).receipt ?? null;
}

function receiptOutcome(receipt: MutationReceipt): string {
  if (receipt.accepted)
    return `${receipt.bucket ?? 'summit'}:${receipt.visibleChange}`;
  return `rejected:${receipt.rejection}`;
}

function errorMessage(call: ApiCall<unknown>): string {
  return (call.body as ApiErrorResponse).message ?? `HTTP ${call.status}`;
}

function siteName(snapshot: BoardSnapshot, siteId: string): string {
  return snapshot.sites.find((site) => site.id === siteId)?.name ?? siteId;
}

function displayName(identity: PlayerIdentity): string {
  return identity.kind === 'account'
    ? `u/${identity.username}`
    : 'a quiet climber';
}

function bump(map: Map<string, number>, key: string): number {
  const next = (map.get(key) ?? 0) + 1;
  map.set(key, next);
  return next;
}

function usernameOf(identity: PlayerIdentity): string | null {
  return identity.kind === 'account' ? identity.username : null;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
