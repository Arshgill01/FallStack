import type { TaskRequest, TaskResponse } from '@devvit/web/server';
import { Hono } from 'hono';
import { createPost } from '../core/post.js';

export const scheduler = new Hono();

scheduler.post('/daily-post', async (c) => {
  await c.req.json<TaskRequest>().catch(() => null);
  await createPost();
  return c.json<TaskResponse>({});
});
