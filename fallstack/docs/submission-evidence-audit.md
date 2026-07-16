# Feedback Submission Evidence Audit

Audit date: 2026-07-14
Tested Devvit versions: current stable 0.13.8 for CLI/package/harness checks; hosted app v0.0.20.2 on 0.13.7

This is the claim gate for the paste-ready form answers. “Submission-ready” means the current repository contains direct evidence for the claim at the same scope. It does not mean the broader feedback objective is complete.

The separate `award-criteria-audit.md` maps the completed package to Reddit's published Feedback Award signals and records the final readiness judgment.

## Form coverage

| Required question | Answer status | Evidence basis | Remaining uncertainty |
| --- | --- | --- | --- |
| Future hackathon category | Ready | Reddit's differentiated community context, persistent state, recurring participation, and discussion surfaces | Preference, not an empirical platform claim |
| Platform recommendation | Ready at 7/10 | Working Web architecture and authenticated host behavior balanced against the verified testing, dependency, documentation, playtest, and observability gaps below | Subjective recommendation based on the audited developer experience |
| Developer-experience rating | Ready at 3/5 | Real build/upload/read-back, authenticated Chrome/Safari host QA, shared-board reconciliation, two-tab race, current template/CLI audits, current harness install/audit/context experiments, and 101 real route requests | Physical-mobile, successful `loid`, uncapped hosted write, and cross-browser playtest-bridge comparison remain |
| Why DX rating | Ready | Exact versions, dependency paths, timings, route tests, verified candidate dependency bumps | Candidate bumps have targeted—not full upstream—coverage |
| Documentation satisfaction | Ready at 3/5 | Current docs, schema, changelog, templates, CLI commands, public docs source | Pages can change after audit date |
| Why documentation rating | Ready | Direct contradictions and exact source files; positive architecture assessment grounded in working implementation | No new-developer usability study beyond this build |
| Community support satisfaction | Neutral 3/5, explicitly low confidence | Channels/public tracker were discoverable; authenticated public duplicate search performed | No first-hand support request or response-time sample |
| Continue project | Ready | Current architecture, successful validations, authenticated host QA, live-snapshot fix, concrete persistence gaps | Launch viability still depends on persistence hardening and physical-mobile QA |
| Excitement for new app | Ready | Directly derived from observed iteration/testing costs and useful harness behavior | Preference |
| Anything else | Ready | Prioritized maintainer brief and patch map with verified candidates, acceptance criteria, ownership, and limitations | Cannot attach local evidence unless repository/branch is shared |

## Primary submission claims

### P0 — Testing path is valuable but not cleanly adoptable

Evidence:

- an uncached Ubuntu `@devvit/test@0.13.7` install attempted an implicit Redis source download and stayed at 0% for more than three minutes;
- a clean Mac `@devvit/test@0.13.8` install downloaded source and compiled Redis during `npm install`, narrowing the stall to environment-specific behavior while confirming the undocumented native setup;
- the current published dependency path introduced 2 high and 2 moderate findings through `redis-memory-server@0.14.1`;
- forcing 0.17.0 produced 0 findings and passed a focused Redis set/get on 0.13.8; a separate regression test reconfirmed the unchanged context gap;
- current public runner configuration cannot set post/comment/logged-out request context;
- public source constructs `Context(headers)` before exposing the headers fixture;
- manual context setup enabled 101 requests through real Fallstack Hono routes and found an application HTTP-status bug plus an interrupted-idempotency risk.

Conclusion: submission-ready, balanced positive/negative evidence. State targeted patch validation accurately; do not say Reddit's full suite passes.

### P0 — New starters inherit a fixable CLI audit finding

Evidence:

- pinned current React and Phaser starter clones both installed with 1 high and 4 low findings;
- both current template pins reproduce `devvit@0.13.7 > @devvit/cli@0.13.7 > inquirer@9.1.4 > external-editor@3.1.0 > tmp@0.0.33` on macOS;
- a separate clean `devvit@0.13.8` install retains the same path and findings;
- forcing Inquirer 9.3.8 under 0.13.8 installed at 0 findings and still ran `npx devvit --version`.

Conclusion: submission-ready. Explicitly say this is development CLI code, not the shipped game bundle.

### P0 — Current golden-path documentation has contract failures

Evidence:

- configuration prose says name max 16; live schema and changelog say 20;
- configuration best practice recommends `devvit build`; CLI 0.13.7 has no build command;
- quickstart/template library say Express; current React/Phaser starters use Hono;
- changelog says `inline` is deprecated/no-op; Vite guide and both starters still emit it;
- starter READMEs say type-check also lints/prettifies; script only runs `tsc --build`;
- Redis guide treats `await txn.get(key)` as a returned value; current 0.13.8 transaction declarations return `TxClientLike`;
- stable 0.13.7 and 0.13.8 are published while the official changelog ends at 0.13.6.

Conclusion: submission-ready. Recommend generated/contract-tested docs rather than listing typos without a systemic fix.

### P1 — CLI machine-readable diagnostics need lifecycle events

Evidence:

- JSON and verbose-JSON log streams emitted nothing for up to about one minute with no logs;
- human mode emitted a connected banner;
- public source suppresses connected/completion dividers in JSON and serializes only log/error/event messages; keepalives are hidden by default.

Conclusion: submission-ready as secondary observability feedback. Do not promise `history_complete` is implementable if the remote API has no history/tail boundary.

### P1 — Safari cannot connect the documented playtest client bridge

Evidence:

- authenticated Safari rendered the installed inline and expanded app, so the failure is not general app execution;
- the HTTPS Reddit playtest page reported `ws://localhost:5678/` as blocked insecure content;
- current CLI source assigns port 5678 to `PlaytestServer`, the bidirectional client-log/reload bridge;
- `devvit logs ... --connect` printed its streaming banner and `lsof` confirmed Node listening on TCP 5678;
- reloading the Safari page produced no client connection divider;
- official playtest docs say the query parameter streams client logs and provides live reload.

Conclusion: submission-ready as a Safari-specific compatibility/diagnostic finding. Do not claim the app failed, physical-mobile impact, or cross-browser failure; the separate Chrome profile was not authenticated.

### P1 — Hosted requests lack a browser-to-runtime join key

Evidence:

- `devvit logs --help` has no request/trace filter or correlation option;
- `--json --log-runtime --since=30m` emitted no automatic record for recent successful hosted requests;
- an authenticated `/api/init-game` response exposed content/security and Reddit infrastructure headers but no request, trace, correlation, ray, server-timing, or opaque request-ID header;
- Fallstack did not emit per-request application logs, so the silent stream is not described as dropped log data.

Conclusion: submission-ready as an observability recommendation. Ask for an opaque response ID propagated into server context and structured runtime/error logs. Do not claim successful requests were mishandled.

### P1 — Game performance guidance lacks actionable host-specific targets

Evidence:

- untouched current Phaser starter built successfully with a 1,380,869-byte `game.js` and 10,960,672-byte source map;
- Fallstack's current Devvit build emitted 1,826,262 raw runtime client bytes and 12,571,300 raw source-map bytes;
- the first-party Vite plugin explicitly sets `sourcemap: true` and `reportCompressedSize: false`;
- the CLI uploader's own `queryAssets()` selected all 12 client files, including all three maps;
- maps were 87.3% of selected raw client bytes, but this does not prove they are fetched during normal gameplay;
- `devvit upload` exposes no dry-run/manifest/analyze option;
- three authenticated same-version v0.0.15 runs produced 392–4,164 ms cold-cache FCP (3,292 ms median) versus 400–412 ms warm-cache FCP (412 ms median);
- the 371,879-byte encoded / 1,433,086-byte decoded `game.js` transferred in every cold run and ranged from 90.5 to 2,222.6 ms (2,180.2 ms median), versus a 46.1 ms warm median;
- initial API state completed at a 4,267.5 ms cold median versus 1,003.3 ms warm median;
- no source-map request appeared in the execution Resource Timing entries.

Conclusion: submission-ready as a tooling/documentation request, not a CDN/runtime defect. Ask for a non-mutating package report and measured platform targets; do not generalize one VM or claim source maps delay first paint.

## Positive claims retained

- Devvit Web's ordinary client/server architecture supported Phaser, React, Hono, server-only Redis/Reddit capabilities, and a lightweight inline entrypoint.
- The real playtest CLI built and installed v0.0.14.4; installation and exact version were independently read back.
- Authenticated Reddit rendered the real inline and expanded app in Mobile and Desktop host modes. Safe hosted probes confirmed authenticated context, account caps, duplicate recognition, stale fall/clear/summit rejection, and summit geometry validation while preserving the 46/0/0 snapshot.
- Two simultaneous expanded tabs returned the same identity and baseline; concurrent identical attempts produced one cap response and one duplicate response, with 46/0/0 preserved in both frames.
- A later independently read-back v0.0.15 cold/warm pass measured real iframe paint, bundle, cache, and init timing without preserving credentials or tokenized URLs.
- The currently installed v0.0.20.2 rendered in authenticated Safari. Earlier two-client Safari evidence proved shared revision reconciliation `R37 → R39` without reload; the current read-only board showed `R40`.
- Schema validation gave useful nested paths for unknown fields and malformed internal endpoints.
- With manual request context, the first-party harness provided isolated Redis, concurrency, and fault injection that materially improved Fallstack.
- Current `master` passes audit, type-check, lint, 110 tests, and production build; the build retains only the existing generic chunk-size advisory.

## Claims excluded from criticism

| Observation | Reason excluded or constrained |
| --- | --- |
| Automated Reddit page returned network-security block | Host/access environment; not established as Devvit defect |
| VM incognito is blocked; Mac private browsing reaches Reddit but the test subreddit is private | Reddit access/subreddit topology; useful QA limitation, not Devvit criticism |
| Chrome/Playwright/agent-browser setup problems | Third-party/local environment |
| npm `globalignorefile` warnings | Local npm configuration ownership unresolved |
| Static fallback initially rendered blank | Fallstack-owned bug |
| Inline shared counters were stale | Fallstack-owned hard-coded copy; fixed locally by loading `/api/init-game` |
| Internal failures returned 400 | Fallstack-owned and fixed |
| NX marker poisons retry after later failure | Fallstack-owned open persistence design risk |
| Raw `vite dev` rejected | Documented intentional plugin limitation; mention only as iteration cost |
| Generic chunk warning | Mostly Vite/Phaser; ask Devvit for host budgets rather than call it a bug |
| Community response quality | No first-hand interaction; do not infer from other people's threads |

## Residual evidence gaps that must remain visible

1. Hosted Redis replay of a fresh successful contribution under an uncapped identity; current board/account state was not used for synthetic writes. Cross-tab duplicate-marker sharing and two-client reconciliation are already verified.
2. Logged-out `loid` on a public/otherwise accessible test installation; response-loss and mutation transaction/state-machine testing.
3. Physical-mobile and broader host performance evidence; current timing has three controlled VM runs but is not a population percentile.
4. First-hand support interaction if the submission deadline permits and the user approves the exact public message.
5. Sharing the evidence branch/repository if the form allows an appendix link.

These gaps limit claims but do not block the current award-ready submission: every claim in the paste-ready form is already supported at its stated scope, and the gaps are disclosed directly.
