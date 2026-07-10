import type {
  RecordClearRequest,
  RecordFallRequest,
  RecordSummitRequest,
} from '../api';
import { isFailureBucket, isZoneId } from './mutation.js';
import { MOVEMENT_TUNING } from './movement.js';
import { nextZoneId, WORLD_HEIGHT, zoneById } from './tower.js';

const MAX_FUTURE_EVENT_MS = 10 * 60 * 1000;
const MAX_PAST_EVENT_MS = 24 * 60 * 60 * 1000;
const CLEAR_BOUNDARY_OVERSHOOT_Y = MOVEMENT_TUNING.reachableVertical;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export function validateRecordFallRequest(
  value: unknown,
  now = Date.now()
): ValidationResult<RecordFallRequest> {
  const body = asRecord(value);
  if (!body) return invalid('Invalid fall event.');
  if (!isDailySeed(body.dailySeed)) return invalid('Invalid fall event.');
  if (!validAttemptId(body.attemptId)) return invalid('Invalid fall event.');
  if (!isZoneId(body.zoneId)) return invalid('Invalid fall event.');
  if (!isFailureBucket(body.failureBucket)) return invalid('Invalid fall event.');
  if (!isNumberInRange(body.chargePercent, 0, 100)) return invalid('Invalid fall event.');
  if (!isNumberInRange(body.highestY, 0, WORLD_HEIGHT)) return invalid('Invalid fall event.');
  if (!isPlausibleTimestamp(body.timestamp, now)) return invalid('Invalid fall event.');

  const zone = zoneById(body.zoneId);
  if (!isNumberInRange(body.highestY, zone.yTop, zone.yBottom))
    return invalid('Invalid fall event.');

  return {
    ok: true,
    value: {
      dailySeed: body.dailySeed,
      attemptId: body.attemptId,
      zoneId: body.zoneId,
      failureBucket: body.failureBucket,
      chargePercent: body.chargePercent,
      highestY: body.highestY,
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
  if (!isDailySeed(body.dailySeed)) return invalid('Invalid clear event.');
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
      dailySeed: body.dailySeed,
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
  if (!isDailySeed(body.dailySeed)) return invalid('Invalid summit event.');
  if (!validAttemptId(body.attemptId)) return invalid('Invalid summit event.');
  if (!isNumberInRange(body.highestY, 0, MOVEMENT_TUNING.topConnectorY))
    return invalid('Invalid summit event.');
  if (!isPlausibleTimestamp(body.timestamp, now)) return invalid('Invalid summit event.');

  return {
    ok: true,
    value: {
      dailySeed: body.dailySeed,
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

function isDailySeed(value: unknown): value is string {
  return typeof value === 'string' && /^fallstack-\d{4}-\d{2}-\d{2}$/.test(value);
}

function validAttemptId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{8,80}$/.test(value);
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
