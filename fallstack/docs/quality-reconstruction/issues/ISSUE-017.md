# ISSUE-017 — phone rotation removes controls and can hide the climber

## Classification

- Severity: High
- Workstream: UI, input, and camera
- Ownership: Responsive shell CSS and pure viewport layout
- Baseline: `50ba7dd`
- Reproducibility: 100% at 812×375 with a coarse pointer
- Current state: Fixed and browser-regressed

## Observation

The horizontal wall report is mobile-only; desktop and fullscreen already have
the intended outer edge. A separate orientation probe found that rotating a
375×812 phone to 812×375 crossed the width-only desktop breakpoint:

- the fixed touch controls became `display: none`;
- the keyboard-only hint became visible;
- all three touch targets collapsed to 0×0;
- the player could no longer move by touch.

After restoring the controls, an airborne resize exposed a related camera
problem. The wide layout requested 260 logical pixels of bottom padding from a
254-pixel-tall game viewport, which placed the climber above the canvas during
the jump.

## Regression seam

`npm run qa:ui-resize` drives a coarse-pointer session through:

- portrait-to-landscape grounded continuity;
- real touch movement in landscape;
- charging across landscape-to-portrait resize;
- an airborne portrait-to-landscape resize;
- Guide focus, scene pause, containment, disabled controls, and focus restore;
- a separate fine-pointer 812×375 desktop presentation.

It rejects missing or sub-44px controls, a keyboard hint on touch input,
position/attempt loss, synthetic falls, an off-canvas player, dialog escape,
or desktop control-mode regressions.

## Fix

- Control visibility now follows pointer capability: a wide coarse-pointer
  viewport keeps touch controls, while a wide fine-pointer viewport keeps the
  existing desktop keyboard presentation.
- The wide-header breakpoint remains width-based and unchanged.
- Camera bottom padding retains its existing 150/260-pixel targets but is
  capped to 60% of the live viewport height. Tall desktop/fullscreen framing is
  unchanged; a short landscape viewport keeps the player inside the canvas.
- Horizontal physics bounds are unchanged by this fix.

## Result and evidence

Both
[Chromium](../evidence/ui-resize-fix/chromium/ui-resize.json) and
[WebKit](../evidence/ui-resize-fix/webkit/ui-resize.json) pass 16/16 checks.
The airborne climber remains visible, charging and attempt identity survive
rotation, no synthetic fall is emitted, dialogs remain isolated, and the
fine-pointer desktop layout still hides touch controls.

Captures:

- [Coarse-pointer landscape](../evidence/ui-resize-fix/chromium/touch-landscape.png)
- [Guide after two rotations](../evidence/ui-resize-fix/chromium/guide-portrait-after-resize.png)

The post-fix world-bound report still contains 320, 375, and 480 px mobile
views at the reliquary wall planes while preserving the 758 px desktop outer
edge. The 152 tests, type-check, lint, build, Chromium/WebKit runtime smokes,
mobile readability, accessibility, and route-overlay suites pass.

## Residual risk

The browser harness changes viewport dimensions in one page rather than
receiving a physical-device orientation event. It covers the same resize,
layout, Phaser scale, camera, input, and dialog paths, but final device
acceptance should still include one real iOS Safari and Android Chrome rotation
check.
