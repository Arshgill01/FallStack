# UI, guidance, and feedback record

## QR-011 — mobile readability

The production baseline kept the shell inside 320×568 and 375×812 by shrinking
important text below the selected Cutaway Reliquary type contract. The smallest
labels were the `7.5 px` community status and `8 px` Guide/Memory actions.
Guide body copy was `11 px`; Tower Memory body copy was `10–11.5 px`.

The red browser pass measured the actual production build and captured the game,
Guide, and Tower Memory at both viewports. It failed every representative
functional/body/status threshold while confirming that the sheets already had
working vertical scroll containers.

## Responsive correction

- Mobile body, status, actions, and Guide copy are at least `13 px`.
- Tower Memory body copy is `14 px`.
- Zone identity is `16 px`; Jump is `15 px`.
- Guide audio toggles grow to a 44 px touch height.
- The 320–374 px header uses the art bible's compact-secondary-status rule:
  it shows `Falls`, while the complete community wording remains in the tally's
  accessible label.
- The 375 px header keeps `Community falls`.
- Desktop/fullscreen styles are unchanged because the correction is contained
  by the existing `599 px` mobile breakpoint.

## Evidence

The committed
[`ui-readability.json`](evidence/ui-readability-fix/ui-readability.json)
reports zero failures at 320×568 and 375×812:

| Contract | 320×568 | 375×812 |
| --- | ---: | ---: |
| Top status band | 66 px | 67 px |
| Brand/status/actions overlap | None | None |
| Game functional text | 13–16 px | 13–16 px |
| Guide body/toggles | 13 px | 13 px |
| Tower Memory body | 14 px | 14 px |
| Representative action height | 44–52 px | 44–52 px |

Before/after diagnosis and the six production screenshots are indexed in
[`ISSUE-011`](issues/ISSUE-011.md).

## QR-014 — modal gameplay isolation

Guide and Tower Memory visually covered the game and disabled touch controls,
but Phaser continued reading raw cursor and Space keys. A production red run
launched the player behind the 375×812 Guide and produced a hidden desktop fall.

Both dialogs now pause the whole scene, reset shared and Phaser input, cancel a
planted charge without launching, and resume cleanly after close. The
[Chromium](evidence/ui-accessibility-fix/chromium/ui-accessibility.json) and
[WebKit](evidence/ui-accessibility-fix/webkit/ui-accessibility.json) reports
show zero position, attempt, charge, launch, and fall deltas for both dialogs at
375×812 and 1280×800. Details are in
[`ISSUE-014`](issues/ISSUE-014.md).

## QR-015 — browser and dialog accessibility

The same production audit reproduced disabled browser zoom, incomplete focus
containment, an unassociated Tower Memory heading, absent theme metadata, and
2.51:1 contrast on the primary modal action.

Zoom is available again while the three hold controls retain direct touch
ownership. Both dialog focus loops are explicit in Chromium and WebKit, Tower
Memory references its visible title, and the action contrast is now 6.93:1.
Each browser passes 48 checks at mobile and desktop presentation sizes. Details
and screenshots are in [`ISSUE-015`](issues/ISSUE-015.md).

## QR-016 — recovery-message occlusion

At 320×568, a long mutation receipt covered the next required landing from the
final checkpoint. A simultaneous remote beat extended over the player at every
sampled recovery, while receipt body text remained at 9 px and its highlighted
counter measured 2.96:1 contrast.

The short/narrow receipt now occupies 91.5 px, preserves a 13 px explanation,
and uses 10.63:1 counter contrast. The constrained layout does not show a remote
beat underneath a local receipt. The route-aware
[`ui-overlays.json`](evidence/ui-overlays-fix/ui-overlays.json) passes 266
checks across five notice states, two viewports, and every start/checkpoint
recovery with zero player, target, notice, or viewport overlap. Details are in
[`ISSUE-016`](issues/ISSUE-016.md).

## QR-017 — mobile orientation continuity

Rotating a coarse-pointer phone to 812×375 crossed the width-only desktop
breakpoint, removed all touch controls, and showed the keyboard hint. Once the
controls were restored, the short wide camera's fixed 260 px bottom padding
also proved taller than the 254 px game viewport and could place an airborne
climber above the canvas.

Input visibility now follows pointer capability, while the existing wide header
layout remains width-based. Camera padding retains its original tall-screen
targets but is capped to 60% of the live viewport height on short screens.
[Chromium](evidence/ui-resize-fix/chromium/ui-resize.json) and
[WebKit](evidence/ui-resize-fix/webkit/ui-resize.json) each pass 16 checks
through grounded, charging, airborne, dialog, and fine-pointer desktop states.
Horizontal desktop/fullscreen physics edges are unchanged. Details are in
[`ISSUE-017`](issues/ISSUE-017.md).

## Remaining UI gate

QR-011 and QR-014–017 are closed. Workstream G is not: exhaustive contrast
sampling beyond the audited primary/receipt actions and live server-backed
error/capped/stale states still require a complete interaction audit.
