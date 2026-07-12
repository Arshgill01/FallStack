# Cutaway Reliquary art bible

Status: implementation contract for the selected `Cutaway Reliquary v2` direction. Figma frame `2:88` is the composition source; this document governs production decisions when a mockup detail is ambiguous.

## 1. Read order and values

The first mobile viewport must read in this order:

1. **A damaged tower already shaped by the community.** The reliquary frame and one labeled artifact are visible before input.
2. **A physical opening jump.** Player, takeoff edge, relevant artifact, and landing edge form one unobstructed diagonal.
3. **The consequence.** A stamped label states why the artifact exists; after a fall, a persimmon plaque states what changed.
4. **The controls.** Fixed controls are reachable but visually subordinate to the tower.

The world is compact, tactile, cursed, and legible. It is not parchment UI laid over a platformer. Every UI surface should appear built into, pinned onto, or resting beneath the same reliquary.

## 2. Color and value system

Use opaque colors for collision edges and body copy. Transparency is reserved for depth, spectral objects, and short-lived effects.

| Token | Value | Production role |
| --- | --- | --- |
| `washi-50` | `#F4EFE2` | Primary light field, plaques, control faces |
| `washi-200` | `#D8CDB7` | Worn rims, disabled controls, secondary rules |
| `ink-950` | `#180D18` | Primary text on light surfaces, deepest linework |
| `indigo-950` | `#171426` | Outer frame, deepest shadow, desktop surround |
| `indigo-800` | `#29243F` | Structural faces and piers |
| `indigo-650` | `#45405F` | Lit stone/lacquer faces and control borders |
| `burgundy-950` | `#2B111D` | Tower cavity and far recess |
| `burgundy-750` | `#592337` | Cursed underfaces, near recesses |
| `persimmon-500` | `#E95F45` | Mutation feedback, charge accent, primary CTA |
| `persimmon-750` | `#8E302B` | Persimmon shadow/outline and hazard support |
| `gold-400` | `#D9B45C` | Bindings, Mercy Nail, checkpoint, restrained relic detail |
| `gold-700` | `#75552A` | Gold outline and aged metal shadow |
| `ghost-200` | `#BDE5D9` | Spectral surface fill and focus support |
| `ghost-650` | `#397A70` | Spectral edge and secondary success state |
| `danger-300` | `#F29A73` | Hazard glint used with teeth/cracks, never alone |

Contrast rules:

- Body text uses `ink-950` on `washi-50`, or `washi-50` on `indigo-950`/`burgundy-950`.
- `gold-400`, `ghost-200`, and `persimmon-500` are accents, not small body-text colors on washi.
- Any small colored label keeps an `ink-950` or `indigo-950` text/outline pair. Never place small persimmon type directly on washi.
- Focus uses a 3 px `ghost-200` outer ring plus a 1 px `ink-950` separation line. It must remain visible over both light and dark surfaces.
- Spectral objects may use 54–68% fill opacity, but their collision edge is a continuous 2 px `ghost-200` line at 90–100% opacity.
- Background dressing stays within 12–32% opacity. Foreground damage marks stay within 45–70% and never cross a playable top edge.

## 3. Material grammar

### Reliquary frame

- Outer frame: indigo-black lacquered timber/stone, 12–16 px mobile thickness, with a continuous silhouette.
- Washi rim: 5–8 px inset band, slightly irregular only on the non-playable edge. It does not resemble a large paper card.
- Inner rim: 3 px dark keyline separating architecture from cavity.
- Cavity: burgundy-black recess with large architectural shapes, not a gradient void or star field.
- Joinery: restrained gold pins/bindings at major corners and checkpoints only. Maximum three bright gold clusters in one viewport.

### Architecture and platforms

- Lit top surface is 5–8 px deep at mobile scale and always the highest-value edge on a solid platform.
- Underfaces are 14–28 px deep. Primary route ledges use the thicker end of the range; tiny helpers remain thin.
- A platform has one dominant damage event: chipped termination, split underface, or repaired binding. Do not noise every edge.
- Top collision edges remain straight for at least 70% of their usable span. Decorative chips never change collision truth.
- Left and right terminations differ by 4–10 px and have a visible end cap so floating rectangles do not survive into production.
- Vertical piers and arches support route rhythm but remain at least 10 px away from a collision edge unless they are the wall used by physics.

### Zone variation

All zones share the same palette and movement grammar.

- **Lower Ruins:** broad broken lintels, squat piers, more washi repairs; lowest silhouette density.
- **Bell Shaft:** tall narrow arches, hanging bindings, stronger vertical voids; no simulated swinging collision.
- **Moon Roof:** exposed roof teeth, thinner supports, colder ghost light, more repaired cursed underfaces.

Change architectural density, damage, and light—not the entire palette.

## 4. Collision silhouette system

Shape is authoritative before color. Decorative art never determines the physics body.

| Object | Collision meaning | Required silhouette | State change |
| --- | --- | --- | --- |
| Default platform | Solid | Broad horizontal cap, continuous light top edge, thick dark underface | Checkpoint adds central gold binding and a small upward pennant notch |
| Corpse Stack | Solid foothold | Three offset bundled slabs/bodies forming a low stepped wedge; flat usable crown | Upgraded state adds one bound top slab and increases apparent stability, not gore |
| Mercy Nail | Solid, very narrow | One oversized horizontal peg driven from a wall, round head at wall and bright flat tip | Active/upgraded state gains a second wrap and a tiny hanging tag; width truth remains obvious |
| Ghost Platform | Semi-solid | Thin crescent/bridge with two downward wisps and open underside; no block underface | Weak state has one broken gap in the glow, active state has continuous top edge |
| Cursed Brick | Solid with timing hazard | Heavy shelf with downward teeth, split underface, and one offset loose segment | Warning state exposes orange cracks/teeth; active wobble never moves collision more than the existing code allows |
| Lantern Trail | Visual only | Three to five suspended lantern sparks along an arc; never a continuous top edge | Active trail brightens in sequence; reduced motion shows the full dotted arc statically |

Minimum mobile distinction:

- Corpse Stack crown: at least 44 px wide.
- Mercy Nail usable tip: 18–28 px wide and visually isolated from nearby platforms.
- Ghost Platform: at least 52 px wide with an open underside.
- Cursed Brick teeth/cracks: at least 6 px high and visible at 1× capture.
- Lantern Trail marks: separated by at least 10 px so they cannot read as a platform.

Artifact labels name aggregate behavior, not players. Failures remain anonymous.

## 5. Player contract

The player is a small climber/relic bearer, not a mascot. At the 375 px composition the visible silhouette is 22–26 px wide and 34–40 px tall.

- Body: one dark indigo mass with washi face/hand notch.
- Accent: one persimmon scarf or waist binding, never more than 25% of silhouette area.
- Head-to-body ratio: approximately 2:3; feet remain separate enough to read grounded state.
- No fine facial features at gameplay scale.

Required poses:

- **Grounded:** low center, two contact points, scarf resting toward last movement direction.
- **Charge:** body compresses 12–16%, feet widen, persimmon binding tightens/brightens; a three-notch charge mark may appear beneath, not above, the player.
- **Airborne:** body extends, feet leave a clear gap, scarf opposes travel direction.
- **Land:** 80–120 ms compression plus one dust stamp; no camera shake for routine landings.
- **Fall:** limbs/scarf open into a wider unmistakable silhouette; rotation is capped at 12° per visual beat.
- **Respawn:** player returns as a 140–180 ms washi stamp-in, with state already reset by existing game logic.

Reduced motion replaces squash, rotation, scarf lag, and particles with pose swaps and opacity cuts.

## 6. Typography and copy

- Display/title: **Shippori Mincho**, 700–800 weight. Mobile title 25–30 px; desktop 30–38 px.
- Zone/checkpoint: Shippori Mincho 700, 16–20 px mobile.
- UI, status, controls, labels: **Zen Maru Gothic**, 600–800.
- Body/status mobile minimum: 13 px at 1.35 line height.
- In-world artifact label minimum: 12 px at 1.25 line height; preferred 13 px.
- Control glyph/word: 15–17 px bold.
- Result body minimum: 14 px.

Copy constraints:

- Artifact label: maximum 38 characters or two lines; preferred formula is count + cause + object.
- Feedback plaque: maximum 72 characters or three compact lines. Lead with the concrete change.
- Status seal: maximum two numeric facts and one zone state.
- Checkpoint banner: maximum 56 characters; it disappears without blocking input.
- No all-caps sentence copy. Stamps may use 2–16 uppercase characters for short states such as `HAUNTED`.
- Dry, concrete, mildly cursed. No lore paragraph, tutorial wall, fake comment, or personal failure blame.

## 7. In-world labels

- Labels attach to an object with a 1–2 px pin, stitch, or short leader no longer than 18 px.
- Place labels above or beside the artifact, never on its collision surface or the opening-jump flight corridor.
- Mobile width: 104–148 px. Desktop width: 120–176 px. Internal padding: 7 px horizontal, 5 px vertical.
- Keep 8 px from the inner reliquary rim, 10 px from the player start, and 14 px from touch-control safe area.
- At most two artifact labels are simultaneously prominent in a mobile viewport. Other visible artifacts use a stamped count glyph until camera focus makes their label relevant.
- Labels use washi fill, dark 2 px keyline, one clipped/chipped corner, and a 3–5 px hard under-shadow. They do not use floating rounded cards.
- If placement cannot avoid route geometry, prefer a shorter label or edge-pinned tag; never cover a landing.

## 8. Composition, scale, and responsive behavior

### Mobile master: 375×812

- Outer page gutter: 12 px.
- Top status band: 58–68 px. Title occupies at most 210 px; status seal occupies at most 118 px. Maintain a 12 px gap—this is the explicit overlap fix.
- Reliquary playfield begins below the status band and remains the dominant surface. Target visible width: 351 px.
- Inner playable cavity keeps 16–20 px side architecture plus a minimum 255 px clear route field.
- Fixed bottom control safe area: 104–122 px including safe-area inset. Critical landings and the player cannot be framed beneath it.
- Controls: minimum 56×56 px for left/right and 72×56 px for Jump, with at least 10 px separation.
- Opening player anchor: 62–70% of usable playfield height, leaving more space above than below.
- Camera upward lookahead: 38–46% of usable playfield height. Horizontal bias may shift no more than 28 px and may not hide the takeoff edge.

### Narrow mobile: 320–374 px

- Keep 10 px outer gutter, 52 px controls, 11 px labels, and the full tower route.
- Collapse secondary status prose into a stamped count; do not scale the playfield below legibility.

### Desktop: 1280×800

- The reliquary expands to 520–640 px wide and 720–760 px high; it is not a centered phone mockup.
- Place title/status in the top architecture. Use the remaining width for atmospheric continuation of the frame, not dashboards or card rails.
- Controls copy may sit on the bottom plinth; touch controls hide only when pointer/viewport rules already establish keyboard use.
- Preserve the same camera scale relationship: the player and collision edges may grow up to 1.2× mobile apparent size, never shrink.

### Large/fullscreen

- Cap the playable cutaway at 720 px wide. Extend piers, shadows, and cavity beyond it while maintaining the same route scale.
- No full-tower zoom-out during active play. Results may reveal more architecture but not tiny gameplay.

## 9. Depth, light, and occlusion

One light direction: upper left, approximately 35°. Use hard tactile shadows, not ambient glow.

Depth stack from back to front:

1. Desktop/page surround.
2. Far cavity motifs at 12–20% opacity; optional parallax 0–2 px.
3. Structural rear arches at 28–45%; optional parallax 2–4 px.
4. Playable platforms/artifacts/player at full contrast.
5. Inner rim and near piers; may overlap non-playable underfaces by at most 8 px.
6. Labels/feedback attached to architecture.
7. Touch controls on the bottom plinth.

No foreground element may cover a playable top edge, artifact state marker, player silhouette, or predicted opening-jump corridor. Shadows use 0 px blur for small objects and no more than 8 px blur for the outer frame.

## 10. Motion vocabulary

| Event | Standard motion | Reduced-motion substitute |
| --- | --- | --- |
| Charge | 120 ms compression into held pose; three discrete notches; no loop beyond held tension | Static compressed pose and notch color/value changes |
| Leap | 90 ms release stretch plus one scarf snap | Immediate airborne pose |
| Land | 80–120 ms squash, 2–4 dust flecks | Grounded pose plus 60 ms value flash |
| Fall recorded | 160 ms plaque stamp with 2 px overshoot; artifact state crossfade 180 ms | Plaque appears instantly; state swaps after a 100 ms hold |
| Cursed warning | 2–3° irregular tilt or 2 px displacement for 240 ms, only near interaction | Static teeth/crack highlight |
| Ghost active | 1.5–2.2 s opacity drift within 54–68%, maximum 2 px vertical drift | Fixed 62% fill with solid collision edge |
| Lantern trail | 80 ms stagger along route, once per reveal | All marks appear together |
| Checkpoint | 220 ms gold binding draw plus 400 ms camera settle | Static binding; immediate camera framing |
| Result | 240 ms architectural shutter/opening | Direct state change |

Use ease-out cubic for arrivals and ease-in cubic for falls. Avoid elastic/bouncy easing. Simultaneous priorities are: safety/input state, fall mutation, checkpoint, artifact ambience, decoration. Lower-priority motion pauses when a higher-priority event plays.

Reduced-motion mode disables parallax, camera shake, idle oscillation, looping particles, decorative flicker, scarf lag, and large transforms. It preserves state via silhouette, value, labels, and short opacity cuts.

## 11. Audio vocabulary

Reuse the existing compact sound system; do not add a music dependency for this pass.

- Charge: dry wood/rope tension with three pitch steps; maximum 450 ms loopless layers.
- Leap: one short cloth snap plus low wooden release.
- Land: material-weighted knock; routine land is quieter than mutation/checkpoint.
- Fall recorded: muted body drop followed by a single persimmon stamp/clack.
- Curse: two detuned ceramic ticks, under 300 ms; no horror sting.
- Checkpoint: one clear brass binding note plus a dry latch.
- Result/summit: three-note restrained brass/wood cadence, under 1.2 s.

Audio priorities match motion priorities. Respect the existing mute state. Do not encode collision meaning only in audio.

## 12. Accessibility and input

- Interactive targets are at least 44 CSS px; primary mobile controls meet the larger sizes above.
- Focus is always visible and not clipped by frame shadows or overflow.
- Control pressed state changes position (2–3 px), outline weight, and value—not color alone.
- Every artifact has the silhouette rules in section 4 plus concise text when focused/relevant.
- Hazard animation is supplemental; teeth, cracks, and offset geometry remain visible when motion is off.
- Text is never baked into image assets. Dynamic counts, zone names, and usernames remain DOM/Phaser text.
- Status and mutation announcements use the existing accessible DOM path; canvas decoration must not become the sole source of feedback.
- Do not use rapid flashes, persistent shake, or more than three high-contrast state changes per second.
- Touch controls remain fixed during gameplay and support hold/release without browser gestures stealing input.

## 13. Feedback and overlay hierarchy

- **Top status seal:** passive daily state only; never expands into a dashboard.
- **In-world label:** origin and local consequence of the nearest important artifact.
- **Persimmon fall plaque:** appears below the critical jump or on the bottom plinth, never centered over play. It persists long enough to read and yields to immediate input.
- **Checkpoint banner:** attached across the next architectural threshold, with the route still visible.
- **Result overlay:** the reliquary closes around a single community story. It may contain result facts and one primary action, not stacked cards.
- **Loading/error:** preserve the frame and show one plain stamped message plus retry/continue-local action. Never display a blank cavity or generic spinner card.

## 14. Asset and Phaser contract

- Source names and runtime keys are lowercase kebab-case.
- Runtime art uses transparent WebP or PNG at 2× logical density. Keep SVG as source unless the Phaser proof demonstrates consistent rasterization.
- Platform family source modules fit a 256×128 px 2× cell; artifacts fit 192×128 px; player poses fit 96×96 px. Atlas padding is at least 4 transparent pixels at export density.
- Use premultiplied-alpha-safe cleanup: no light matte fringe, no opaque provider background, no semitransparent pixels outside intended glow.
- Pixel art filtering is forbidden. Use smooth filtering at integer-ish camera scales and validate at 1× screenshots.
- Collision bodies come from existing tower/artifact data. Each renderer exposes a documented visual-top inset so the art aligns to the body; art never generates bodies.
- Every adopted asset records source/provider, prompt/version, rights, cleanup, export size, final filename, and checksum in the future asset manifest.
- Procedural fallback must reproduce silhouette and state meaning even if texture assets fail.

Initial budgets to prove in M3:

- Art proof payload: no more than 750 kB compressed for frame, one platform family, five artifact silhouettes, and player state family.
- Full new runtime visual payload target: no more than 1.75 MB compressed without a documented scorecard benefit.
- No individual 2D texture above 2048×2048; prefer one or two compact atlases.
- Decorative particles are capped at 24 live mobile / 48 desktop, and zero looping decorative particles in reduced motion.

## 15. Forbidden patterns

- Left or side dashboard rail.
- Status cards floating over the tower.
- Pasted labels without a pin, stitch, engraving, or architectural attachment.
- Flat programmer rectangles as final platforms.
- Rounded-card stacks, fake parchment sheets, or generic SaaS panels.
- Full-bleed neon gradients, generic pixel fantasy, star-field space backdrop, or Reddit/Snoo identity.
- Color-only collision semantics.
- Decorative chips that imply false collision edges.
- Generated text, usernames, counters, or labels baked into art.
- Gore-heavy Corpse Stack imagery or named blame for failures.
- More than one unrelated palette per zone.
- Tutorial arrows when route silhouette already communicates the climb.
- Foreground decoration crossing the opening jump.
- Looping motion used merely to make the screen feel busy.
- Desktop layouts that shrink the game into a phone or surround it with analytics.

## 16. Required design-state matrix

Before M1 exits, Figma must contain mobile frames for:

1. Pre-input seeded mutation.
2. Charge at the opening jump.
3. Airborne over the opening jump.
4. First-fall feedback.
5. Respawn with incremented mutation.
6. Checkpoint reached.
7. Cursed shelf active.
8. Result overlay.

It must also contain a 1280×800 desktop adaptation of the pre-input state and a desktop gameplay/feedback state. Each frame uses the same route geometry and demonstrates that overlays do not cover collision-critical information.

