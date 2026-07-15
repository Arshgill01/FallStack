import type {
  RecordClearRequest,
  RecordFallRequest,
  RecordSummitRequest,
} from '../api';
import { isZoneId } from './mutation.js';
import { MOVEMENT_TUNING } from './movement.js';
import {
  nextZoneId,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  zoneById,
} from './tower.js';

const MAX_FUTURE_EVENT_MS = 10 * 60 * 1000;
const MAX_PAST_EVENT_MS = 24 * 60 * 60 * 1000;
const CLEAR_BOUNDARY_OVERSHOOT_Y = MOVEMENT_TUNING.reachableVertical;
const SUMMIT_PROGRESS_MAX_Y = 300;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function validateRecordFallRequest(
  value: unknown,
  now = Date.now()
): ValidationResult<RecordFallRequest> {
  const body = asRecord(value);
  if (!body) return invalid('Invalid fall event.');
  if (!validEventEnvelope(body)) return invalid('Invalid fall event.');
  if (!validAttemptId(body.attemptId)) return invalid('Invalid fall event.');
  if (!isZoneId(body.respawnZoneId)) return invalid('Invalid fall event.');
  if (!isNumberInRange(body.fallX, 0, WORLD_WIDTH))
    return invalid('Invalid fall event.');
  if (!isNumberInRange(body.launchChargePercent, 0, 100))
    return invalid('Invalid fall event.');
  if (!isLaunchDirection(body.launchDirection))
    return invalid('Invalid fall event.');
  if (!isNumberInRange(body.highestY, 0, WORLD_HEIGHT)) return invalid('Invalid fall event.');
  if (!validWorldId(body.lastPlatformId)) return invalid('Invalid fall event.');
  if (!validWorldId(body.lastHelperArtifactId))
    return invalid('Invalid fall event.');
  if (!validWorldId(body.wallBonkPlatformId))
    return invalid('Invalid fall event.');
  if (!isPlausibleTimestamp(body.timestamp, now)) return invalid('Invalid fall event.');

  const zone = zoneById(body.respawnZoneId);
  if (!isNumberInRange(body.highestY, zone.yTop, zone.yBottom))
    return invalid('Invalid fall event.');
  if (!isNumberInRange(body.fallY, zone.yTop, zone.yBottom + 220))
    return invalid('Invalid fall event.');

  return {
    ok: true,
    value: {
      eventId: body.eventId,
      boardId: body.boardId,
      boardRevision: body.boardRevision,
      attemptId: body.attemptId,
      respawnZoneId: body.respawnZoneId,
      fallX: body.fallX,
      fallY: body.fallY,
      highestY: body.highestY,
      lastPlatformId: body.lastPlatformId,
      lastHelperArtifactId: body.lastHelperArtifactId,
      wallBonkPlatformId: body.wallBonkPlatformId,
      launchChargePercent: body.launchChargePercent,
      launchDirection: body.launchDirection,
      timestamp: body.timestamp,
    },
  };
}

export function validateRecordClearRequest(
  value: unknown,
  now = Date.now()
): ValidationResult<RecordClearRequest> {
  const body = asRecord(value);
  if (!body) return invalid('Invalid clear event.');
  if (!validEventEnvelope(body)) return invalid('Invalid clear event.');
  if (!validAttemptId(body.attemptId)) return invalid('Invalid clear event.');
  if (!isZoneId(body.zoneId)) return invalid('Invalid clear event.');
  if (!nextZoneId(body.zoneId)) return invalid('Invalid clear event.');
  if (!isNumberInRange(body.highestY, 0, WORLD_HEIGHT)) return invalid('Invalid clear event.');
  if (!isPlausibleTimestamp(body.timestamp, now)) return invalid('Invalid clear event.');

  const zone = zoneById(body.zoneId);
  if (body.highestY > zone.yTop) return invalid('Invalid clear event.');
  if (body.highestY < zone.yTop - CLEAR_BOUNDARY_OVERSHOOT_Y)
    return invalid('Invalid clear event.');

  return {
    ok: true,
    value: {
      eventId: body.eventId,
      boardId: body.boardId,
      boardRevision: body.boardRevision,
      attemptId: body.attemptId,
      zoneId: body.zoneId,
      highestY: body.highestY,
      timestamp: body.timestamp,
    },
  };
}

export function validateRecordSummitRequest(
  value: unknown,
  now = Date.now()
): ValidationResult<RecordSummitRequest> {
  const body = asRecord(value);
  if (!body) return invalid('Invalid summit event.');
  if (!validEventEnvelope(body)) return invalid('Invalid summit event.');
  if (!validAttemptId(body.attemptId)) return invalid('Invalid summit event.');
  if (!isNumberInRange(body.highestY, 0, SUMMIT_PROGRESS_MAX_Y))
    return invalid('Invalid summit event.');
  if (!isPlausibleTimestamp(body.timestamp, now)) return invalid('Invalid summit event.');

  return {
    ok: true,
    value: {
      eventId: body.eventId,
      boardId: body.boardId,
      boardRevision: body.boardRevision,
      attemptId: body.attemptId,
      highestY: body.highestY,
      timestamp: body.timestamp,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validEventEnvelope(
  body: Record<string, unknown>
): body is Record<string, unknown> & {
  eventId: string;
  boardId: string;
  boardRevision: number;
} {
  return (
    typeof body.eventId === 'string' &&
    /^[a-zA-Z0-9:_-]{8,100}$/.test(body.eventId) &&
    typeof body.boardId === 'string' &&
    /^[a-zA-Z0-9:._-]{8,140}$/.test(body.boardId) &&
    typeof body.boardRevision === 'number' &&
    Number.isInteger(body.boardRevision) &&
    body.boardRevision >= 0 &&
    body.boardRevision <= 1_000_000_000
  );
}

function validAttemptId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{8,80}$/.test(value);
}

function validWorldId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' && /^[a-zA-Z0-9:._-]{1,180}$/.test(value))
  );
}

function isLaunchDirection(value: unknown): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isPlausibleTimestamp(value: unknown, now: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= now - MAX_PAST_EVENT_MS &&
    value <= now + MAX_FUTURE_EVENT_MS
  );
}

function invalid<T>(message: string): ValidationResult<T> {
  return { ok: false, message };
}
