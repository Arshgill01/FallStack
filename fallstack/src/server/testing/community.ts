// A simulated subreddit: many players sharing one Redis, one clock, and one
// realtime bus, each talking to the real Hono API under their own identity.
// Players keep a client-style view of the board and only learn about other
// players' mutations the way the shipped client does: a realtime revision
// hint or a /board-revision poll followed by /init-game.
import type {
  ApiErrorResponse,
  BoardRevisionResponse,
  InitGameResponse,
  PlayerResume,
  RecordClearRequest,
  RecordClearResponse,
  RecordFallRequest,
  RecordFallResponse,
  RecordSummitRequest,
  RecordSummitResponse,
} from '../../shared/api.js';
import type { BoardSnapshot } from '../../shared/game/board.js';
import type {
  Artifact,
  FailureBucket,
  SiteSnapshot,
  ZoneId,
} from '../../shared/game/mutation.js';
import {
  realtimeChannelForBoard,
  type BoardEcho,
  type BoardRevisionMessage,
} from '../../shared/realtime.js';
import {
  generateDailyTower,
  zoneById,
  type Platform,
} from '../../shared/game/tower.js';
import { boardSnapshotFor, createBoardStore } from '../board-store.js';
import { createApi } from '../routes/api.js';
import { InMemoryRedis } from './in-memory-redis.js';

export type PlayerIdentity =
  | { kind: 'account'; userId: string; username: string }
  | { kind: 'loid'; loid: string }
  | { kind: 'anonymous' };

export type RealtimeHint = {
  channel: string;
  boardId: string;
  revision: number;
  echo?: BoardEcho;
  at: number;
};

export type FallIntent = {
  siteId: string;
  bucket: FailureBucket;
  // For helper slips: the helper the player last touched. Defaults to the
  // helper the player can currently see at that site.
  helperArtifactId?: string;
};

export type ApiCall<T> = {
  status: number;
  ok: boolean;
  body: T | ApiErrorResponse;
  request: unknown;
};

export type CommunityOptions = {
  start?: Date;
  subredditId?: string;
  subredditName?: string;
  postId?: string;
};

export function createCommunity(options: CommunityOptions = {}) {
  const redis = new InMemoryRedis();
  let nowMs = (options.start ?? new Date('2026-10-27T12:00:00.000Z')).getTime();
  const hints: RealtimeHint[] = [];
  const subscribers = new Set<(hint: RealtimeHint) => void>();
  const subredditId = options.subredditId ?? 'fallstack_dev';
  const subredditName = options.subredditName ?? 'fallstack_dev';
  const postId = options.postId ?? 't3_connectivity';
  const realtime = {
    async send(channel: string, message: BoardRevisionMessage) {
      const hint = { channel, ...message, at: nowMs };
      hints.push(hint);
      for (const subscriber of subscribers) subscriber(hint);
    },
  };

  const clock = {
    now: () => new Date(nowMs),
    nowMs: () => nowMs,
    advance(ms: number) {
      nowMs += ms;
      redis.advanceTime(ms);
    },
  };

  function storeFor(identity: PlayerIdentity) {
    return createBoardStore({
      redis,
      context: {
        subredditId,
        subredditName,
        ...(identity.kind === 'account' ? { userId: identity.userId } : {}),
        ...(identity.kind === 'loid' ? { loid: identity.loid } : {}),
      },
      now: clock.now,
    });
  }

  const observer = storeFor({ kind: 'anonymous' });

  return {
    redis,
    clock,
    hints,
    subredditId,
    async authoritative(): Promise<BoardSnapshot> {
      return boardSnapshotFor(await observer.loadBoardState());
    },
    join(name: string, identity: PlayerIdentity): Player {
      const store = storeFor(identity);
      const username =
        identity.kind === 'account' ? identity.username : undefined;
      const api = createApi({
        context: {
          postId,
          subredditName,
          ...(username ? { username } : {}),
        },
        reddit: { getCurrentUsername: async () => username },
        realtime,
        boardStore: store,
        now: clock.nowMs,
      });
      const player = new Player(name, identity, api, clock.nowMs, () =>
        store.loadPlayerResume()
      );
      subscribers.add((hint) => player.receiveHint(hint));
      return player;
    },
  };
}

export type Community = ReturnType<typeof createCommunity>;

type HonoLike = {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>;
};

export class Player {
  view: BoardSnapshot | null = null;
  resume: PlayerResume | null = null;
  readonly receivedHints: RealtimeHint[] = [];
  #eventSerial = 0;

  constructor(
    readonly name: string,
    readonly identity: PlayerIdentity,
    private readonly api: HonoLike,
    private readonly nowMs: () => number,
    // Reads the stored checkpoint without touching the client view.
    readonly peekResume: () => Promise<PlayerResume>
  ) {}

  get contributorKey(): string {
    if (this.identity.kind === 'account') return this.identity.userId;
    if (this.identity.kind === 'loid') return this.identity.loid;
    return 'anonymous';
  }

  receiveHint(hint: RealtimeHint) {
    if (
      this.view &&
      hint.channel === realtimeChannelForBoard(this.view.boardId)
    )
      this.receivedHints.push(hint);
  }

  // True when a realtime hint promised a newer revision than the view shows.
  hasPendingHint(): boolean {
    const revision = this.view?.revision ?? -1;
    return this.receivedHints.some((hint) => hint.revision > revision);
  }

  async init(): Promise<InitGameResponse> {
    const response = await this.get<InitGameResponse>('/init-game');
    if (!response.ok) throw new Error(`${this.name} could not init the board`);
    const body = response.body as InitGameResponse;
    this.view = body.snapshot;
    this.resume = body.resume;
    return body;
  }

  // Mirrors client/game/board-sync.ts fetchChangedBoardSnapshot: a cheap
  // revision probe, then a full snapshot only when the board moved.
  async poll(): Promise<{ changed: boolean; fullFetches: number }> {
    if (!this.view) {
      await this.init();
      return { changed: true, fullFetches: 1 };
    }
    const probe = await this.get<BoardRevisionResponse>('/board-revision');
    const revision = probe.body as BoardRevisionResponse;
    if (
      revision.boardId === this.view.boardId &&
      revision.revision <= this.view.revision
    )
      return { changed: false, fullFetches: 0 };
    const full = await this.get<InitGameResponse>('/init-game');
    this.view = (full.body as InitGameResponse).snapshot;
    return { changed: true, fullFetches: 1 };
  }

  site(siteId: string): SiteSnapshot | undefined {
    return this.view?.sites.find((site) => site.id === siteId);
  }

  visibleHelperAt(siteId: string): Artifact | undefined {
    return this.view?.zones
      .flatMap((zone) => zone.artifacts)
      .find(
        (artifact) =>
          artifact.siteId === siteId &&
          (artifact.type === 'corpse_stack' || artifact.type === 'mercy_nail')
      );
  }

  // Builds the observation the Phaser scene would emit for this failure,
  // from this player's own (possibly stale) view of the board.
  buildFall(intent: FallIntent): RecordFallRequest | null {
    const view = this.requireView();
    const site = view.sites.find((candidate) => candidate.id === intent.siteId);
    if (!site) return null;
    const platforms = platformMap(view.dailySeed);
    const approach = platforms.get(site.approachPlatformId);
    const landing = platforms.get(site.anchorPlatformId);
    if (!approach || !landing) return null;
    const helperId =
      intent.bucket === 'helper_overuse'
        ? (intent.helperArtifactId ?? this.visibleHelperAt(site.id)?.id ?? null)
        : null;
    if (intent.bucket === 'helper_overuse' && !helperId) return null;
    const zone = zoneById(site.zoneId);
    const attemptId = this.nextId('attempt');
    return {
      eventId: `fall:${attemptId}`,
      boardId: view.boardId,
      boardRevision: view.revision,
      timestamp: this.nowMs(),
      attemptId,
      respawnZoneId: site.zoneId,
      fallX: approach.x + approach.width / 2,
      fallY: zone.recoveryY,
      highestY: clamp(approach.y - 40, zone.yTop, zone.yBottom),
      lastPlatformId: approach.id,
      lastHelperArtifactId: helperId,
      wallBonkPlatformId: intent.bucket === 'wall_bonk' ? approach.id : null,
      launchChargePercent: intent.bucket === 'overjump' ? 95 : 55,
      launchDirection: Math.sign(
        landing.x + landing.width / 2 - (approach.x + approach.width / 2)
      ) as -1 | 0 | 1,
    };
  }

  async fall(intent: FallIntent): Promise<ApiCall<RecordFallResponse> | null> {
    const request = this.buildFall(intent);
    if (!request) return null;
    return this.submit<RecordFallResponse>('/record-fall', request);
  }

  async clear(
    zoneId: ZoneId,
    helperArtifactIds: string[] = []
  ): Promise<ApiCall<RecordClearResponse>> {
    const view = this.requireView();
    const attemptId = this.nextId('attempt');
    const request: RecordClearRequest = {
      eventId: `clear:${attemptId}`,
      boardId: view.boardId,
      boardRevision: view.revision,
      attemptId,
      zoneId,
      highestY: zoneById(zoneId).yTop - 12,
      helperArtifactIds,
      timestamp: this.nowMs(),
    };
    const call = await this.submit<RecordClearResponse>(
      '/record-clear',
      request
    );
    if (call.ok) this.resume = (call.body as RecordClearResponse).resume;
    return call;
  }

  async summit(): Promise<ApiCall<RecordSummitResponse>> {
    const view = this.requireView();
    const attemptId = this.nextId('attempt');
    const request: RecordSummitRequest = {
      eventId: `summit:${attemptId}`,
      boardId: view.boardId,
      boardRevision: view.revision,
      attemptId,
      highestY: 200,
      timestamp: this.nowMs(),
    };
    return this.submit<RecordSummitResponse>('/record-summit', request);
  }

  // Replays a request byte-for-byte, as a duplicate tab or a retry would.
  async resend<T>(path: string, request: unknown): Promise<ApiCall<T>> {
    return this.submit<T>(path, request);
  }

  private async submit<T>(path: string, request: unknown): Promise<ApiCall<T>> {
    const response = await this.api.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });
    const body = (await response.json()) as T | ApiErrorResponse;
    // The client adopts whichever snapshot the server returns with a receipt.
    const snapshot = (body as { snapshot?: BoardSnapshot }).snapshot;
    if (snapshot) this.view = snapshot;
    return { status: response.status, ok: response.ok, body, request };
  }

  private async get<T>(path: string): Promise<ApiCall<T>> {
    const response = await this.api.request(path);
    const body = (await response.json()) as T | ApiErrorResponse;
    return { status: response.status, ok: response.ok, body, request: null };
  }

  private requireView(): BoardSnapshot {
    if (!this.view) throw new Error(`${this.name} has not opened the board`);
    return this.view;
  }

  private nextId(prefix: string): string {
    this.#eventSerial += 1;
    return `${prefix}-${slug(this.name)}-${this.#eventSerial}`;
  }
}

const platformCache = new Map<string, Map<string, Platform>>();

function platformMap(dailySeed: string): Map<string, Platform> {
  let map = platformCache.get(dailySeed);
  if (!map) {
    map = new Map(
      generateDailyTower(dailySeed).platforms.map((platform) => [
        platform.id,
        platform,
      ])
    );
    platformCache.set(dailySeed, map);
  }
  return map;
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'player';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
