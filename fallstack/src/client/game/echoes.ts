import type { Rect } from '../../shared/game/impact-sites.js';
import { slotKindForBucket } from '../../shared/game/forming.js';
import {
  artifactSlot,
  isFailureBucket,
  ZONE_NAMES,
  type SiteSnapshot,
} from '../../shared/game/mutation.js';
import type { SaveCredit } from '../../shared/game/mutation-receipts.js';
import type { Platform } from '../../shared/game/tower.js';
import { zoneById } from '../../shared/game/tower.js';
import type { BoardEcho } from '../../shared/realtime.js';

export const ECHO_DURATION_MS = 1_500;
export const MAX_ACTIVE_ECHOES = 4;

export type EchoPlacement = {
  // Where the artifact this echo feeds lives.
  slot: Rect;
  // Where the echo starts: the top of the landing ledge someone missed, or
  // the zone's checkpoint for a summit.
  origin: { x: number; y: number };
  zoneName: string;
};

export function echoPlacement(
  echo: BoardEcho,
  sites: readonly SiteSnapshot[],
  platforms: readonly Pick<Platform, 'id' | 'x' | 'y' | 'width'>[]
): EchoPlacement | null {
  if (!echo.zoneId) return null;
  const zoneName = ZONE_NAMES[echo.zoneId];
  const site = echo.siteId
    ? sites.find((candidate) => candidate.id === echo.siteId)
    : undefined;
  if (!site || !echo.bucket) {
    if (echo.kind !== 'summit') return null;
    const zone = zoneById(echo.zoneId);
    const slot = { x: 200, y: zone.yTop + 40, width: 80, height: 14 };
    return { slot, origin: { x: 240, y: zone.yTop + 40 }, zoneName };
  }
  const slot = artifactSlot(site, slotKindForBucket(echo.bucket));
  const landing = platforms.find(
    (platform) => platform.id === site.anchorPlatformId
  );
  return {
    slot,
    origin: landing
      ? { x: landing.x + landing.width / 2, y: landing.y }
      : { x: slot.x + slot.width / 2, y: slot.y - 40 },
    zoneName,
  };
}

// The stamp that floats over the site. Short enough to read in a glance
// mid-climb; falls stay anonymous.
export function echoStamp(echo: BoardEcho): string {
  if (echo.kind === 'summit')
    return `${echo.climber ?? 'A climber'} reached the summit`;
  if (echo.kind === 'clear') {
    const who = echo.climber ?? 'A climber';
    if (echo.visibleChange === 'site_stabilized') return `${who} stabilized this`;
    if (echo.visibleChange === 'site_reinforced') return `${who} reinforced this`;
    return `${who} cleared through`;
  }
  if (echo.visibleChange === 'artifact_spawned') return 'A fall grew this';
  if (echo.visibleChange === 'artifact_upgraded') return 'A fall deepened this';
  if (echo.visibleChange === 'site_cursed') return 'A fall overgrew this';
  return `+1 ${bucketWord(echo.bucket)}`;
}

// The climber's own clear lighting up the community artifacts it thanked.
export function thanksEchoes(
  saves: readonly SaveCredit[],
  sites: readonly Pick<SiteSnapshot, 'id' | 'zoneId'>[]
): { echo: BoardEcho; stamp: string }[] {
  return saves.flatMap((save) => {
    const site = sites.find((candidate) =>
      save.artifactId.startsWith(`${candidate.id}-`)
    );
    const bucket = site ? save.artifactId.slice(site.id.length + 1) : '';
    if (!site || !isFailureBucket(bucket)) return [];
    return [
      {
        echo: {
          kind: 'clear' as const,
          key: '00000000',
          zoneId: site.zoneId,
          siteId: site.id,
          bucket,
          count: save.savesAfter,
          visibleChange: 'mark_added' as const,
          climber: null,
        },
        stamp: `Caught ${save.savesAfter} ${save.savesAfter === 1 ? 'climber' : 'climbers'}`,
      },
    ];
  });
}

export function echoIsMajor(echo: BoardEcho): boolean {
  return (
    echo.kind === 'summit' ||
    (echo.visibleChange !== 'mark_added' && echo.visibleChange !== 'none')
  );
}

export type OffscreenDirection = 'above' | 'below';

export function offscreenDirection(
  y: number,
  view: { top: number; bottom: number },
  margin = 24
): OffscreenDirection | null {
  if (y < view.top - margin) return 'above';
  if (y > view.bottom + margin) return 'below';
  return null;
}

// One marker per edge, so a busy subreddit reads as a count, not a pile.
export function offscreenMarkerCopy(
  direction: OffscreenDirection,
  entries: readonly { kind: BoardEcho['kind']; zoneName: string }[]
): string {
  const arrow = direction === 'above' ? '↑' : '↓';
  const latest = entries.at(-1);
  if (!latest) return '';
  if (entries.length === 1)
    return `${arrow} ${kindWord(latest.kind)} · ${latest.zoneName}`;
  const falls = entries.filter((entry) => entry.kind === 'fall').length;
  const others = entries.length - falls;
  const parts = [
    falls ? `${falls} ${falls === 1 ? 'fall' : 'falls'}` : '',
    others ? `${others} ${others === 1 ? 'clear' : 'clears'}` : '',
  ].filter(Boolean);
  return `${arrow} ${parts.join(' · ')} ${direction}`;
}

// Echoes from this client's own events are already shown by its receipt.
export class OwnEchoKeys {
  readonly #keys: string[] = [];

  add(key: string) {
    this.#keys.push(key);
    if (this.#keys.length > 64) this.#keys.shift();
  }

  has(key: string) {
    return this.#keys.includes(key);
  }
}

function kindWord(kind: BoardEcho['kind']): string {
  if (kind === 'fall') return 'someone fell';
  if (kind === 'clear') return 'a clean clear';
  return 'summit';
}

function bucketWord(bucket: BoardEcho['bucket']): string {
  if (bucket === 'short_jump') return 'short jump';
  if (bucket === 'overjump') return 'overjump';
  if (bucket === 'wall_bonk') return 'wall bonk';
  if (bucket === 'helper_overuse') return 'helper slip';
  return 'fall';
}
