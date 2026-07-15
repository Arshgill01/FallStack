export function redditPostUrl(
  subredditName: string | undefined,
  postId: string | undefined
): string | null {
  if (!subredditName || !/^[a-zA-Z0-9_]{2,21}$/.test(subredditName))
    return null;
  if (!postId || !/^(?:t3_)?[a-zA-Z0-9]+$/.test(postId)) return null;
  const id = postId.startsWith('t3_') ? postId.slice(3) : postId;
  return `https://www.reddit.com/r/${subredditName}/comments/${id}`;
}

export function redditModmailUrl(
  subredditName: string | undefined
): string | null {
  if (!subredditName || !/^[a-zA-Z0-9_]{2,21}$/.test(subredditName))
    return null;
  return `https://www.reddit.com/message/compose?to=/r/${subredditName}`;
}
