# Hosted Duplicate-Tab Persistence Pass

Date: 2026-07-12 UTC  
Host: authenticated Reddit desktop, two simultaneous subreddit tabs  
Installed app: `fallstack` v0.0.15  
Identity: authenticated test-subreddit moderator

## Purpose

Verify that two real expanded Devvit Web frames share server identity and Redis idempotency state, without adding a synthetic fall, clear, or summit to the public test snapshot.

## Method

1. Open two authenticated `r/fallstack_dev/?playtest=fallstack` tabs in the same headed Chrome instance.
2. Open the expanded game in both tabs and confirm two independent cross-origin `game.html` targets.
3. Call `/api/init-game` from each frame through its own Devvit client bridge.
4. Submit the same new, valid bottom-zone fall attempt concurrently from both frames with `Promise.all`.
5. Read `/api/init-game` again from both frames.
6. Preserve only sanitized response fields; do not preserve iframe URLs, bridge tokens, or cookies.

The authenticated account was already capped for bottom-zone falls. That made the race non-polluting while still exercising the shared NX event marker: one new attempt could claim the marker and reach the cap branch, while the other should see the attempt as an existing duplicate.

## Result

Both frames initially returned:

- HTTP 200;
- seed `fallstack-2026-07-12`;
- username `BrightyBrainiac`;
- 46 falls, 0 clears, 0 summits.

Concurrent responses for attempt `hostqa_tabs_20260712_a`:

| Frame | HTTP | Counted | Message | Returned falls |
| --- | ---: | --- | --- | ---: |
| A | 200 | false | `Orbital Scrapyard has heard enough from you today.` | 46 |
| B | 200 | false | `Your fall was already heard.` | 46 |

Both frames then read the same unchanged 46/0/0 snapshot.

## Interpretation

- The two real Reddit tabs received the same authenticated server identity.
- The deployed Redis event marker was shared across independent iframe/client-bridge contexts.
- Exactly one request passed the new-attempt marker and reached the contribution-cap branch; the competing request observed the duplicate marker.
- No public counter or named achievement changed.

This is positive hosted persistence evidence. It does not prove successful first-writer aggregation under an uncapped identity or recovery after a marker is claimed and a later Redis write fails. Those remain separate tests; the local 20-way route suite covers normal successful races, while interrupted hosted recovery remains open.

Chrome and Xvfb were stopped after the test, and localhost service ports were closed.
