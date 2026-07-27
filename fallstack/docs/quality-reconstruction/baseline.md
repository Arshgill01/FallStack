# Gate 1 baseline and issue census

## Provenance

This is the authoritative quality-reconstruction baseline for commit
`7c4e06f`. It was recaptured on the current Mac from a detached local worktree,
not inferred from the fixed `master` branch:

1. build `7c4e06f` with the repository's locked dependencies;
2. serve its production `dist/client` at `http://127.0.0.1:8082`;
3. run the current read-only baseline harness against that URL;
4. label every state as pre-input, real input, or QA-positioned.

The complete machine-readable manifest is
[`baseline-matrix.json`](evidence/gate-1-baseline/baseline-matrix.json). It
reports zero page errors and zero unexpected console errors. Expected static
server `/api` 404s resolve through the production local-practice fallback.

## State matrix

| Surface or state | Viewport | Method | Evidence |
| --- | --- | --- | --- |
| Inline splash | 375×500 | Pre-input | [Mobile splash](evidence/gate-1-baseline/splash-mobile.png) |
| Inline splash | 1280×500 | Pre-input | [Desktop splash](evidence/gate-1-baseline/splash-desktop.png) |
| Expanded opening | 320×568 | Pre-input | [320 opening](evidence/gate-1-baseline/expanded-pre-input-320x568.png) |
| Expanded opening | 375×812 | Pre-input | [375 opening](evidence/gate-1-baseline/expanded-pre-input-375x812.png) |
| Expanded opening | 1280×800 | Pre-input | [Desktop opening](evidence/gate-1-baseline/expanded-pre-input-1280x800.png) |
| Expanded opening | 1920×1080 | Pre-input | [Fullscreen opening](evidence/gate-1-baseline/expanded-fullscreen-1920x1080.png) |
| Charge at 60% | 375×812 | Real keyboard input | [Charge](evidence/gate-1-baseline/actual-charge.png) |
| Launch | 375×812 | Real keyboard input | [Launch](evidence/gate-1-baseline/actual-launch.png) |
| Landing contact | 375×812 | QA-positioned short drop through production collision | [Landing](evidence/gate-1-baseline/landing-contact.png) |
| Fall | 375×812 | Real keyboard input | [Fall](evidence/gate-1-baseline/actual-fall.png) |
| Mutation receipt | 375×812 | Real fall and local-practice mutation | [Receipt](evidence/gate-1-baseline/mutation-receipt.png) |
| Grounded respawn | 375×812 | Real fall and production respawn | [Respawn](evidence/gate-1-baseline/grounded-respawn.png) |
| Checkpoint feedback | 375×812 | QA-authored clear event through production handler | [Checkpoint](evidence/gate-1-baseline/checkpoint-feedback.png) |
| Lower Ruins | 375×812 | QA-positioned checkpoint | [Lower Ruins](evidence/gate-1-baseline/biome-lower-ruins.png) |
| Bell Shaft | 375×812 | QA-positioned checkpoint | [Bell Shaft](evidence/gate-1-baseline/biome-bell-shaft.png) |
| Moon Roof | 375×812 | QA-positioned checkpoint | [Moon Roof](evidence/gate-1-baseline/biome-moon-roof.png) |
| Summit result | 375×812 | QA invocation of production summit handler | [Summit result](evidence/gate-1-baseline/summit-result.png) |
| Guide | 375×812 | Browser click | [Guide](evidence/gate-1-baseline/guide-mobile.png) |
| Tower Memory | 375×812 | Browser click | [Tower Memory](evidence/gate-1-baseline/tower-memory-mobile.png) |
| Reduced motion | 375×812 | Browser media preference at load | [Reduced motion](evidence/gate-1-baseline/expanded-reduced-motion-375x812.png) |

QA-positioned frames prove presentation only. The baseline's real complete
local-practice climb remains the
[`full-playthrough-07-final`](../qa/final-pass/full-playthrough-07-final/)
production-browser report: opening, every zone, and summit. The mocked
two-client baseline is
[`shared-session-06-final`](../qa/final-pass/shared-session-06-final/).
Authenticated Reddit/Safari evidence is security-consciously recorded in
[`host.md`](host.md); profile or session data was not copied into the
repository.

## Direct baseline defects

The detached build reproduced three red contracts:

- Mobile physics used x=`0…480` while the painted reliquary cavity used
  x=`34…446`. All twelve mobile containment assertions failed at 320, 375, and
  480 px. Desktop correctly retained x=`0…758`. See the
  [red bounds report](evidence/gate-1-baseline/world-bounds-red/world-bounds.json).
- Every untouched pre-input game emitted one `fallstack:land`. One real fall
  and respawn raised the count from one to two without a new airborne landing.
  These event counts are embedded beside each frame in
  [`baseline-matrix.json`](evidence/gate-1-baseline/baseline-matrix.json).
- The 13 px functional-text contract failed 36 times across 320×568 and
  375×812. Several prominent labels measured 7.5–12 px. See the
  [red readability report](evidence/gate-1-baseline/ui-readability-red/ui-readability.json).

Specialised probes then confirmed the remaining systemic defects indexed in
[`status.md`](status.md): audio lifecycle and ownership, landing semantics,
camera target visibility, replay-controller authority, modal input isolation,
dialog accessibility, recovery-overlay occlusion, rotation continuity, and the
rejected character state set. Each reproducible ledger entry has its own
`issues/ISSUE-NNN.md` record.

## Visual score

The exact baseline scores **88/100** with the established weighted Fallstack
scorecard:

| Criterion | Weight | Score | Weighted |
| --- | ---: | ---: | ---: |
| Shared-mutation comprehension in 10 seconds | 20 | 5/5 | 20 |
| Tower dominance and scene composition | 15 | 5/5 | 15 |
| Tactile material identity and depth | 15 | 4/5 | 12 |
| Artifact and collision readability | 15 | 4/5 | 12 |
| Opening jump and first-fall feedback | 15 | 5/5 | 15 |
| Mobile controls and accessibility | 10 | 3/5 | 6 |
| System coherence | 5 | 4/5 | 4 |
| Implementation and runtime cost | 5 | 4/5 | 4 |

The baseline clears the aggregate visual threshold, but that does not average
away the mobile boundary/readability defects or approve its rejected character.
Audio and character are deliberately assessed in
[`audio.md`](audio.md) and [`character.md`](character.md), not hidden inside
this visual score.

## Census disposition

- QR-001–002 and QR-005–017 have verified fixes and dedicated regressions.
- QR-003 has a browser-verified tactile SFX implementation; current-Mac human
  listening remains open.
- QR-004 has three technically matched original directions; user selection,
  production integration, and in-context listening remain open.
- No observed defect is left as an undocumented or silently dismissed item.

This closes the missing Gate 1 baseline/census artifact. It does not close the
quality reconstruction: music selection and human listening remain explicit
acceptance gates.
