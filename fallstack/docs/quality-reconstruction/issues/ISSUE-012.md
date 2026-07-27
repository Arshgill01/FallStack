# ISSUE-012 — baseline player lacks a distinctive state language

## Classification

- Severity: Product blocker
- Workstream: Character presentation
- Ownership: Phaser procedural player renderer
- Baseline: `7c4e06f`
- Reproducibility: 100% visual assessment at 320/375 px
- Current state: Fixed and browser-regressed

## Observation

The baseline was a small rounded reliquary figure with only coarse grounded,
charge, airborne, and fall poses. The user explicitly rejected its quality. It
did not provide a distinctive silhouette or clear landing, respawn, checkpoint,
and summit ceremonies at actual mobile scale.

## Ranked hypotheses and probes

1. The rounded body reads as a placeholder mascot. Compare three silhouette
   directions under identical physics and palette constraints.
2. More detail alone will disappear at 1×. Require 320/375 context captures.
3. Animation could misrepresent collision. Freeze the transparent 20×28 body
   and verify every visual state against it.
4. Motion-only states fail reduced-motion users. Capture the same matrix with
   reduced motion.

## Regression seam

`npm run qa:character-states` validates the unchanged body and captures
grounded, low/full charge, rising, apex, falling, hard landing, respawn,
checkpoint, and summit in standard and reduced-motion modes.

## Fix and result

After the user selected A, Washi Pilgrim replaced the rounded mascot with an
angular folded-washi hood, faceless indigo core, gold seal-eye, persimmon
prayer strip, ragged cloak, and archive pack. The
[standard matrix](../evidence/character-washi-pilgrim/standard-contact-sheet.png),
[reduced matrix](../evidence/character-washi-pilgrim/reduced-contact-sheet.png),
and [machine report](../evidence/character-washi-pilgrim/report.json) pass at
unchanged 20×28 physics. Chromium and WebKit runtime smokes pass. Commit:
`776999a`.

## Residual risk

Procedural line detail is intentionally restrained at 1×. Final physical-device
acceptance should include a real iPhone and Android screen, especially under
non-integer browser scaling.
