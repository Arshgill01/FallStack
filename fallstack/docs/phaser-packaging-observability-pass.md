# Phaser Packaging and Upload Observability Pass

Date: 2026-07-12 UTC
Tested versions: `@devvit/start@0.13.7`, `@devvit/cli@0.13.7`, Vite 8.1.4, Phaser 4.2.1
Public source checked: `reddit/devvit@075019a41285ddf266bedf52bc7878763f59aecc`

## Question

Does the current Devvit Web build/upload path give a Phaser developer enough information to understand what will be uploaded and what may affect runtime loading?

## Direct observations

Fallstack's unmodified Devvit Vite integration is:

```ts
plugins: [react(), tailwind(), devvit()]
```

`npm run build` succeeded. It printed a Devvit plugin-timing advisory, a generic chunk-over-500-kB warning, and `Build complete`, but no per-file or total sizes.

The current `@devvit/start` implementation explains why. Published `node_modules/@devvit/start/vite/index.js` and pinned public source `packages/start/src/vite/index.ts` both set:

```js
sourcemap: true,
reportCompressedSize: false,
```

The plugin also names client maps as `[name].js.map`. This is first-party behavior, not a Fallstack Vite override.

The current CLI uploader's `queryAssets()` function in published `node_modules/@devvit/cli/dist/util/AssetUploader.js` and pinned public source `packages/cli/src/util/AssetUploader.ts` globs every file below the configured client directory. Client assets pass an empty extension allowlist, so `.map` files are included. Invoking that exported function against the actual `dist/client` selected all 12 files, including all three source maps.

## Measured Fallstack output

The measurements below came from the successful production build used for this pass. Gzip and Brotli-Q4 figures are local diagnostic estimates, not claims about Reddit's actual transfer encoding.

| Class | Files | Raw bytes | Gzip bytes | Brotli-Q4 bytes |
| --- | ---: | ---: | ---: | ---: |
| Runtime HTML/CSS/JS/fonts | 9 | 1,826,262 | 517,826 | 520,644 |
| Source maps | 3 | 12,571,300 | 2,106,970 | 1,945,852 |
| Total client directory | 12 | 14,397,562 | 2,624,796 | 2,466,496 |

The uploader's own enumeration reported 12 files and 14,397,690 raw bytes. The 128-byte difference from the on-disk total is caused by the CLI injecting its Devvit script into the two HTML files before hashing/upload.

Source maps were 87.3% of the raw selected client bytes. The largest individual files were:

| File | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| `game.js.map` | 11,162,646 | 1,849,499 |
| `game.js` | 1,441,869 | 375,817 |
| `jsx-runtime.js.map` | 841,118 | 166,261 |
| `default.js.map` | 567,536 | 91,210 |

The emitted JavaScript contains linked `sourceMappingURL` comments. Source maps are useful for debugging and are not normally fetched for ordinary execution, so this pass does **not** claim that the 12.57 MB map total delays first paint. It does prove that the default build creates them, the normal build summary hides their sizes, and the uploader selects them.

## Limit and diagnostics audit

- `devvit upload --help` has no dry-run, manifest, analyze, or local validation option.
- The CLI enforces a 1 GiB combined asset-folder ceiling through `MAX_ASSET_FOLDER_SIZE_BYTES`.
- The 20 MB non-GIF and 40 MB GIF checks apply to regular media assets. The client/WebView path does not run those per-file checks before requesting upload URLs.
- The upload progress UI reports remaining WebView bytes only after remote asset reconciliation starts.
- Current Devvit Web overview documentation gives request/response limits, but the reviewed game/Web documentation does not provide a Phaser-oriented JavaScript budget, source-map policy, first-canvas-paint target, or a command that previews the upload manifest.
- The Unity quickstart documents a 100 MB file-upload limit and 30-second timeout. That is useful engine-specific guidance, but it does not answer the JavaScript/WebView packaging questions above.

## Developer impact

A successful build does not tell a game developer:

1. which files Devvit will upload;
2. raw versus compressed runtime bytes;
3. how much of the upload is debugging metadata;
4. whether source maps should differ between playtest and publish builds;
5. whether the generic Vite 500 kB warning is meaningful inside Reddit;
6. which mobile/host loading target should gate launch.

That uncertainty is already visible in the developer community: a June 2026 r/Devvit question asked whether a 30 MB server bundle was acceptable and surfaced a 32 MiB runtime bootstrap failure, while replies mixed asset, payload, response, and runtime limits. This is corroborating ecosystem evidence, not the basis of the first-party finding.

## Recommended patch

Add a local, non-mutating packaging report to `devvit validate` or `devvit upload --dry-run`:

```text
Client manifest: 12 files
Runtime: 1.83 MB raw / 0.52 MB gzip estimate
Source maps: 12.57 MB raw / 2.11 MB gzip estimate
Largest runtime entry: game.js 1.44 MB raw / 0.38 MB gzip estimate
Entrypoints: default -> splash.html; game -> game.html
Warnings: game.js exceeds the recommended expanded-game budget
```

The report should:

- show every selected file and why it is included;
- separate runtime assets from source maps;
- report raw and estimated compressed sizes without implying the estimate is the host transfer size;
- publish host-specific targets for inline launch, expanded first canvas, mobile memory, and review readiness;
- offer an explicit map policy, such as maps on for playtest and configurable for uploaded/published versions;
- run before any asset upload or remote version mutation.

This is a tooling and guidance improvement, not a request to reject Phaser-sized bundles automatically. The platform has to expose its actual serving, caching, and review constraints before a reliable hard threshold can be chosen.

## Reproduction

From `fallstack/`:

```sh
npm run build
find dist/client -maxdepth 1 -type f -printf '%f\t%s\n' | sort
```

Then call the installed CLI's exported enumeration function:

```js
import { queryAssets } from './node_modules/@devvit/cli/dist/util/AssetUploader.js';

const assets = await queryAssets('./dist/client', [], 'Client', '0.13.7', false);
console.log(assets.map((asset) => [asset.filePath, asset.size]));
```

No remote version was created by this pass.
