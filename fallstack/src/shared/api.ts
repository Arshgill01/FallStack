import type {
  FailureBucket,
  GameSnapshot,
  ZoneId,
} from './game/mutation';

export type ApiErrorResponse = {
  status: 'error';
  message: string;
};

export type InitGameResponse = {
  type: 'initGame';
  postId: string;
  username: string;
  snapshot: GameSnapshot;
};

export type RecordFallRequest = {
  dailySeed: string;
  attemptId: string;
  zoneId: ZoneId;
  failureBucket: FailureBucket;
  chargePercent: number;
  highestY: number;
  timestamp: number;
};

export type RecordFallResponse = {
  type: 'recordFall';
  counted: boolean;
  message: string;
  snapshot: GameSnapshot;
};

export type RecordClearRequest = {
  dailySeed: string;
  attemptId: string;
  zoneId: ZoneId;
  highestY: number;
  timestamp: number;
};

export type RecordClearResponse = {
  type: 'recordClear';
  counted: boolean;
  message: string;
  snapshot: GameSnapshot;
};

export type RecordSummitRequest = {
  dailySeed: string;
  attemptId: string;
  timestamp: number;
};

export type RecordSummitResponse = {
  type: 'recordSummit';
  counted: boolean;
  message: string;
  snapshot: GameSnapshot;
};
