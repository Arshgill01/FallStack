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

## Remaining UI gate

QR-011 is closed. Workstream G is not: contrast sampling, focus trap/restore,
temporary-message landing occlusion, long/edge copy, orientation/resize, and
all error/capped/stale states still require a complete interaction audit.
