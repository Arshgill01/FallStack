import type { RecordClearRequest, RecordFallRequest } from '../../shared/api';
import type { ZoneId } from '../../shared/game/mutation';

export type FallEventDetail = Omit<
  RecordFallRequest,
  'dailySeed' | 'timestamp'
>;
export type ClearEventDetail = Omit<
  RecordClearRequest,
  'dailySeed' | 'timestamp'
>;
export type SummitEventDetail = { attemptId: string };
export type LandEventDetail = { zoneId: ZoneId };
export type ZoneEventDetail = { zoneId: ZoneId };
export type SoundId =
  | 'charge-start'
  | 'launch'
  | 'land'
  | 'fall'
  | 'mutation'
  | 'checkpoint'
  | 'ui';
