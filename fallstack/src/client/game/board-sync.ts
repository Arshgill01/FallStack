import type {
  BoardRevisionResponse,
  InitGameResponse,
} from '../../shared/api.js';
import type { BoardSnapshot } from '../../shared/game/board.js';
import { parseApiResponse } from './api.js';

type BoardPointer = Pick<BoardSnapshot, 'boardId' | 'revision'>;

export async function fetchChangedBoardSnapshot(
  current: BoardPointer,
  request: typeof fetch = fetch
): Promise<BoardSnapshot | null> {
  const response = await request('/api/board-revision');
  const revision = await parseApiResponse<BoardRevisionResponse>(response);
  if (
    revision.boardId === current.boardId &&
    revision.revision <= current.revision
  )
    return null;

  const fullResponse = await request('/api/init-game');
  return (await parseApiResponse<InitGameResponse>(fullResponse)).snapshot;
}
