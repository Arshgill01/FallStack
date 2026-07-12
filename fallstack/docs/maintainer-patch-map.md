# Devvit Feedback Maintainer Patch Map

Date: 2026-07-12

This turns reproduced Fallstack findings into source-level changes a Devvit maintainer can evaluate quickly. It is not a patch against Reddit's repository and does not claim full upstream test coverage.

## Pinned upstream sources

- `reddit/devvit`: `075019a41285ddf266bedf52bc7878763f59aecc` (2026-07-10)
- `reddit/devvit-docs`: `c8bb880f5af14e8dde58e9a010b01cbdb28ad179` (2026-07-10)
- React template: `bee528c76b388978cd3c24ca9e6af3402c6116e6`
- Phaser template: `23e3eeeae3141216fb211ea64b34f4884167438f`

## Patch 1 — Remove the starter/CLI audit finding

Source: `packages/cli/package.json` pins `inquirer` to 9.1.4. That version resolves legacy `external-editor@3.1.0 > tmp@0.0.33` in fresh starter installs.

Minimal candidate:

```diff
- "inquirer": "9.1.4",
+ "inquirer": "9.3.8",
```

Why 9.3.8: it replaces the legacy editor dependency with `@inquirer/external-editor` and removed the reproduced audit path.

Targeted validation completed:

- disposable `devvit@0.13.7` project with npm override `inquirer: 9.3.8`
- `npm install`: passed
- `npm audit`: 0 vulnerabilities
- dependency tree: no legacy `external-editor/tmp` path
- `npx devvit --version`: passed and reported CLI 0.13.7

Still required upstream: the CLI unit/type/lint/oclif suites and interactive prompt smoke tests.

## Patch 2 — Repair `@devvit/test` dependency health

Sources:

- `packages/test/package.json` production dependency `redis-memory-server: 0.14.1`
- `packages/redis/package.json` development dependency at the same version

Minimal candidates:

```diff
- "redis-memory-server": "0.14.1"
+ "redis-memory-server": "0.17.0"
```

Targeted validation completed by overriding the dependency beneath published `@devvit/test@0.13.7`:

- install with the documented system-binary escape hatch: passed
- `npm audit`: 0 vulnerabilities
- resolved `tar@7.5.20`; old UUID dependency removed
- Vitest `createDevvitTest()` Redis set/get: passed

Still required upstream: all `packages/test` and `packages/redis` tests on supported operating systems, plus fresh-binary download/compile coverage. The bump fixes dependency health but does not remove the need to document the implicit Redis download.

## Patch 3 — Make request context configurable in `@devvit/test`

Source: `packages/test/src/server/vitest/devvitTest.ts`.

Root cause:

1. `DevvitTestConfig` accepts user/subreddit/settings/app config only.
2. `setup()` constructs a headers object.
3. `reqCtx = Context(headers)` snapshots it.
4. The same headers object is then exposed as a fixture.
5. Test-time mutation therefore changes the fixture but cannot rebuild `context.postId`, `commentId`, or `loid`.

Smallest general API:

```ts
export type DevvitTestConfig = {
  // existing fields...
  headers?: Partial<Record<Header, string>>;
};

const headers = {
  ...headersMock,
  [Header.User]: userId,
  [Header.Username]: username,
  [Header.AppUser]: userId,
  [Header.Subreddit]: subredditId,
  [Header.SubredditName]: subredditName,
  ...config.headers,
};
```

Typed convenience fields (`postId`, `commentId`, `loid`) could wrap this, but raw headers cover the full request context and future fields. Add tests that assert the exported `@devvit/server` context values inside the runner. Also document that the existing fixture is observational unless a request-context rebuilding API is added.

## Patch 4 — Make missing-entry diagnostics config-aware

Source: `packages/build-pack/src/esbuild/ESBuildPack.ts`.

Confirmed implementation:

- fixed 10-second entry poll
- warning starts at 5 seconds
- both failure branches hard-code “the `server.entry` value in devvit.json”

Recommended split:

1. Pass the resolved config filename into build-pack diagnostic context and print that path.
2. Tell build-pack whether the caller is a finished one-shot build or a live watcher. Skip the poll after a completed one-shot build; retain it when concurrent/watch output may still appear.
3. Keep the exact missing artifact path, which is already useful.

## Patch 5 — Add machine-readable log lifecycle status

Sources:

- `packages/cli/src/commands/logs.ts`
- `packages/cli/src/util/app-logs/make-log-subscription.ts`
- `packages/cli/src/util/app-logs/app-log-observer.ts`

Confirmed behavior:

- human mode prints a connected divider after installation lookup
- JSON mode explicitly suppresses that divider
- JSON observer serializes only log/error/event payloads
- stream keepalives exist but are hidden by default
- completion output is also suppressed in JSON mode

Minimal non-breaking option: add a public `--status-events` flag that emits typed JSON records for `connected`, `keepalive`, `reconnecting`, `complete`, and terminal error. Send status to stderr by default or document a discriminated JSONL envelope. If the remote API cannot identify when historical drain transitions to live tail, document that limitation instead of promising `history_complete`.

## Patch 6 — Repair current docs/template contracts

Pinned docs source edits:

| File | Current problem | Minimal correction |
| --- | --- | --- |
| `docs/capabilities/devvit-web/devvit_web_configuration.md` | Says app name max is 16 twice | Change to 20 or generate from schema |
| same file | Recommends nonexistent `devvit build` | Point to project build plus upload/playtest validation, or add `devvit validate` |
| `docs/quickstart/quickstart.md` | Says current React example uses Express | Change to Hono |
| `docs/examples/template-library.md` | Says React and Phaser starters include Express | Change both to Hono; audit Three.js separately |
| `docs/guides/tools/vite.mdx` | Canonical example includes deprecated/no-op `inline: true` | Remove `inline` |
| current React and Phaser `devvit.json` | Both emit deprecated/no-op `inline` | Remove it |
| current React and Phaser `README.md` | Says type-check also lints/prettifies | Describe `tsc --build`, or add a real aggregate `check` script |

Recommended CI contracts:

1. execute every documented CLI/npm command in code blocks marked as runnable;
2. validate duplicated schema constraints against `config-file.v1.json`;
3. compare template-library framework claims with template dependencies;
4. scan current templates/examples for properties marked removed/deprecated in the active changelog;
5. require clean-install high-severity audits for released templates.

## Public duplicate screening

Using authenticated `gh issue list/search` across open and closed `reddit/devvit` issues, keyword searches found no direct report for these primary dependency, test-context, config-command/name-limit, or JSON-lifecycle findings. Issue #116 concerns a different runtime forms scenario where context IDs disappear for multi-location menu items; it is not the test-harness configuration gap described here.

This screening is intentionally modest: titles/bodies and search indexing can miss internal or differently worded tickets. The submission should say “no direct public duplicate found,” not “previously unknown.”
