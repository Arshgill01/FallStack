import type { ZoneId } from './game/mutation';
import type { BoardSnapshot } from './game/board';
import type { FallObservation } from './game/mutation-events';
import type { MutationReceipt } from './game/mutation-receipts';

export type ApiErrorResponse = {
  status: 'error';
  message: string;
  receipt?: MutationReceipt;
  snapshot?: BoardSnapshot;
};

export type InitGameResponse = {
  type: 'initGame';
  postId: string;
  username: string;
  snapshot: BoardSnapshot;
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
  timestamp: number;
};

export type RecordClearResponse = {
  type: 'recordClear';
  counted: boolean;
  message: string;
  receipt: MutationReceipt;
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
