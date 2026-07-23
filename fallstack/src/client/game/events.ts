import type {
  RecordClearRequest,
  RecordFallRequest,
  RecordSummitRequest,
} from '../../shared/api';
import type { ZoneId } from '../../shared/game/mutation';

export type FallEventDetail = Omit<
  RecordFallRequest,
  'eventId' | 'boardId' | 'boardRevision' | 'timestamp'
>;
export type ClearEventDetail = Omit<
  RecordClearRequest,
  'eventId' | 'boardId' | 'boardRevision' | 'timestamp'
>;
export type SummitEventDetail = Omit<
  RecordSummitRequest,
  'eventId' | 'boardId' | 'boardRevision' | 'timestamp'
>;
export type LandEventDetail = { zoneId: ZoneId };
export type ZoneEventDetail = { zoneId: ZoneId };
export type LaunchEventDetail = {
  direction: -1 | 1;
  chargePercent: number;
  originX: number;
  velocityX: number;
  velocityY: number;
};
export type SoundId =
  | 'charge-start'
  | 'launch'
  | 'land'
  | 'fall'
  | 'mutation'
  | 'checkpoint'
  | 'ui';
