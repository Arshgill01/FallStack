import assert from 'node:assert/strict';
import test from 'node:test';
import { redditPostUrl } from './reddit.js';

void test('Reddit post URLs accept fullnames but reject untrusted destinations', () => {
  assert.equal(
    redditPostUrl('FallStack', 't3_abc123'),
    'https://www.reddit.com/r/FallStack/comments/abc123'
  );
  assert.equal(redditPostUrl('<script>', 't3_abc123'), null);
  assert.equal(redditPostUrl('FallStack', '../comments/evil'), null);
});
