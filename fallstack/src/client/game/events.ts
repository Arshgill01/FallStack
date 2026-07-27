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
export type LandingMaterial =
  | 'stone'
  | 'metal'
  | 'moon'
  | 'obstacle'
  | 'summit'
  | 'corpse'
  | 'mercy'
  | 'ghost'
  | 'cursed';
export type LandingSurface = 'route' | 'checkpoint' | 'summit' | 'artifact';
export type LandEventDetail = {
  zoneId: ZoneId;
  material: LandingMaterial;
  surface: LandingSurface;
  impactSpeed: number;
};
export type WallBonkEventDetail = {
  zoneId: ZoneId;
  side: 'left' | 'right';
  impactSpeed: number;
};
export type ArtifactCollapseEventDetail = {
  zoneId: ZoneId;
  type: 'ghost_platform' | 'cursed_brick';
};
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
  | 'wall-bonk'
  | 'artifact-collapse'
  | 'fall'
  | 'mutation'
  | 'checkpoint'
  | 'summit'
  | 'ui';
