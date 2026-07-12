# Paste-Ready Feedback Form Submission

Evidence cutoff: 2026-07-12
Devvit tested: 0.13.7

Use these answers for the Google form. Keep the evidence cutoff/version if space permits because SDK, templates, and docs can change.

## If we ran another Hackathon, what would you like the category to be?

**Shared Worlds / Community Co-creation.** Reward apps where many redditors leave durable consequences in one shared object, story, puzzle, or world—not single-player experiences with Reddit branding added afterward. The category should favor ideas that genuinely require subreddit context, aggregate identity/state, recurring posts, and discussion. Fallstack is an example: failures and clean clears physically mutate the same daily tower, giving later players reasons to thank, blame, and discuss the community that shaped their route.

## How satisfied are you with the developer experience? Provide a rating on the scale of 1-5.

**3/5**

## Why did you choose this rating?

Devvit Web's core architecture is strong. I built a Phaser + React + Hono app with a lightweight inline entrypoint, expanded game, `/api` routes, server-authoritative identity, and Redis without putting platform credentials in the iframe. `devvit playtest` successfully built and installed Fallstack v0.0.14.4, CLI read-back confirmed the exact version, and authenticated headed Chrome rendered the real inline post plus responsive Mobile/Desktop expanded game. Hosted probes preserved the 46/0/0 snapshot while rejecting stale fall/clear/summit events and distinguishing a cap from a duplicate. In a real two-tab race, both frames received the same identity and baseline; simultaneous identical attempts produced exactly one cap response and one duplicate response, then both still read 46/0/0. Schema errors for unknown properties and malformed internal endpoints were concise and pointed to the nested field.

The missing two points are confidence and iteration. Fresh installs of both current first-party React and Phaser starters produced 1 high + 4 low audit findings through development CLI code: `devvit@0.13.7 → @devvit/cli → inquirer@9.1.4 → external-editor → tmp@0.0.33`. A targeted Inquirer 9.3.8 override removed that path, audited at zero, and still ran the CLI.

`@devvit/test@0.13.7` was promising but rougher: its implicit Redis source download stayed silently at 0% for more than three minutes; its published Redis-memory dependency added 2 high + 2 moderate findings; and its runner cannot configure post/comment/`loid` context for a real Web route. Moving `redis-memory-server` from 0.14.1 to 0.17.0 audited at zero and passed a real Redis harness test.

The harness is worth fixing. After manually supplying post context, I ran 101 requests through Fallstack's actual Hono routes, including 20-way duplicate races, per-user/daily caps, and fault injection. It proved the normal atomic behavior and found two application-owned error/idempotency problems. First-class request-context fixtures, documented Redis binary controls, clean dependency gates, and a supported local Web-route adapter would make this a 4–5 experience.

## How satisfied are you with the Devvit documentation?

**3/5**

## Why did you choose this rating?

The architecture material is clear where it matters most: `devvit.json`, the client/server boundary, `/api` endpoints, server-only capabilities, Redis persistence, and uploaded playtests. The FAQ now explicitly says a purely local environment is incomplete, which prevents a common dead end.

The rating is 3 because the current golden path has several mechanically preventable contradictions:

- configuration prose says app names are 3–16 characters; the live schema and 0.13.6 changelog say 20;
- the configuration page recommends `devvit build`, but CLI 0.13.7 returns `Command build not found`;
- the quickstart and template library say the React/Phaser starters use Express; the current starters use Hono;
- the changelog says `inline` is deprecated and has no effect, while the Vite guide and both current starters still emit `inline: true`;
- starter READMEs say `npm run type-check` also lints and prettifies, but it only runs `tsc --build`;
- the testing guide omits the Redis download/system-binary setup and provides no post-scoped Hono example.

These should be contract-tested, not fixed one typo at a time: execute documented commands in CI, generate duplicated constraints from the schema, compare framework claims with template dependencies, and scan active examples for current deprecations.

Game guidance also needs Reddit-specific budgets and a package report. The first-party Vite plugin enables maps but disables compressed-size reporting; the CLI uploader then selects every client file. In Fallstack, 12.57 MB of 14.40 MB selected raw client bytes were maps, while runtime files were 1.83 MB raw/~0.52 MB gzip-estimated. Maps were not requested during observed execution, so this is packaging volume—not a map-caused first-paint claim. Across three authenticated same-version v0.0.15 runs, expanded FCP ranged from 0.392 to 4.164 seconds cold (3.292-second median) versus 0.400–0.412 seconds warm; the identical 372 kB encoded bundle ranged from 90.5 ms to 2.223 seconds cold. One VM is not a platform percentile, but the variability proves why tooling should show manifests, repeated samples, entrypoint budgets, and cold/warm desktop/mobile targets before remote mutation.

## How satisfied are you with support in our communities?

**3/5 (low-confidence/neutral rating)**

## Why did you choose this rating?

I did not ask a question in Discord or r/Devvit during this build, so I cannot honestly score response time, empathy, or resolution quality. The channels and public GitHub tracker were discoverable, and the public source was useful enough to trace several findings to exact files. Authenticated searches found no direct public duplicate for the main test-harness, dependency, config-command, or JSON-log findings, but that does not reveal internal tickets or differently worded reports.

I chose the neutral midpoint rather than inventing a positive or negative support experience. What would improve my confidence is a documented support bundle—CLI/SDK version, app/version, subreddit, reproduction, trace ID, expected/actual behavior, severity, and workaround—plus visible status linking community reports to public or internal tickets.

## Do you plan on continuing to develop your project? Why or why not?

Yes. Fallstack's core loop is Reddit-native rather than merely hosted on Reddit: everyone's falls and clean clears aggregate into visible artifacts that alter the same daily tower, and the result creates discussion material beyond a leaderboard. The project already has deterministic finite tower generation, analog hold/release movement, mobile controls, capped shared mutation, server validation, checkpoints, and a lightweight-inline/expanded-game split.

The evidence work also improved the app: route-level concurrency tests proved duplicate and contribution caps, and fault injection caught internal errors incorrectly returning HTTP 400; those now return 500. Authenticated host QA then caught a first-viewport integrity bug: the inline post hard-coded 37 falls while the deployed snapshot and expanded game showed 46. The inline entrypoint now loads the live snapshot and uses number-free loading copy. I will continue with a recoverable mutation transaction/state machine, logged-out/duplicate-tab testing, and physical-mobile/cold-cache QA. Those are concrete launch gates, not speculative roadmap scope.

## What would get you most excited to start working on a new app?

A trustworthy local-to-Reddit testing ladder:

1. instant client-only preview for visual/game iteration;
2. a first-party local server harness with authenticated, logged-out, post, comment, menu, trigger, and failure fixtures;
3. one command that replays the same scenario in a real playtest installation;
4. correlated client/server/Redis traces with machine-readable lifecycle events;
5. reference tests for concurrency, idempotency, abuse caps, and response loss.

That would make ambitious shared-state apps cheap to explore without discovering platform-specific risk only after upload. I would also be excited by another Shared Worlds category paired with small production-grade reference apps—not just API snippets—showing persistent community state, realtime updates, mobile budgets, analytics, and safe logged-out participation.

## Please share anything else you would like for the team to know

Devvit Web's direction is compelling: familiar web tooling plus Reddit distribution, identity, persistence, and conversation is a genuinely differentiated platform. My strongest recommendation is to make the confidence path as polished as the architecture.

The highest-leverage fixes I verified are small enough to evaluate quickly:

- bump CLI Inquirer 9.1.4 → 9.3.8 (targeted install audited at zero and CLI still ran);
- bump the test harness's `redis-memory-server` 0.14.1 → 0.17.0 (zero findings and Redis harness test passed);
- merge configurable raw request headers before `Context(headers)` in `createDevvitTest`, enabling post/comment/logged-out route tests;
- add a non-mutating `devvit validate --config ...` command;
- add optional typed status records for JSON logs (`connected`, keepalive/reconnect, complete/error);
- return an opaque request ID on Devvit Web API responses, propagate it into server context/runtime errors, and support CLI filtering by that ID;
- contract-test docs, schema constraints, changelog deprecations, template dependencies, and README commands together;
- report the exact upload manifest, runtime/map/compressed-size estimates, and host-specific Phaser/game performance baselines before remote mutation.
- surface the installed version in playtest host/log context so concurrent uploads cannot be mistaken for cache or runtime regressions.

I separated platform findings from my own bugs and environment issues. For example, I did not blame Devvit for automated Reddit network-security blocking, browser setup, a static fallback bug, or Fallstack's interrupted-idempotency risk. The full evidence package records commands, pinned revisions, expected/actual behavior, ownership, severity, workaround, candidate source files, targeted patch validation, and remaining uncertainty. If the form permits a repository/appendix link, I would be happy to share it.

## Developer handoff appendix (not a form field)

The detailed package lives in:

- `maintainer-triage-brief.md` — prioritized reproductions, acceptance criteria, and ownership routing;
- `devvit-feedback-log.md` — reproductions and impact;
- `maintainer-patch-map.md` — exact upstream files and minimal candidate fixes;
- `template-audit-pass.md` — pinned React/Phaser starter evidence;
- `phaser-packaging-observability-pass.md` — exact build defaults, selected manifest, and runtime/map size split;
- `host-performance-pass.md` — authenticated same-version cold/warm Reddit iframe timing;
- `host-log-correlation-pass.md` — browser response and CLI runtime-log join-key audit;
- `server-persistence-experiment.md` — 101 real-route requests and fault injection;
- `submission-evidence-audit.md` — claim-by-claim proof and exclusions.
- `award-criteria-audit.md` — mapping to Reddit's published detailed/candid/actionable/constructive feedback signals.

Do not paste this appendix list unless the form accepts a repository link or supplemental context.
