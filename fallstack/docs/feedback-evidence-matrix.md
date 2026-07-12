# Feedback Evidence Matrix

Use this file to decide what is strong enough for the submission. A claim is submission-ready only when it has a command or reproduction, observed impact, workaround status, and a Devvit-owned recommendation.

Last updated: 2026-07-12.

## Current evidence

| Finding | Confidence | Devvit ownership | Developer impact | Submission use |
| --- | --- | --- | --- | --- |
| `@devvit/test` install silently stalls while downloading Redis source | High: reproduced from clean uncached state and captured npm log | Direct first-party dependency path and missing setup documentation | Blocks or delays adoption; failure is opaque | Primary DX example |
| `@devvit/test@0.13.7` adds 2 high and 2 moderate audit findings with no available fix | High: `npm audit --json` plus `npm ls` path | Direct first-party package depends on affected `redis-memory-server` | Incompatible with common zero-high CI gates | Primary DX example |
| Test harness cannot provide post context to a real Devvit Web/Hono route | High for the attempted public APIs; a hidden internal adapter may exist | Public test configuration and docs gap | Forces refactoring below the request boundary; leaves auth/context wiring for uploaded playtest only | Primary testing/documentation example |
| Configuration docs recommend nonexistent `devvit build` | High: current docs instruction tested against current 0.13.7 CLI command list | Direct documentation ownership | Removes the promised safe pre-deployment validation step | Primary documentation example |
| App-name limit is 16 in prose but 20 in schema and changelog | High: three current first-party sources compared | Direct documentation/schema consistency ownership | Creates avoidable naming uncertainty and false validation expectations | Strong concise documentation example |
| Current React and Phaser templates install with 1 high + 4 low audit findings | High: clean installs at pinned first-party revisions; identical dependency path; mitigation verified | Direct template and `devvit` CLI dependency ownership | New apps fail zero-high CI before any developer code | Primary DX/security-hygiene example |
| Quickstart/templates/Vite guide/changelog disagree on Hono vs Express, `inline`, and what type-check runs | High: current first-party source and commands inspected | Direct docs/template maintenance ownership | Golden path misstates stack, deprecated config, and validation coverage | Primary documentation-maintenance example |
| First-party Phaser baseline builds a 1.38 MB game JS bundle without platform budgets | High size evidence; impact remains unmeasured in Reddit host | Shared: expected Phaser cost, Devvit owns host guidance | Developers cannot interpret a successful baseline against mobile/review constraints | Strong performance-documentation suggestion |
| Custom `--config` missing-entry diagnostic waits and tells users to edit `devvit.json` | High: controlled local failure, no upload occurred | Direct CLI diagnostics | Adds ~20 seconds and can send multi-config projects to the wrong file | Secondary DX example |
| JSON logs have no connection/history-complete signal | Medium-high: repeated in JSON and verbose JSON; human mode compared | Direct CLI observability | Automation cannot distinguish connected-empty from stalled | Secondary observability example |
| Raw `vite dev` is rejected by the Devvit Vite plugin | High; documented behavior now confirmed by FAQ | Intentional platform workflow, not a defect | Slower canvas-only iteration without a lightweight local route | Secondary suggestion, phrase as workflow cost |
| Phaser build crosses the generic 500 kB Vite warning threshold | Medium; warning reproduced, actual Reddit load impact not measured | Mostly upstream Vite/Phaser; Devvit can clarify budgets | Developers cannot tell whether warning threatens interactive-post performance | Documentation suggestion only |
| Automated Reddit playtest page returned network-security 403 | High observation, low Devvit ownership | Reddit anti-abuse/login environment, not necessarily Devvit | Prevents unattended host-surface visual QA in this VM | Context only; do not frame as a Devvit bug |
| Static browser fallback initially rendered blank state | High observation, app-owned | Fallstack bug, not Devvit | Caught by local smoke testing | Do not submit as platform criticism; use as evidence for why a fast client preview matters |
| npm/npm-config warnings during package commands | High observation, unclear ownership | Environment/npm config, not established as Devvit-owned | Noise | Exclude until root cause is isolated |

## Evidence gaps to pursue

1. Complete the live host pass in a logged-in human browser. The 2026-07-12 CLI upload succeeded as v0.0.14.4, but both fresh and existing-profile automated Chrome sessions received Reddit's network-security block before the subreddit or iframe loaded.
2. Exercise fall, clear, duplicate-event, stale-seed, anonymous-user, and contribution-cap behavior against real Redis in the playtest installation; compare results to pure validation tests.
3. Measure inline-to-expanded transition time, expanded bundle transfer/load timing, first canvas paint, and mobile control behavior in the actual Reddit host.
4. Continue error discoverability with a deliberate server exception once the real host can call an endpoint. Schema probes are complete: unknown fields and malformed menu endpoints produced useful paths; missing entries exposed the custom-config diagnostic issue.
5. Test current documentation as a new-user path in a scratch app, especially package naming: current pages mix capability packages such as `@devvit/reddit` with the Fallstack scaffold's `@devvit/web/server` facade.
6. Gather support evidence only from actual interactions. Do not rate community support from documentation or second-hand posts.

## Research-backed framing

- Previous Feedback Award winners were described by Reddit as providing “especially insightful, thorough, and specific” survey responses. This matrix optimizes for those qualities through evidence, not answer length: [Games and Puzzles winners announcement](https://www.reddit.com/r/Devvit/comments/1hvz8s8/announcing_the_games_and_puzzles_hackathon_winners/).
- Current official docs say local testing is intentionally incomplete and normal development uses an uploaded playtest subreddit: [Devvit FAQ](https://developers.reddit.com/docs/guides/faq).
- Current official docs advertise `@devvit/test` as a production-like isolated backend with supported Redis and partial Reddit API coverage: [Testing with @devvit/test](https://developers.reddit.com/docs/guides/tools/devvit_test).
- Current playtest docs say the `?playtest=<app>` URL streams client logs and triggers live reload: [Playtest](https://developers.reddit.com/docs/guides/tools/playtest). That claim needs direct verification in Fallstack's real host session.
- The current configuration page's 16-character app-name limit and `devvit build` recommendation conflict with the live schema/current CLI: [Devvit configuration](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration), [changelog](https://developers.reddit.com/docs/changelog).
- Current first-party React and Phaser templates were audited at pinned revisions; both build cleanly but install the same high-severity `tmp@0.0.33` path through the Devvit CLI. A `tmp@0.2.7` override was verified to return the Phaser starter to zero findings.
