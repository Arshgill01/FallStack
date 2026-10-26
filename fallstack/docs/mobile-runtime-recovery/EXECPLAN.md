# Mobile runtime recovery ExecPlan

## Objective

Make the deployed Fallstack game behave correctly during real mobile play, not
only under scene-level QA helpers. Reproduce and eliminate the reported
left-side off-screen/freefall path, visible resize/camera wobble, and gameplay
notices that obscure the player or required landing. Prove that the tested
source is the source installed on `r/fallstack_dev`, then commit, push, upload,
install, and inspect that exact build before asking for physical-iPhone review.

## Known state at start

- Local `master` and `origin/master` both point to `9856a71`.
- `r/fallstack_dev` reports `fallstack v0.0.31`.
- The worktree contains unrelated music-prototype changes. They are user-owned
  and must remain outside this work.
- Commits `4e11711`, `50ba7dd`, `57d6f2f`, `7e990ad`, `d0c2423`, `24b406a`,
  and `9856a71` all attempted to address some part of the reported mobile
  behavior.
- The previous task's full-climb script used keyboard input at a mobile-sized
  viewport. Its boundary suite reset the player body and assigned velocity
  directly. Its overlay suite teleported the player, paused the scene, and
  invoked placement/camera methods directly. Hosted checks inspected render
  state without playing the deployed game.
- Those checks can prove narrow geometry contracts, but they do not prove the
  user path of touch input, real falls, asynchronous server receipts, responsive
  layout changes, and continued play in the Reddit mobile WebView.

## Acceptance checklist

- [ ] A normal-input mobile run cannot move or jump the complete rendered
      player outside either visible side of the playfield.
- [ ] Platforms that extend beyond the current camera frame do not allow the
      player to become invisible while remaining supported.
- [ ] Left and right containment are symmetric in Chromium and WebKit at the
      supported compact widths.
- [ ] The playfield and camera do not snap or resize after readiness unless the
      viewport actually changes.
- [ ] A real fall and its asynchronous receipt do not cover the player or the
      next required landing when play resumes.
- [ ] Notices dismiss promptly on resumed charge/movement and do not reappear
      late over active play.
- [ ] A full mobile climb reaches the summit through normal input with no
      boundary, framing, resize, console, or page-error failures.
- [ ] The deployed WebView identifies the new version and serves assets matching
      the committed build.
- [ ] Type-check, lint, tests, build, and the targeted mobile browser checks pass
      on the committed source.

## Feedback loops

1. Real-input boundary loop:
   - use an iPhone-sized, touch-capable browser context with a high device pixel
     ratio;
   - drive Left/Right/Jump through the rendered controls rather than mutating the
     Phaser body;
   - sample the rendered player silhouette, camera, canvas, rails, support
     platform, and viewport each animation frame;
   - fail if the silhouette leaves the visible play cavity while the player is
     alive or supported.
2. Render-stability loop:
   - observe `ResizeObserver`, Phaser scale-resize events, canvas intrinsic/CSS
     dimensions, camera scroll, container bounds, and layout shifts from
     navigation through readiness and first interactions;
   - fail on a resize without a corresponding viewport/container change or on a
     visible camera snap caused by layout churn.
3. Real-fall notice loop:
   - fall through normal controls;
   - let the production React/API receipt path run;
   - resume via touch input while the response may still be pending;
   - measure every visible notice against the rendered player and next required
     landing for its full lifetime.
4. Hosted identity loop:
   - read the installed version;
   - inspect the actual expanded WebView URL and loaded assets;
   - compare a deterministic build marker or asset digest with the committed
     candidate.

## Ranked-hypothesis gate

Do not change production behavior until the feedback loops reproduce the
reported symptoms and three to five falsifiable hypotheses are written down.
Change one variable per probe. Any temporary instrumentation must use a unique
`[DEBUG-mobile-runtime-*]` prefix and be removed before commit.

## Implementation boundaries

- Keep pure layout calculations in `src/client/game/layout.ts` where practical.
- Phaser remains authoritative for physics, camera, and rendering.
- React remains authoritative for DOM notices and lifecycle wiring.
- Do not add dependencies, change server persistence, or redesign the visual
  system unless the reproduction proves one of those is necessary.
- Do not weaken the route, movement model, or product-first viewport to make a
  test pass.

## Validation and release

- Run targeted failing checks before the fix and record their failure modes.
- Re-run them after the fix in Chromium and WebKit.
- Run the full mobile climb with touch or touch-equivalent rendered controls;
  keyboard-only mobile-width playback is not sufficient signoff.
- Run:
  - `npm run type-check`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `git diff --check`
- Commit only scoped source, tests, and concise evidence.
- Push the committed source.
- Resolve a version newer than `0.0.31`, upload it, install it on
  `r/fallstack_dev`, read it back, and inspect the hosted build.

## Progress

- [x] Current local/origin commit and installed version recorded.
- [x] Prior thread and fix/test history audited.
- [ ] Faithful mobile feedback loops implemented and symptoms reproduced.
- [ ] Root causes isolated with falsifiable probes.
- [ ] Regression tests fail before and pass after the production fix.
- [ ] Full local validation passes.
- [ ] Scoped commits pushed.
- [ ] New Devvit version installed and hosted identity/behavior verified.
