# Current Devvit Web Template Audit

Date: 2026-07-12 18:57–19:04 UTC

## Objective

Test the current first-party React and Phaser golden paths while avoiding creation of another remote Reddit app. Each official repository advertises the corresponding `npm create devvit@latest --template=...` command, so clean pinned clones provide reproducible source/build evidence for the published starters. This pass does not prove which server-side template revision the web wizard selected on that date; the wizard and automatic remote post creation remain outside scope.

## Environment

- Ubuntu VM
- Node v24.18.0 (templates require 22.2.0+)
- npm 11.18.0
- Devvit packages pinned by templates to 0.13.7

## Sources

| Template | Revision | Core stack |
| --- | --- | --- |
| `reddit/devvit-template-react` | `bee528c76b388978cd3c24ca9e6af3402c6116e6` | React 19.2.7, Hono 4.12.28, Vite 8.1.3 |
| `reddit/devvit-template-phaser` | `23e3eeeae3141216fb211ea64b34f4884167438f` | Phaser 4.2.0, Hono 4.12.28, Vite 8.1.3 |

Both repositories intentionally contain template placeholders and no lockfile. `<% name %>` was replaced with a local diagnostic name before installation; no other source/configuration was changed for the baseline runs.

## Commands and results

| Check | React | Phaser |
| --- | --- | --- |
| `npm install` | Passed; 565 packages; 101.60 s on coldest cache | Passed; 510 packages; 20.43 s with warmed registry cache |
| `npm audit --json` | 1 high, 4 low | 1 high, 4 low |
| `npm run type-check` | Passed; 4.66 s | Passed; 4.65 s |
| `npm run lint` | Passed; 7.45 s | Passed; 7.18 s |
| `npm run build` | Passed; 1.95 s wall time | Passed; 2.63 s wall time |

Install timings are environmental/cache observations, not comparative performance claims.

## Dependency finding and verified mitigation

Both templates resolved the identical affected path:

```text
devvit@0.13.7
└─ @devvit/cli@0.13.7
   └─ inquirer@9.1.4
      └─ external-editor@3.1.0
         └─ tmp@0.0.33
```

npm associated `tmp` with `GHSA-ph9p-34f9-6g65` and offered `devvit@1.0.0` as a semver-major automated fix. In the Phaser copy, adding this package override and running `npm install` was sufficient:

```json
{
  "overrides": {
    "tmp": "0.2.7"
  }
}
```

The reinstall changed the transitive package and `npm audit` returned 0 vulnerabilities. This is the same mitigation already present in Fallstack.

Plain `npm audit fix` failed on this environment with an `EBADPLATFORM` error for optional `@esbuild/aix-ppc64@0.28.1`. Because that appears to involve npm's optional-dependency resolution rather than a Devvit-owned package, it is retained as experiment context rather than submitted as a Devvit defect.

## Documentation/template contract drift

1. The current quickstart says its React example uses Express. The pinned current React template imports and depends on Hono; Express is absent.
2. The 0.13 changelog says `post.entrypoints.*.inline` is deprecated, has no effect, and is always implied. Both templates still contain `"inline": true`, and the current Vite guide presents it in the canonical configuration.
3. Both template READMEs say `npm run type-check` “Type checks, lints, and prettifies your app.” Their package scripts define it only as `tsc --build`; lint is a separate command and Prettier is not run.
4. Neither template includes tests or a test script. This is not classified as a defect, but it makes the new production-like testing story undiscoverable from the primary scaffold—especially while `@devvit/test` has the separately documented dependency/context issues.

## Phaser build baseline

The untouched Phaser application build produced:

- `dist/client/game.js`: 1,380,869 bytes
- `dist/client/game.js.map`: 10,960,672 bytes
- full `dist`: approximately 21 MB
- successful build with no bundle-size warning

This does not prove poor runtime performance. It proves that a first-party starting point is already large enough that generic Vite intuition is insufficient; Devvit-specific compressed transfer, cache, iframe startup, memory, mobile, and review budgets would be materially useful.

## Recommended Devvit-team patch set

1. Update the CLI from Inquirer 9.1.4 to at least 9.3.8 (targeted override validated at zero audit findings with the CLI still runnable), or ship the verified safe `tmp` override.
2. Add clean-install + high-severity audit gates to every starter release.
3. Contract-test template README commands against `package.json` scripts.
4. Generate or test configuration examples against current schema deprecations.
5. Update quickstart framework names from template dependencies/imports.
6. Move the test harness to `redis-memory-server` 0.17.0 (targeted Redis harness test validated at zero audit findings), add request-context fixtures, then put a minimal pure test and capability-test example in the golden templates.
7. Publish a game-template performance baseline with host-relevant budgets rather than generic chunk thresholds.

## Cleanup

All template clones and generated dependencies live under `/tmp`; no template source or dependency was added to Fallstack. Only this evidence report and the canonical feedback artifacts are retained.
