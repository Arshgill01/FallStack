# Authenticated Reddit Host Pass

Date: 2026-07-12 UTC  
Host: Reddit desktop, Google Chrome 150, authenticated as the test-subreddit moderator  
App: `fallstack` v0.0.14.4 on `r/fallstack_dev`

This pass used a dedicated headed Chrome profile and an authenticated Reddit session. No cookies, iframe JWTs, HARs, or tokenized URLs are preserved in this directory.

## What worked

- The real subreddit rendered the Fallstack inline post and opened Reddit's expanded-app modal.
- The modal's Mobile, Desktop, and Fullscreen preview choices were present. Mobile rendered fixed Left, Hold Jump, and Right controls; Desktop removed the touch controls and accepted the desktop layout.
- The inline hook was immediately legible: it named community failure and a nearby artifact before the expanded game opened.
- The expanded iframe rendered the tower, current counters, artifact explanation, audio control, result control, and responsive host layouts without console or page errors. The only observed app log was `Navigation listeners online`.
- A passive ten-second init probe left the persisted snapshot unchanged, so simply opening or idling in the app did not record a fall.

## Measured warm-load sequence

Outer Reddit document:

- navigation response start: about 344 ms;
- DOM interactive: 1,167 ms;
- first paint / first contentful paint: 1,236 ms;
- Devvit splash iframe request began at 3,561 ms;
- outer load event: 4,433 ms.

Inline splash iframe, once instantiated:

- response start: 32 ms;
- DOM interactive: 196 ms;
- load: 213 ms;
- first paint: 280 ms;
- first contentful paint: 312 ms.

Expanded game iframe:

- response start: 20 ms;
- DOM interactive: 130 ms;
- load: 339 ms;
- first contentful paint: 504 ms;
- `/api/init-game` began at 373 ms and completed in 1,608 ms;
- `game.js`: 374,221 encoded bytes / 1,441,869 decoded bytes.

This is one authenticated warm-profile run, not a population latency benchmark. It does show that the inline application becomes interactive quickly after Reddit instantiates it; most observed elapsed time before the inline paint was in the outer Reddit composition path.

## Hosted persistence probes

The live baseline and final snapshot were identical: 46 falls, 0 clears, 0 summits, seed `fallstack-2026-07-12`.

| Probe | Result | State effect |
| --- | --- | --- |
| Valid bottom-zone fall from the authenticated account | HTTP 200, `counted: false`, per-zone contribution-cap message | None |
| Exact retry of that attempt ID | HTTP 200, `counted: false`, duplicate message | None |
| Fall with prior-day well-formed seed | HTTP 409, stale-seed message | None |
| Clear with prior-day well-formed seed | HTTP 409, stale-seed message | None |
| Summit with prior-day well-formed seed | HTTP 409, stale-seed message | None |
| Current-seed summit with impossible progress | HTTP 400, invalid-event message | None |

This confirms the deployed server reads authenticated identity, applies the account/zone cap, distinguishes an exact duplicate from a capped new event, rejects stale daily state across all three mutation endpoints, and validates summit geometry. The account had already exhausted its bottom-zone fall contribution before the controlled probe, so this pass does not claim a new hosted increment or a fresh NX race.

I deliberately did not fabricate a valid clear or first summit. Either would have persisted a misleading named leaderboard/achievement in the public test app. The local real-route Redis suite remains the evidence for successful clear/summit writes and 20-way races.

## Application issue found and fixed locally

The authenticated hosted snapshot reported 46 falls and the expanded game displayed 46, while the inline post still said 37 and described a hard-coded 14-fall artifact. Source inspection confirmed the inline component hard-coded both values.

The local fix makes the lightweight inline entrypoint request `/api/init-game`, render the current total and first bottom-zone artifact label, and use a number-free loading state instead of stale seeded claims. Two focused tests cover live snapshot and loading copy. The fix is application-owned and is not included as Devvit criticism.

## Host observations that remain provisional

- Reddit showed a first-use owner-only device-preview tooltip over the expanded app. Dismissing it was followed by a brief white iframe before the game appeared several seconds later. Because this was not reproduced across clean sessions with controlled timing, it is retained as an observation rather than a platform defect.
- Automated key and pointer driving could focus the game controls, but did not produce a newly counted fall during this pass. The server later confirmed the account was already capped, so counter stability alone cannot distinguish input behavior from cap behavior.

## Evidence files

- `inline-desktop-full.png`
- `transition-step-2-expanded.png`
- `expanded-mobile-after-6s.png`
- `expanded-desktop.png`
- `inline-to-expanded.webm`
- additional focused-input screenshots retained as test notes

Raw DevTools traces were excluded because iframe navigation URLs contain reusable authorization material.
