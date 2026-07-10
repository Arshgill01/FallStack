import type { ZoneId } from './mutation';
import { zoneById } from './tower.js';

export function shouldEndRunAtY(playerY: number, respawnZone: ZoneId): boolean {
  return playerY >= zoneById(respawnZone).recoveryY;
}

export function fallZoneForRespawn(respawnZone: ZoneId): ZoneId {
  return respawnZone;
}
