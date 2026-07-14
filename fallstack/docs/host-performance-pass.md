# Authenticated Reddit Host Performance Pass

Date: 2026-07-12 UTC  
Browser: headed Google Chrome 150 on the `skywalker` VM  
Host: authenticated Reddit desktop, `r/fallstack_dev`  
Installed app during controlled comparison: `fallstack` v0.0.15

## Version integrity

The first authenticated pass measured v0.0.14.4. During the later cache experiment, `devvit list installs fallstack_dev` reported v0.0.15 and `devvit view fallstack --json` independently reported:

- version 0.0.15;
- upload time `2026-07-12T20:26:23.656Z`;
- successful build at `2026-07-12T20:26:26.435Z`;
- public API version 0.13.7.

The current research worktree was clean at commit `b5d37c2` and did not run an upload. The visibly different v0.0.15 inline surface therefore came from a separate concurrent upload, not from a browser-cache conclusion. Measurements below use only v0.0.15 and do not compare UI behavior across versions.

## Method

1. Attach to the already authenticated headed Chrome profile through localhost-only CDP.
2. Clear Chrome's HTTP cache through `Network.clearBrowserCache` without clearing or inspecting authentication state.
3. Reload the Reddit subreddit with cache bypass enabled.
4. Open the expanded game and read Navigation, Paint, and Resource Timing from the cross-origin game target.
5. Close and reopen the expanded game without clearing cache, then read the same metrics from the new game target.
6. Repeat the cold/warm expanded sequence three times.
7. Independently confirm the installed version remained v0.0.15 after the final run.
8. Sanitize hostnames and preserve no iframe token URLs, cookies, HAR, or raw trace.

This is a controlled three-run single-VM cold/warm comparison, not a population percentile or physical-mobile benchmark.

## Results

### Inline after cache clear

Outer Reddit document:

- response start: 326.6 ms;
- DOM interactive: 1,125.3 ms;
- first paint / first contentful paint: 908 ms;
- Devvit splash request began: 1,788.6 ms;
- outer load: 4,536.5 ms.

Splash iframe:

- response start: 29.6 ms;
- DOM interactive: 307.8 ms;
- load: 325.2 ms;
- first paint: 336 ms;
- first contentful paint: 480 ms;
- `default.js`: 25,773 encoded / 126,292 decoded bytes, 132.1 ms;
- `jsx-runtime.js`: 59,693 encoded / 191,229 decoded bytes, 151.2 ms;
- splash CSS: 5,549 encoded / 21,946 decoded bytes, 83.2 ms.

### Expanded game, same-version cold versus warm

| Metric | Cold run 1 | Cold run 2 | Cold run 3 | Cold median | Warm run 1 | Warm run 2 | Warm run 3 | Warm median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Navigation response start | 783.9 ms | 1,693.4 ms | 15.6 ms | 783.9 ms | 15.0 ms | 17.8 ms | 10.9 ms | 15.0 ms |
| First contentful paint | 3,292 ms | 4,164 ms | 392 ms | 3,292 ms | 412 ms | 412 ms | 400 ms | 412 ms |
| `game.js` duration | 2,180.2 ms | 2,222.6 ms | 90.5 ms | 2,180.2 ms | 44.5 ms | 59.0 ms | 46.1 ms | 46.1 ms |
| `game.js` transfer | 372,179 B | 372,179 B | 372,179 B | 372,179 B | 0 | 0 | 0 | 0 |
| Initial API state complete | 4,267.5 ms | 4,906.3 ms | 1,076.9 ms | 4,267.5 ms | 1,003.3 ms | 987.1 ms | 1,192.8 ms | 1,003.3 ms |

The bundle representation remained 371,879 encoded / 1,433,086 decoded bytes in every run. `/api/init-game` transferred 1,637 bytes in every measured request.

Cold run 1's `game.js` began at 803.4 ms and finished around 2,983.6 ms; first contentful paint followed at 3,292 ms. Cold run 2 was slower, while cold run 3 transferred the same bytes but completed near warm speed. This spread is evidence of high observed variability, not a stable 3.29-second constant.

## Interpretation

- Fallstack's warm expanded path was stable on this VM: 400–412 ms FCP. Cold FCP ranged from 392 to 4,164 ms despite identical transferred bundle bytes; the three-run median was 3,292 ms.
- Two cold runs were dominated by the delayed game bundle, while one cold transfer completed in 90.5 ms. The API response affects when shared state is current, but it does not explain the first canvas paint by itself.
- Source maps are absent from the Resource Timing entries used for execution, supporting the earlier constraint that uploaded maps increase packaging volume but are not evidence of normal first-paint cost.
- A generic Vite 500 kB warning cannot tell a Devvit game author whether 372 kB encoded / 1.43 MB decoded, a 392–4,164 ms cold FCP range, and a 412 ms warm median are acceptable for Reddit mobile, review, or retention targets.

## Recommendation

Add a non-mutating Devvit package/performance report that separates inline and expanded entrypoints and reports:

- encoded, decoded, and source-map bytes;
- cold-cache and warm-cache reference targets for Reddit desktop and physical mobile;
- time to host frame, first contentful paint/canvas, first usable input, and initial API state;
- warnings tied to platform-owned targets rather than generic bundler thresholds;
- the installed app version alongside playtest URLs and client/server logs.

This would turn an otherwise opaque warning into an actionable optimization loop. The current evidence supports the need for repeatable targets, multiple samples, and reporting; it does not establish a Devvit CDN regression or a universal latency defect.

## Preserved evidence

- `docs/playtest-evidence/2026-07-12-authenticated-host/screenshots/v15-inline-cold-cache.png`
- `docs/playtest-evidence/2026-07-12-authenticated-host/screenshots/v15-expanded-mobile-warm.png`

Raw tokenized target URLs and traces were deliberately not preserved.
