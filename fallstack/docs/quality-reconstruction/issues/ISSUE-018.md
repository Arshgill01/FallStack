# ISSUE-018 — primary focus and splash-action contrast are too weak

## Classification

- Severity: Medium
- Workstream: UI, guidance, and feedback
- Ownership: Shared interaction CSS and inline splash presentation
- Baseline: `e56c97c`
- Reproducibility: 100% in Chromium at 320×568, 375×812, and 1280×800
- Current state: Fixed and browser-regressed

## Observation

The broader interaction audit found that the shared orange keyboard focus ring
measured only 2.38:1 against the washi header and dialog surfaces. The inline
splash action separately retained cream text on the same orange family at
2.51:1. Both states looked plausible in isolation but failed their respective
3:1 non-text and 4.5:1 text contrast contracts.

The same red run exercised loading, local fallback, counted, capped, stale, and
unavailable response states through the real React/API-response path. Those
states passed their semantics, containment, and text-contrast checks, isolating
the defect to the shared focus treatment and splash label.

## Ranked hypotheses and probes

1. The orange focus token was selected against the dark game shell and then
   reused on light surfaces. Computed styles confirmed 5.31:1 against indigo
   but only 2.38:1 against the production washi.
2. The splash action missed the earlier primary-action correction because it
   lives in the inline entrypoint rather than Tower Memory. Its computed
   cream/orange pair measured 2.51:1.
3. A component-specific shadow or late cascade rule might be hiding a stronger
   focus indicator. Normal and focused computed-style comparison showed that
   the existing brown tactile shadow did not change; the orange outline was
   the only focus-specific signal.

## Regression seam

`npm run qa:ui-states` uses mocked server responses with the production client
at 320×568, 375×812, and 1280×800. It checks:

- visual-only loading and explicit local fallback;
- counted, capped, stale, and unavailable structured receipts;
- banner live-region semantics, tower containment, and representative text
  contrast;
- game, Guide, Tower Memory, and splash text contrast;
- keyboard focus contrast on washi and dark control surfaces;
- page exceptions and unexpected console errors.

## Fix

- Keyboard focus now uses a two-color indicator: a 3 px washi outline plus an
  ink outer ring. One ring remains legible against either the light sheets or
  the dark fixed-control bar.
- The inline splash action keeps its existing orange surface but uses ink text,
  matching the already-approved primary modal action.

No spacing, touch target, input, or game-state behavior changed.

## Result and evidence

The [red report](../evidence/ui-state-matrix-red/ui-states.json) records six
light-surface focus failures at 2.38:1 and the splash label at 2.51:1.

The [green report](../evidence/ui-state-matrix-fix/ui-states.json) passes all
146 checks. The light-surface focus ring measures 16.48:1, the dark-control
focus treatment measures 15.71:1, and the splash label measures 6.93:1. All
twelve counted/capped/stale/unavailable viewport presentations use the
structured production receipt and name whether board state changed.

## Residual risk

The state matrix is a Chromium computed-style and mocked-server audit. Existing
Chromium/WebKit focus-containment checks cover browser behavior, but final
physical-device acceptance should still inspect forced-colors/high-contrast
behavior where available.
