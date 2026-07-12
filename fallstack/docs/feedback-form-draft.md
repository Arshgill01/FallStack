# Feedback Form Draft (Historical Long Form)

This preserves the pre-authenticated-host reasoning pass and is no longer the submission source of truth. The current, evidence-cutoff-aware answers are in `feedback-form-submission.md`; current host, persistence, performance, and observability evidence lives in the evidence matrix and maintainer brief. Keep this file only for background prose. Do not copy its provisional ratings or stale completion language into the form.

## If we ran another Hackathon, what would you like the category to be?

**Shared Worlds / Community Co-creation.** The most interesting Reddit apps are not single-player games wearing Reddit branding; they make participation from many people accumulate into a shared object, story, puzzle, or world. A category built around persistent community consequences would encourage experiments that genuinely need Reddit's post, identity, conversation, and shared-state surfaces.

## How satisfied are you with the developer experience? Rating: 3/5 (provisional)

Devvit Web's standard client/server split made it practical to build a real Phaser + React + Hono game while keeping Redis and Reddit identity server-authoritative. The current scaffold, typed context, `/api` convention, and playtest upload flow are much easier to reason about than a bespoke UI runtime.

The missing two points are mostly iteration and testing confidence. A normal Vite dev server is intentionally unavailable, so integrated feedback depends on an upload/playtest loop. More importantly, the newly documented `@devvit/test@0.13.7` path was not clean to adopt: its Redis dependency silently remained at 0% during postinstall for more than three minutes; completing installation via a system Redis workaround added 2 high and 2 moderate npm audit findings with no fix available; and the public runner configuration could not provide `postId` to a real `@devvit/web/server` Hono route. Capability-level tests are useful, but the authenticated post-scoped boundary is exactly where a shared Reddit game needs confidence.

The clean-start experience also needs a dependency-health gate. Fresh installs of both current first-party React and Phaser templates produced the same 1 high + 4 low audit result through `devvit@0.13.7 → @devvit/cli → inquirer → external-editor → tmp@0.0.33`. Public source pins Inquirer 9.1.4; a targeted override to 9.3.8 removed that legacy chain, audited at zero, and still ran the CLI. Likewise, moving the test harness from `redis-memory-server` 0.14.1 to 0.17.0 audited at zero and passed a real Redis harness test. These appear readily fixable upstream and should not be left for every new app to rediscover.

The harness is worth investing in: after manually supplying post context and using the verified dependency workaround, I ran 101 requests through Fallstack's real Hono routes and Redis capability across duplicate races, identity/cap isolation, and fault injection. It proved the normal atomic caps and found two application-owned error/idempotency problems. The most valuable improvements would be a patched test dependency, explicit Redis binary/setup documentation, first-class post/comment/anonymous context fixtures, and a supported local request adapter for Devvit Web routes.

## How satisfied are you with the Devvit documentation? Rating: 3/5 (provisional)

The architecture pages are concise and correctly steer developers toward `devvit.json`, `/api` endpoints, server-only capabilities, Redis for persistence across app versions, and uploaded playtests for full integration. The FAQ also now makes the lack of a complete local environment explicit, which prevents wasted time trying to force a normal Vite workflow.

The testing guide currently overpromises the smoothness of the new harness. It says to install Vitest and `@devvit/test`, but does not mention that `redis-memory-server` downloads/compiles Redis during postinstall or how to use a system binary. It also documents user and subreddit fixtures but not how to test post-scoped Web endpoints; attempting the obvious `devvit-post` header route did not hydrate `context.postId`. Public source explains why: the runner snapshots its context before exposing the mutable headers fixture, and its configuration accepts no post/comment/`loid` fields. A raw-header option merged before context construction plus a runnable Devvit Web + Hono example would close a major gap.

There are also preventable correctness problems in the current configuration reference. It twice says app names are limited to 16 characters, while the live schema and 0.13.6 changelog say 20. Its best-practices section recommends `devvit build`, but CLI 0.13.7 returns `Command build not found`. These are ideal candidates for generated documentation checks because the authoritative schema and command metadata already exist.

The golden-path materials also drift from one another: the quickstart still says the React template uses Express although it now uses Hono; current templates and the Vite guide still emit `inline: true` after the changelog declared it deprecated and ineffective; and both template READMEs claim `npm run type-check` also lints and prettifies even though it only runs TypeScript. Contract-testing documentation commands and examples against each released template would catch these cheaply.

Documentation would also benefit from one authoritative limits/performance page for interactive Web games: expected inline and expanded bundle budgets, iframe startup diagnostics, asset caching, mobile constraints, and guidance for large engines such as Phaser.

For scale, the untouched current Phaser starter successfully produced a 1,380,869-byte `game.js` and 10,960,672-byte source map without a size warning. A deeper Fallstack pass traced the gap to first-party defaults: `@devvit/start` enables linked maps while disabling compressed-size reporting, and the CLI selects every client file for upload. Fallstack's selected client directory was 1.83 MB of runtime files plus 12.57 MB of maps. Maps are not normally fetched during execution, so the actionable issue is package observability, not an unsupported first-paint claim. A pre-upload manifest plus Reddit-specific transfer, caching, first-canvas, memory, mobile, and review targets would tell developers what “good” means.

## How satisfied are you with support in our communities? Rating: not yet evidence-backed

Do not submit a numeric rating or narrative until there is a real support interaction to evaluate. Record the question, channel, response time, accuracy, and whether the answer resolved the issue. Second-hand community posts are not evidence of Fallstack's support experience.

## Do you plan on continuing to develop your project? Why or why not?

Yes. Fallstack's core loop depends on Reddit in a substantive way: every player's falls and clean clears mutate a shared daily tower, and the resulting artifacts become material for community discussion rather than a detached leaderboard. The project already has deterministic tower generation, capped aggregate mutation, server-validated events, checkpoint recovery, desktop/mobile controls, and an inline-to-expanded Devvit Web structure. The next work is production confidence: real-host mobile/performance measurement, persistence and concurrency hardening, and clearer evidence that a player's contribution survives and visibly changes the shared post.

## What would get you most excited to start working on a new app?

A trustworthy local-to-Reddit testing ladder: instant client preview, a first-party local server harness that can reproduce every authenticated/anonymous post context, and one command that promotes the same test scenario into a real playtest installation with correlated client/server traces. That would make ambitious realtime or game-like ideas feel cheap to explore without hiding the platform-specific risks until late in development.

I would also be excited by hackathon categories that reward persistent community systems, paired with reference apps that show production patterns for concurrency, idempotency, abuse caps, logged-out users, mobile performance, and analytics—not only small API examples.

## Please share anything else you would like for the team to know

Devvit Web is compelling because it lets web developers keep familiar tools while Reddit supplies the difficult, valuable parts: distribution inside a post, identity, community context, persistence, and conversation. Fallstack could use Phaser and Hono without placing Redis or Reddit trust in the iframe, which is the right architecture.

The highest-leverage improvement is to make the testing story match that architecture. Today pure game logic is easy to test and an uploaded playtest can exercise the real platform, but the boundary between them is weak. The current official harness already proved valuable: its isolated Redis and fault injection exposed a Fallstack 400-vs-500 bug and showed that a pre-write NX event claim can poison retries after partial failure. Fixing harness dependency health and adding complete request-context fixtures would turn it into the confidence layer needed for stateful community apps. A non-mutating `devvit validate` command, generated schema/CLI reference checks, and machine-readable log lifecycle events would make the surrounding toolchain considerably easier to trust. Each issue above has a reproduction, impact statement, workaround status, and suggested fix in the accompanying development log.
