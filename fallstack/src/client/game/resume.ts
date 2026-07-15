import { TOWER_VERSION } from '../../shared/game/board.js';
import {
  BOTTOM_ZONE_ID,
  isZoneId,
  ZONE_IDS,
  type GameSnapshot,
  type ZoneId,
} from '../../shared/game/mutation.js';

type DeviceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readDeviceResume(
  storage: DeviceStorage,
  snapshot: Pick<GameSnapshot, 'dateKey'>
): ZoneId {
  try {
    const stored = storage.getItem(deviceResumeKey(snapshot));
    return isZoneId(stored) ? stored : BOTTOM_ZONE_ID;
  } catch {
    return BOTTOM_ZONE_ID;
  }
}

export function writeDeviceResume(
  storage: DeviceStorage,
  snapshot: Pick<GameSnapshot, 'dateKey'>,
  zoneId: ZoneId
): ZoneId {
  const current = readDeviceResume(storage, snapshot);
  const furthest =
    ZONE_IDS.indexOf(zoneId) > ZONE_IDS.indexOf(current) ? zoneId : current;
  try {
    storage.setItem(deviceResumeKey(snapshot), furthest);
  } catch {
    // Storage can be unavailable in restricted webviews; the run still continues.
  }
  return furthest;
}

export function deviceResumeKey(
  snapshot: Pick<GameSnapshot, 'dateKey'>
): string {
  return `fallstack:practice-resume:${snapshot.dateKey}:v${TOWER_VERSION}`;
}

export function checkpointedZonesBefore(zoneId: ZoneId): ZoneId[] {
  const zoneIndex = ZONE_IDS.indexOf(zoneId);
  return zoneIndex < 0 ? [] : ZONE_IDS.slice(0, zoneIndex);
}
