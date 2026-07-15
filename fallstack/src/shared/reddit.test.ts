import assert from 'node:assert/strict';
import test from 'node:test';
import { redditModmailUrl, redditPostUrl } from './reddit.js';

void test('Reddit post URLs accept fullnames but reject untrusted destinations', () => {
  assert.equal(
    redditPostUrl('FallStack', 't3_abc123'),
    'https://www.reddit.com/r/FallStack/comments/abc123'
  );
  assert.equal(redditPostUrl('<script>', 't3_abc123'), null);
  assert.equal(redditPostUrl('FallStack', '../comments/evil'), null);
});

void test('support stays on a validated subreddit modmail route', () => {
  assert.equal(
    redditModmailUrl('FallStack'),
    'https://www.reddit.com/message/compose?to=/r/FallStack'
  );
  assert.equal(redditModmailUrl('r/FallStack'), null);
});
