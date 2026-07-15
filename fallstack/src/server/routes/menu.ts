import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost, postUrl } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const result = await createPost();

    if (result.status === 'pending') {
      return c.json<UiResponse>(
        { showToast: "Today's tower post is already being created." },
        200
      );
    }

    return c.json<UiResponse>(
      {
        navigateTo: postUrl(context.subredditName, result.postId),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});
