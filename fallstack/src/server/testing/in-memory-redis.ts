// Redis double for server tests and the community connectivity harness. It
// models WATCH/MULTI/EXEC version conflicts, sorted sets, and key expiry closely
// enough to exercise the board store's transaction and retention paths.
export type SortedMember = { member: string; score: number };

export class InMemoryRedis {
  readonly #hashes = new Map<string, Map<string, string>>();
  readonly #sortedSets = new Map<string, Map<string, number>>();
  readonly #versions = new Map<string, number>();
  readonly #expiresAt = new Map<string, number>();
  #forcedConflicts = 0;
  #now = 0;
  #hGetReads = 0;
  #hGetAllReads = 0;
  #zRangeReads = 0;

  async watch(...keys: string[]): Promise<InMemoryTransaction> {
    return new InMemoryTransaction(
      this,
      new Map(keys.map((key) => [key, this.version(key)]))
    );
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    this.#hGetReads += 1;
    this.purgeExpired(key);
    return this.#hashes.get(key)?.get(field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    this.#hGetAllReads += 1;
    this.purgeExpired(key);
    return Object.fromEntries(this.#hashes.get(key) ?? []);
  }

  async zRange(
    key: string,
    start: number | string,
    stop: number | string
  ): Promise<SortedMember[]> {
    this.#zRangeReads += 1;
    this.purgeExpired(key);
    const members = this.sortedMembers(key);
    const [first, last] = rankRange(members.length, start, stop);
    return first > last ? [] : members.slice(first, last + 1);
  }

  version(key: string): number {
    return this.#versions.get(key) ?? 0;
  }

  forceConflicts(count: number): void {
    this.#forcedConflicts = count;
  }

  takeForcedConflict(): boolean {
    if (this.#forcedConflicts <= 0) return false;
    this.#forcedConflicts -= 1;
    return true;
  }

  advanceTime(milliseconds: number): void {
    this.#now += milliseconds;
  }

  resetReadCounts(): void {
    this.#hGetReads = 0;
    this.#hGetAllReads = 0;
    this.#zRangeReads = 0;
  }

  readCounts(): { hGet: number; hGetAll: number; zRange: number } {
    return {
      hGet: this.#hGetReads,
      hGetAll: this.#hGetAllReads,
      zRange: this.#zRangeReads,
    };
  }

  hSet(key: string, values: Record<string, string>): number {
    const hash = this.hash(key);
    for (const [field, value] of Object.entries(values)) hash.set(field, value);
    this.bump(key);
    return Object.keys(values).length;
  }

  hIncrBy(key: string, field: string, amount: number): number {
    const hash = this.hash(key);
    const next = Number(hash.get(field) ?? 0) + amount;
    hash.set(field, String(next));
    this.bump(key);
    return next;
  }

  zAdd(key: string, members: SortedMember[]): number {
    const set = this.sortedSet(key);
    for (const member of members) set.set(member.member, member.score);
    this.bump(key);
    return members.length;
  }

  zRemRangeByRank(key: string, start: number, stop: number): number {
    const members = this.sortedMembers(key);
    const [first, last] = rankRange(members.length, start, stop);
    if (first > last) return 0;
    const set = this.sortedSet(key);
    for (const item of members.slice(first, last + 1)) set.delete(item.member);
    this.bump(key);
    return last - first + 1;
  }

  expire(key: string, seconds: number): number {
    this.#expiresAt.set(key, this.#now + seconds * 1000);
    return 1;
  }

  private hash(key: string): Map<string, string> {
    let hash = this.#hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.#hashes.set(key, hash);
    }
    return hash;
  }

  private sortedSet(key: string): Map<string, number> {
    let set = this.#sortedSets.get(key);
    if (!set) {
      set = new Map();
      this.#sortedSets.set(key, set);
    }
    return set;
  }

  private sortedMembers(key: string): SortedMember[] {
    return [...(this.#sortedSets.get(key) ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort(
        (left, right) =>
          left.score - right.score || left.member.localeCompare(right.member)
      );
  }

  private bump(key: string): void {
    this.#versions.set(key, this.version(key) + 1);
  }

  private purgeExpired(key: string): void {
    const expiresAt = this.#expiresAt.get(key);
    if (expiresAt === undefined || expiresAt > this.#now) return;
    this.#hashes.delete(key);
    this.#sortedSets.delete(key);
    this.#expiresAt.delete(key);
    this.bump(key);
  }
}

export class InMemoryTransaction {
  readonly #commands: Array<() => unknown> = [];
  #discarded = false;

  constructor(
    private readonly redis: InMemoryRedis,
    private readonly watched: Map<string, number>
  ) {}

  async multi(): Promise<void> {}

  async discard(): Promise<void> {
    this.#discarded = true;
    this.#commands.length = 0;
  }

  async hSet(
    key: string,
    values: Record<string, string>
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.hSet(key, values));
    return this;
  }

  async hIncrBy(
    key: string,
    field: string,
    amount: number
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.hIncrBy(key, field, amount));
    return this;
  }

  async zAdd(
    key: string,
    ...members: SortedMember[]
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.zAdd(key, members));
    return this;
  }

  async zRemRangeByRank(
    key: string,
    start: number,
    stop: number
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.zRemRangeByRank(key, start, stop));
    return this;
  }

  async expire(key: string, seconds: number): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.expire(key, seconds));
    return this;
  }

  async exec(): Promise<unknown[]> {
    if (this.#discarded) return [];
    if (this.redis.takeForcedConflict()) return [];
    if (
      [...this.watched].some(
        ([key, version]) => this.redis.version(key) !== version
      )
    )
      return [];
    return this.#commands.map((command) => command());
  }
}

function rankRange(
  length: number,
  start: number | string,
  stop: number | string
): [number, number] {
  const first = normalizedRank(length, Number(start));
  const last = normalizedRank(length, Number(stop));
  return [Math.max(0, first), Math.min(length - 1, last)];
}

function normalizedRank(length: number, rank: number): number {
  return rank < 0 ? length + rank : rank;
}
