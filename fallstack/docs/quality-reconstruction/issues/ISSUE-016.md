# ISSUE-016 — short-screen receipts obscure the recovery jump

## Classification

- Severity: Medium
- Workstream: UI, guidance, and feedback
- Ownership: Responsive HUD CSS
- Baseline: `32ece8c`
- Reproducibility: 100% at 320×568
- Current state: Fixed and browser-regressed

## Observation

The full mutation receipt occupied 166.1 px at 320×568. From the final recovery
checkpoint it covered 2,090 square pixels of the next required landing. If a
remote mutation beat appeared at the same time, the two notices extended over
the player at every sampled start/checkpoint recovery.

The receipt explanation was also 9 px at both mobile widths. Its coral counter
on the washi card measured only 2.96:1 contrast.

## Ranked hypotheses and probes

1. The receipt retains desktop information density inside the 436 px-tall
   320×568 play viewport. Measure its actual box, not only its CSS offset.
2. The fixed `.below-receipt` remote-beat position assumes enough vertical room
   for both notices. Render them together at every recovery point.
3. A top-aligned notice can be safe at one checkpoint but cover a higher target
   elsewhere. Project the player and next route platform through the real Phaser
   camera for all checkpoints.

## Regression seam

`npm run qa:ui-overlays` renders five notice states at 320×568 and 375×812:

- long plain message;
- long unavailable/capped-style receipt;
- checkpoint;
- remote beat;
- receipt and remote beat together.

For all twelve sampled recoveries (the start and eleven checkpoints), it
projects the player and next required route platform into DOM coordinates. It
rejects overlap with either, notice-on-notice overlap, viewport escape, receipt
explanation below 13 px, excessive receipt height, and counter contrast below
4.5:1.

## Fix

- All mobile receipt explanations use 13 px text.
- At 320×568-class short/narrow screens, the receipt becomes a 91.5 px compact
  proof: condensed metadata, one-line site/counter row, and a two-line
  explanation. The full DOM text remains available to the polite live region.
- A simultaneous remote beat is suppressed only in that constrained layout,
  where it cannot coexist without hiding the climb.
- The counter uses the existing deep-wine ink instead of low-contrast coral.

## Result and evidence

[`ui-overlays.json`](../evidence/ui-overlays-fix/ui-overlays.json) passes 266
checks with zero failures. All five states have zero overlap with the player,
next landing, or another notice at both viewports. The compact receipt is
91.5 px high at 320×568 and 152.7 px at 375×812; explanation text is 13 px and
counter contrast is 10.63:1.

Captures:

- [320×568 checkpoint receipt](../evidence/ui-overlays-fix/receipt-320x568.png)
- [375×812 checkpoint receipt](../evidence/ui-overlays-fix/receipt-375x812.png)

The 151 tests, type-check, lint, build, mobile readability, Chromium
accessibility, and Chromium/WebKit runtime smokes pass.

## Residual risk

The constrained 320×568 card visually clamps unusually long explanation copy to
two lines and ellipsizes an unusually long site label; its complete DOM text is
still announced. Current generated site labels and normal server copy are
shorter than the edge fixture. Desktop/fullscreen styles and world bounds are
unchanged.
