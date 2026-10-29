import type { FailureBucket, ZoneId } from './game/mutation.js';
import { isFailureBucket, isZoneId } from './game/mutation.js';
import type {
  MutationReceipt,
  VisibleMutationChange,
} from './game/mutation-receipts.js';

// What just happened on the board, so every open client can show it the
// moment it happens instead of waiting for the next snapshot. Positions are
// derived on the client from the seed and siteId; nothing here is
// client-authored, and failures never carry a name.
export type BoardEcho = {
  kind: 'fall' | 'clear' | 'summit';
  // Hash of the eventId: lets the sender skip its own echo without
  // broadcasting idempotency keys.
  key: string;
  zoneId: ZoneId | null;
  siteId: string | null;
  bucket: FailureBucket | 'successful_clear' | null;
  count: number | null;
  visibleChange: VisibleMutationChange;
  climber: string | null;
};

export type BoardRevisionMessage = {
  type: 'board-revision';
  boardId: string;
  revision: number;
  echo?: BoardEcho;
};

const VISIBLE_CHANGES: readonly VisibleMutationChange[] = [
  'mark_added',
  'artifact_spawned',
  'artifact_upgraded',
  'site_cursed',
  'site_reinforced',
  'site_stabilized',
  'none',
];

export function realtimeChannelForBoard(boardId: string): string {
  return `fallstack_${boardId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

// FNV-1a: stable across server and client, not a secret.
export function echoKeyForEvent(eventId: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < eventId.length; index += 1) {
    hash ^= eventId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function echoForReceipt(input: {
  kind: BoardEcho['kind'];
  receipt: MutationReceipt;
  zoneId: ZoneId | null;
  climber: string | null;
}): BoardEcho {
  return {
    kind: input.kind,
    key: echoKeyForEvent(input.receipt.eventId),
    zoneId: input.zoneId,
    siteId: input.receipt.siteId,
    bucket: input.receipt.bucket,
    count: input.receipt.counterAfter,
    visibleChange: input.receipt.visibleChange,
    climber: input.kind === 'fall' ? null : input.climber,
  };
}

export function isBoardRevisionMessage(
  value: unknown
): value is BoardRevisionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<BoardRevisionMessage>;
  return (
    message.type === 'board-revision' &&
    typeof message.boardId === 'string' &&
    message.boardId.startsWith('community:') &&
    typeof message.revision === 'number' &&
    Number.isSafeInteger(message.revision) &&
    message.revision >= 0
  );
}

// Echoes are display-only, but they still come over the wire: accept only the
// exact shape the server sends.
export function parseBoardEcho(value: unknown): BoardEcho | null {
  if (!value || typeof value !== 'object') return null;
  const echo = value as Record<string, unknown>;
  if (echo.kind !== 'fall' && echo.kind !== 'clear' && echo.kind !== 'summit')
    return null;
  if (typeof echo.key !== 'string' || !/^[0-9a-f]{8}$/.test(echo.key))
    return null;
  if (echo.zoneId !== null && !isZoneId(echo.zoneId)) return null;
  if (
    echo.siteId !== null &&
    (typeof echo.siteId !== 'string' ||
      !/^impact-v\d+:[a-zA-Z0-9:._-]{1,160}$/.test(echo.siteId))
  )
    return null;
  if (
    echo.bucket !== null &&
    echo.bucket !== 'successful_clear' &&
    !isFailureBucket(echo.bucket)
  )
    return null;
  if (
    echo.count !== null &&
    (typeof echo.count !== 'number' ||
      !Number.isSafeInteger(echo.count) ||
      echo.count < 0)
  )
    return null;
  if (!VISIBLE_CHANGES.includes(echo.visibleChange as VisibleMutationChange))
    return null;
  if (
    echo.climber !== null &&
    (echo.kind === 'fall' ||
      typeof echo.climber !== 'string' ||
      !/^u\/[A-Za-z0-9_-]{2,24}$/.test(echo.climber))
  )
    return null;
  return {
    kind: echo.kind,
    key: echo.key,
    zoneId: echo.zoneId,
    siteId: echo.siteId as string | null,
    bucket: echo.bucket as BoardEcho['bucket'],
    count: echo.count as number | null,
    visibleChange: echo.visibleChange as VisibleMutationChange,
    climber: echo.climber as string | null,
  };
}

export function isNewerBoardRevision(
  current: { boardId: string; revision: number },
  message: BoardRevisionMessage
): boolean {
  return (
    current.boardId === message.boardId &&
    message.revision > current.revision
  );
}
