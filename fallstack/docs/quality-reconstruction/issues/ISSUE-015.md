# ISSUE-015 — browser and dialog accessibility contracts are incomplete

## Classification

- Severity: Medium
- Workstream: UI, guidance, and feedback
- Ownership: HTML metadata, responsive CSS, and React dialog semantics
- Baseline: `3294059`
- Reproducibility: 100% in Chromium and source inspection
- Current state: Fixed and browser-regressed

## Observation

The interaction audit found four independent contract failures:

- game and splash viewport metadata disabled browser zoom with
  `maximum-scale=1.0, user-scalable=no`;
- `touch-action: none` on the document and tower also suppressed zoom gestures;
- reverse Tab from the initially focused Guide or Tower Memory card escaped the
  dialog, and WebKit did not reliably advance forward from that container;
- Tower Memory used an `aria-label` instead of its visible heading, while the
  primary return action used 13 px cream text on coral at only 2.51:1 contrast.

Neither page declared a browser theme color.

## Regression seam

`npm run qa:ui-accessibility` checks the game and splash metadata, computed
touch-action values, visible dialog title association, initial focus,
forward/reverse focus containment, focus restoration, and computed primary
action contrast. It captures Guide and Tower Memory at 375×812 and 1280×800 in
Chromium and WebKit.

## Fix

- Both viewport declarations permit zoom and now include the existing
  `#08050a` shell color as `theme-color`.
- The document uses `touch-action: manipulation`; the tower allows
  `pinch-zoom`; only the hold controls retain `touch-action: none`.
- Both focus loops explicitly map forward Tab from the dialog container to the
  first action and reverse Tab to the last action.
- Tower Memory's dialog references its visible heading with
  `aria-labelledby`.
- The existing ink color replaces cream on the coral primary action.

## Result and evidence

The [Chromium report](../evidence/ui-accessibility-fix/chromium/ui-accessibility.json)
and [WebKit report](../evidence/ui-accessibility-fix/webkit/ui-accessibility.json)
pass all 48 checks each. The primary action now measures 6.93:1. Browser zoom
gestures remain available without changing direct hold-control behavior.

Screenshots:

- [375×812 Guide](../evidence/ui-accessibility-fix/chromium/guide-375x812.png)
  and [Tower Memory](../evidence/ui-accessibility-fix/chromium/memory-375x812.png)
- [1280×800 Guide](../evidence/ui-accessibility-fix/chromium/guide-1280x800.png)
  and [Tower Memory](../evidence/ui-accessibility-fix/chromium/memory-1280x800.png)

## Residual risk

This closes the measured browser-zoom, focus, semantics, and representative
contrast defects. Long and error-state copy, temporary-message landing
occlusion, orientation changes, and every non-primary color pair remain part of
the wider UI quality gate.
