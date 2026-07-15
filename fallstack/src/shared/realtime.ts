export type BoardRevisionMessage = {
  type: 'board-revision';
  boardId: string;
  revision: number;
};

export function realtimeChannelForBoard(boardId: string): string {
  return `fallstack_${boardId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export function isBoardRevisionMessage(
  value: unknown
): value is BoardRevisionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<BoardRevisionMessage>;
  return (
    message.type === 'board-revision' &&
    typeof message.boardId === 'string' &&
    message.boardId.startsWith('community:') &&
    typeof message.revision === 'number' &&
    Number.isSafeInteger(message.revision) &&
    message.revision >= 0
  );
}

export function isNewerBoardRevision(
  current: { boardId: string; revision: number },
  message: BoardRevisionMessage
): boolean {
  return (
    current.boardId === message.boardId &&
    message.revision > current.revision
  );
}
