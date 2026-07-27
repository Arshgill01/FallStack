# ISSUE-014 — dialogs leave the live climb running underneath

## Classification

- Severity: High
- Workstream: UI, guidance, and feedback
- Ownership: React shell and Phaser input/simulation lifecycle
- Baseline: `3294059`
- Reproducibility: 100% in Chromium at 375×812 and 1280×800
- Current state: Fixed and browser-regressed

## Observation

Opening Guide or Tower Memory disabled the touch buttons but did not affect
Phaser's raw keyboard input. While the visible dialog held focus, ArrowRight
still moved the player and Space still charged and launched.

The production red run recorded a hidden 120.9 logical-pixel move and one launch
behind the 375×812 Guide. At 1280×800, the Guide sequence caused one hidden fall
and respawn. A fall in this state can record a mutation while the player is
reading a modal.

## Ranked hypotheses and probes

1. `TouchControls` resets only `window.fallstackInput`, while the scene also
   reads Phaser cursor and Space keys. Compare both input sources while a dialog
   is open.
2. React owns dialog visibility but never publishes that state to the scene.
   Inspect `guideOpen`, `summitOpen`, and the scene reference.
3. Ignoring keyboard input alone would still allow an already committed airborne
   arc or an artifact timer to progress invisibly. Pause the scene clock and
   physics, not only the keyboard state.

## Regression seam

`npm run qa:ui-accessibility` opens both dialogs in the production build at
375×812 and 1280×800. It sends ArrowRight and Space, then verifies:

- the scene is paused;
- position, attempt ID, charge, launch count, and fall count do not change;
- touch controls are disabled;
- the dialog remains operable;
- closing it restores focus and keyboard movement.

The same contract runs in Chromium and WebKit.

## Fix

- React synchronizes Guide/Tower Memory visibility to `FallstackScene`.
- Pausing resets shared touch state and Phaser keys, cancels a planted charge
  without launching, stops grounded drift, and pauses the whole scene.
- Closing the dialog resumes the scene only after resetting input again, so a
  key held through the transition cannot become sticky.
- A pre-boot ref preserves the correct paused state if a dialog opens while
  Phaser is still starting.

## Result and evidence

The [Chromium report](../evidence/ui-accessibility-fix/chromium/ui-accessibility.json)
and [WebKit report](../evidence/ui-accessibility-fix/webkit/ui-accessibility.json)
each pass 48 checks with zero failures. Guide and Tower Memory show zero
position, charge, launch, fall, and attempt deltas at both viewports. Keyboard
movement resumes after close.

The broader Chromium/WebKit runtime smokes, mobile-only world-bound regression,
mobile readability harness, 151 tests, type-check, lint, build, and
`git diff --check` pass.

## Residual risk

The scene deliberately freezes a committed airborne arc and its timers while a
dialog is open, then resumes them on close. This change does not alter tower
geometry, mobile wall planes, or the already-correct desktop/fullscreen outer
edge.
