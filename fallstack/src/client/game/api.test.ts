import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApiErrorResponse } from '../../shared/api.js';
import { ApiRequestError, parseApiResponse } from './api.js';

void test('API errors preserve a structured unchanged-board receipt', async () => {
  const body: ApiErrorResponse = {
    status: 'error',
    message: 'The shared board did not change. Your climb can continue.',
    receipt: {
      eventId: 'fall:attempt-unavailable',
      boardId: 'community:t5_test:2026-07-13:v1',
      accepted: false,
      rejection: 'unavailable',
      revisionBefore: 42,
      revisionAfter: 42,
      siteId: null,
      siteName: null,
      bucket: null,
      counterBefore: null,
      counterAfter: null,
      nextThreshold: null,
      visibleChange: 'none',
      copy: 'The shared board did not change. Your climb can continue.',
    },
  };

  await assert.rejects(
    parseApiResponse(
      new Response(JSON.stringify(body), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    (error: unknown) =>
      error instanceof ApiRequestError &&
      error.status === 503 &&
      error.data.receipt?.rejection === 'unavailable'
  );
});
