# Feedback Submission Evidence Audit

Audit date: 2026-07-12
Tested Devvit version: 0.13.7

This is the claim gate for the paste-ready form answers. “Submission-ready” means the current repository contains direct evidence for the claim at the same scope. It does not mean the broader feedback objective is complete.

The separate `award-criteria-audit.md` maps the completed package to Reddit's published Feedback Award signals and records the final readiness judgment.

## Form coverage

| Required question | Answer status | Evidence basis | Remaining uncertainty |
| --- | --- | --- | --- |
| Future hackathon category | Ready | Product thesis, Reddit-native shared mutation design, working aggregate state architecture | Preference, not an empirical platform claim |
| Developer-experience rating | Ready at 3/5 | Real build/upload/read-back, authenticated inline/expanded host QA, two-tab hosted race, hosted validation probes, logged-out boundary, two template audits, harness install/audit/context experiments, 101 real route requests | Physical-mobile, successful `loid`, and uncapped hosted write remain |
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

- clean `@devvit/test@0.13.7` install attempted an implicit Redis source download and stayed at 0% for more than three minutes;
- published dependency path introduced 2 high and 2 moderate audit findings through `redis-memory-server@0.14.1`;
- forcing 0.17.0 produced 0 findings and passed a real harness Redis test;
- public runner configuration cannot set post/comment/logged-out request context;
- public source constructs `Context(headers)` before exposing the headers fixture;
- manual context setup enabled 101 requests through real Fallstack Hono routes and found an application HTTP-status bug plus an interrupted-idempotency risk.

Conclusion: submission-ready, balanced positive/negative evidence. State targeted patch validation accurately; do not say Reddit's full suite passes.

### P0 — New starters inherit a fixable CLI audit finding

Evidence:

- pinned current React and Phaser starter clones both installed with 1 high and 4 low findings;
- common path: `devvit@0.13.7 > @devvit/cli@0.13.7 > inquirer@9.1.4 > external-editor@3.1.0 > tmp@0.0.33`;
- public CLI manifest pins Inquirer 9.1.4;
- forcing Inquirer 9.3.8 installed at 0 findings and still ran `npx devvit --version`.

Conclusion: submission-ready. Explicitly say this is development CLI code, not the shipped game bundle.

### P0 — Current golden-path documentation has contract failures

Evidence:

- configuration prose says name max 16; live schema and changelog say 20;
- configuration best practice recommends `devvit build`; CLI 0.13.7 has no build command;
- quickstart/template library say Express; current React/Phaser starters use Hono;
- changelog says `inline` is deprecated/no-op; Vite guide and both starters still emit it;
- starter READMEs say type-check also lints/prettifies; script only runs `tsc --build`.

Conclusion: submission-ready. Recommend generated/contract-tested docs rather than listing typos without a systemic fix.

### P1 — CLI machine-readable diagnostics need lifecycle events

Evidence:

- JSON and verbose-JSON log streams emitted nothing for up to about one minute with no logs;
- human mode emitted a connected banner;
- public source suppresses connected/completion dividers in JSON and serializes only log/error/event messages; keepalives are hidden by default.

Conclusion: submission-ready as secondary observability feedback. Do not promise `history_complete` is implementable if the remote API has no history/tail boundary.

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
- Schema validation gave useful nested paths for unknown fields and malformed internal endpoints.
- With manual request context, the first-party harness provided isolated Redis, concurrency, and fault injection that materially improved Fallstack.
- Fallstack's 46 committed pure/client tests, type-check, lint, audit, and production build pass in the dedicated worktree.

## Claims excluded from criticism

| Observation | Reason excluded or constrained |
| --- | --- |
| Automated Reddit page returned network-security block | Host/access environment; not established as Devvit defect |
| Incognito page is blocked while authenticated profile succeeds | Reddit access/auth boundary; useful QA limitation, not Devvit criticism |
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

1. Hosted Redis replay of a fresh successful contribution under an uncapped identity; the current authenticated account was already capped. Cross-tab duplicate-marker sharing is now verified.
2. Logged-out `loid` on a Reddit-allowed device/network or supported developer-token browser path; response-loss and mutation transaction/state-machine testing.
3. Physical-mobile and broader host performance evidence; current timing has three controlled VM runs but is not a population percentile.
4. First-hand support interaction if the submission deadline permits.
5. Sharing the evidence branch/repository if the form allows an appendix link.

These gaps limit claims but do not block the current award-ready submission: every claim in the paste-ready form is already supported at its stated scope, and the gaps are disclosed directly.
