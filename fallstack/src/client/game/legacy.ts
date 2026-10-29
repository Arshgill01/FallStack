import type { PlayerLegacy } from '../../shared/api.js';
import type { BoardSnapshot } from '../../shared/game/board.js';
import { siteFace, slotDrivers } from '../../shared/game/forming.js';
import {
  isFailureBucket,
  type ArtifactSlotKind,
  type FailureBucket,
  isRescuerType,
  planSiteArtifacts,
  type Artifact,
  type GameSnapshot,
} from '../../shared/game/mutation.js';
import type { MutationReceipt } from '../../shared/game/mutation-receipts.js';

export const EMPTY_LEGACY: PlayerLegacy = { marks: [], clearedZones: [] };

// The artifacts this climber's own falls are part of. Only they see this.
export function yourArtifacts(
  snapshot: Pick<GameSnapshot, 'zones'>,
  legacy: PlayerLegacy
): Artifact[] {
  const marked = new Set(
    legacy.marks.map((mark) => `${mark.siteId}|${mark.bucket}`)
  );
  return snapshot.zones
    .flatMap((zone) => zone.artifacts)
    .filter((artifact) => marked.has(`${artifact.siteId}|${artifact.bucket}`));
}

export function legacyCopy(
  snapshot: Pick<GameSnapshot, 'zones'>,
  legacy: PlayerLegacy
): string | null {
  const raised = yourArtifacts(snapshot, legacy);
  const caught = raised
    .filter((artifact) => isRescuerType(artifact.type))
    .reduce((sum, artifact) => sum + artifact.saves, 0);
  if (raised.length > 0) {
    const artifacts = `${raised.length} ${raised.length === 1 ? 'artifact' : 'artifacts'}`;
    return caught > 0
      ? `Your falls helped raise ${artifacts}. They caught ${caught} ${caught === 1 ? 'climber' : 'climbers'}.`
      : `Your falls helped raise ${artifacts}.`;
  }
  const falls = legacy.marks.reduce((sum, mark) => sum + mark.count, 0);
  if (falls > 0)
    return `Your ${falls} ${falls === 1 ? 'fall is' : 'falls are'} still forming something.`;
  return null;
}

// Keeps the climber's own marks current between loads; the server is the
// authority again at the next init.
export function withReceiptMark(
  legacy: PlayerLegacy,
  receipt: Pick<MutationReceipt, 'accepted' | 'siteId' | 'bucket'>
): PlayerLegacy {
  if (!receipt.accepted || !receipt.siteId || !isFailureBucket(receipt.bucket))
    return legacy;
  const bucket = receipt.bucket;
  const siteId = receipt.siteId;
  const existing = legacy.marks.find(
    (mark) => mark.siteId === siteId && mark.bucket === bucket
  );
  return {
    ...legacy,
    marks: existing
      ? legacy.marks.map((mark) =>
          mark === existing ? { ...mark, count: mark.count + 1 } : mark
        )
      : [...legacy.marks, { siteId, bucket, count: 1 }],
  };
}

// What this device remembers of the board when it last looked, so a return
// visit can say what the community did meanwhile.
export type VisitMemory = {
  boardId: string;
  revision: number;
  organicFalls: number;
  totalClears: number;
  faces: Record<string, string>;
  artifacts: Record<string, string[]>;
  // Count driving each artifact slot, so a recap can point at the slot that
  // moved rather than just the site.
  slots: Record<string, Partial<Record<ArtifactSlotKind, number>>>;
  saves: Record<string, number>;
};

export function visitMemoryFor(snapshot: BoardSnapshot): VisitMemory {
  return {
    boardId: snapshot.boardId,
    revision: snapshot.revision,
    organicFalls: snapshot.organicFalls,
    totalClears: snapshot.totalClears,
    faces: Object.fromEntries(
      snapshot.sites.map((site) => [site.id, siteFace(site)])
    ),
    artifacts: Object.fromEntries(
      snapshot.sites.map((site) => [
        site.id,
        planSiteArtifacts(site.counters).map((plan) => plan.slot),
      ])
    ),
    slots: Object.fromEntries(
      snapshot.sites.map((site) => [
        site.id,
        Object.fromEntries(
          slotDrivers(site.counters).map((driver) => [driver.slot, driver.count])
        ),
      ])
    ),
    saves: { ...snapshot.saves },
  };
}

export type ChangedSlot = {
  siteId: string;
  bucket: FailureBucket | 'successful_clear';
};

export type SinceLastVisit = {
  copy: string;
  changedSiteIds: string[];
  changedSlots: ChangedSlot[];
};

export function sinceLastVisit(
  previous: VisitMemory | null,
  snapshot: BoardSnapshot,
  legacy: PlayerLegacy
): SinceLastVisit | null {
  if (
    !previous ||
    previous.boardId !== snapshot.boardId ||
    snapshot.revision <= previous.revision
  )
    return null;
  const changedSiteIds = snapshot.sites
    .filter((site) => previous.faces[site.id] !== siteFace(site))
    .map((site) => site.id);
  const changedSlots = snapshot.sites.flatMap((site) =>
    slotDrivers(site.counters)
      .filter(
        (driver) => driver.count > (previous.slots[site.id]?.[driver.slot] ?? 0)
      )
      .map((driver) => ({ siteId: site.id, bucket: driver.bucket }))
  );
  const grown = snapshot.sites.reduce((sum, site) => {
    const before = new Set(previous.artifacts[site.id] ?? []);
    return (
      sum +
      planSiteArtifacts(site.counters).filter((plan) => !before.has(plan.slot))
        .length
    );
  }, 0);
  const falls = snapshot.organicFalls - previous.organicFalls;
  const clears = snapshot.totalClears - previous.totalClears;
  const yourCaught = yourArtifacts(snapshot, legacy).reduce(
    (sum, artifact) =>
      sum + artifact.saves - (previous.saves[artifact.id] ?? 0),
    0
  );

  const parts = [
    falls > 0 ? `${falls} ${falls === 1 ? 'fall' : 'falls'}` : '',
    clears > 0 ? `${clears} ${clears === 1 ? 'clear' : 'clears'}` : '',
    grown > 0 ? `${grown} new ${grown === 1 ? 'artifact' : 'artifacts'}` : '',
  ].filter(Boolean);
  if (parts.length === 0 && yourCaught <= 0) return null;
  const caught =
    yourCaught > 0
      ? ` Your footholds caught ${yourCaught} ${yourCaught === 1 ? 'climber' : 'climbers'}.`
      : '';
  return {
    copy: `Since your last climb: ${parts.join(' · ') || 'the tower held still'}.${caught}`,
    changedSiteIds,
    changedSlots,
  };
}

const VISIT_KEY = 'fallstack:last-visit';

export function readVisitMemory(
  storage: Pick<Storage, 'getItem'>,
  boardId: string
): VisitMemory | null {
  try {
    const parsed = JSON.parse(storage.getItem(VISIT_KEY) ?? 'null') as
      | Partial<VisitMemory>
      | null;
    if (
      !parsed ||
      parsed.boardId !== boardId ||
      typeof parsed.revision !== 'number' ||
      typeof parsed.organicFalls !== 'number' ||
      typeof parsed.totalClears !== 'number' ||
      !parsed.faces ||
      !parsed.artifacts ||
      !parsed.slots ||
      !parsed.saves
    )
      return null;
    return parsed as VisitMemory;
  } catch {
    return null;
  }
}

export function writeVisitMemory(
  storage: Pick<Storage, 'setItem'>,
  snapshot: BoardSnapshot
): void {
  try {
    storage.setItem(VISIT_KEY, JSON.stringify(visitMemoryFor(snapshot)));
  } catch {
    // Storage can be unavailable in restricted webviews; the next visit just
    // opens without a recap.
  }
}
