import type { FailureBucket, ZoneId } from './game/mutation';
import type { BoardSnapshot } from './game/board';
import type { FallObservation } from './game/mutation-events';
import type { MutationReceipt } from './game/mutation-receipts';

export type PlayerResume = {
  zoneId: ZoneId;
  mode: 'account' | 'session';
};

// What this climber put into today's tower, returned only to them.
export type PlayerLegacy = {
  marks: { siteId: string; bucket: FailureBucket; count: number }[];
  clearedZones: ZoneId[];
};

export type ApiErrorResponse = {
  status: 'error';
  message: string;
  receipt?: MutationReceipt;
  snapshot?: BoardSnapshot;
};

export type InitGameResponse = {
  type: 'initGame';
  postId: string;
  postUrl: string | null;
  supportUrl: string | null;
  username: string;
  resume: PlayerResume;
  legacy: PlayerLegacy;
  // Distinct climbers on this board in the last ten minutes, you included.
  recentClimbers: number;
  snapshot: BoardSnapshot;
};

export type BoardRevisionResponse = {
  type: 'boardRevision';
  boardId: string;
  revision: number;
  recentClimbers: number;
};

export type RecordFallRequest = FallObservation & {
  eventId: string;
  boardId: string;
  boardRevision: number;
  timestamp: number;
};

export type RecordFallResponse = {
  type: 'recordFall';
  counted: boolean;
  message: string;
  receipt: MutationReceipt;
  snapshot: BoardSnapshot;
};

export type RecordClearRequest = {
  eventId: string;
  boardId: string;
  boardRevision: number;
  attemptId: string;
  zoneId: ZoneId;
  highestY: number;
  // Community footholds and ghosts the climber stood on in this zone.
  helperArtifactIds: string[];
  timestamp: number;
};

export type RecordClearResponse = {
  type: 'recordClear';
  counted: boolean;
  message: string;
  receipt: MutationReceipt;
  resume: PlayerResume;
  snapshot: BoardSnapshot;
};

export type RecordSummitRequest = {
  eventId: string;
  boardId: string;
  boardRevision: number;
  attemptId: string;
  highestY: number;
  timestamp: number;
};

export type RecordSummitResponse = {
  type: 'recordSummit';
  counted: boolean;
  message: string;
  receipt: MutationReceipt;
  snapshot: BoardSnapshot;
};
