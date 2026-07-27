# ISSUE-011 — mobile functional text falls below the type contract

## Classification

- Severity: Medium
- Workstream: UI, guidance, and feedback
- Ownership: React shell and responsive CSS
- Baseline: `684a6c0`
- Reproducibility: 100% at 320×568 and 375×812
- Current state: Fixed and browser-regressed

## Observation

The production mobile shell rendered player-facing text below the art bible's
minimums:

- brand `10 px`, community label `7.5 px`, and Guide/Memory actions `8 px`;
- zone name `12 px`, zone state and Jump `10 px`, mutation copy `12 px`;
- Guide body `11 px` and sound toggles `10 px`;
- Tower Memory body `10–11.5 px`, actions `11 px`, and session status `9 px`.

The initial 320×568 and 375×812 captures had no page-level horizontal overflow,
but achieving that density depended on undersized text. Enlarging the status
band without a narrow-width composition rule also reproduced a header collision
at 320 px.

## Ranked hypotheses and probes

1. Final mobile overrides reduce otherwise readable base sizes. Measure computed
   styles from the production build rather than auditing declarations alone.
2. The top status band cannot carry the full secondary label at 320 px. Enlarge
   text first and use the resulting collision to choose the smallest responsive
   copy change.
3. Guide and Tower Memory can absorb larger copy through their existing scroll
   regions. Capture both sheets at the two target viewports and assert that the
   cards stay within the viewport.

## Regression seam

`npm run qa:ui-readability` loads the production build at 320×568 and 375×812,
then checks:

- functional/body/status text is at least `13 px`;
- Tower Memory result body is `14 px`;
- the top band remains 58–68 px with non-overlapping, non-overflowing regions;
- representative controls remain at least 44 px in both dimensions;
- Guide and Tower Memory have no horizontal overflow.

It writes computed measurements and six screenshots beside its report.

## Fix

- Mobile status, action, HUD, Guide, and audio-control copy now meet the `13 px`
  body/status minimum.
- The zone name and Jump control use the art bible's stronger `16 px` and
  `15 px` roles.
- Tower Memory result body uses `14 px`.
- At 320–374 px, the visible tally contracts from “Community falls” to “Falls.”
  Its parent keeps the full count and community wording in its accessible label.
- At 375 px, the complete “Community falls” label remains visible.

## Result and evidence

[`ui-readability.json`](../evidence/ui-readability-fix/ui-readability.json)
passes with zero failures. The top band measures `66 px` at 320 and `67 px` at
375. All three grid regions remain ordered and inside the viewport.

Captures:

- [320×568 game](../evidence/ui-readability-fix/game-320x568.png),
  [Guide](../evidence/ui-readability-fix/guide-320x568.png), and
  [Tower Memory](../evidence/ui-readability-fix/memory-320x568.png)
- [375×812 game](../evidence/ui-readability-fix/game-375x812.png),
  [Guide](../evidence/ui-readability-fix/guide-375x812.png), and
  [Tower Memory](../evidence/ui-readability-fix/memory-375x812.png)

Chromium and WebKit runtime smokes, 151 tests, type-check, lint, build,
`node --check`, and `git diff --check` pass. The known Phaser chunk warning
remains.

## Residual risk

This closes the measured readability defect, not the entire UI workstream. The
harness does not approve contrast, focus trapping, every temporary message,
long-copy variants, or whether a plaque hides a future landing. Those states
remain part of the broader Workstream G audit.
