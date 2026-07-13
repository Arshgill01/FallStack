import type {
  BoardSnapshot,
  MutationBeat,
} from '../../shared/game/board.js';

export type ReconciliationDecision = 'ignore' | 'apply' | 'defer';

export function reconciliationDecision(
  currentRevision: number,
  nextRevision: number,
  safe: boolean,
  boardChanged = false
): ReconciliationDecision {
  if (!boardChanged && nextRevision <= currentRevision) return 'ignore';
  return safe ? 'apply' : 'defer';
}

export function latestRemoteBeat(
  currentRevision: number,
  snapshot: BoardSnapshot
): MutationBeat | null {
  return (
    snapshot.recentMutations
      .filter((beat) => beat.revision > currentRevision)
      .sort((left, right) => right.revision - left.revision)[0] ?? null
  );
}
