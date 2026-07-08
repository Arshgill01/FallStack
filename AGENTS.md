# AGENTS.md



## Read First

Before planning or editing, read:

1. `PRODUCT.md` — thesis, brand, principles.
2. `fallstack_concept_log.md` — settled grill decisions (§1–§38). The "Settled Grill Decisions" section is canonical. Sections below it labeled "Superseded" are historical context only.
3. `fallstack-mockup(3).html` — working analog-charge prototype with physics, zones, mutation logic, and washi/indigo/persimmon visual exploration.
4. `fallstack-mockup(4).html` — variant with 3-tier jump (superseded by analog decision, but UI polish and tier-pip feedback are reference-worthy).
5. This file.

If a future directory has its own `AGENTS.md`, follow that more local file for work inside that directory.

## Product Thesis

Fallstack is a shared community mutation game expressed through a compact precision climber, not primarily "a hard climbing game."

Everyone climbs the same daily tower. Failed jumps aggregate into readable artifacts. Clean clears stabilize cursed zones. The tower becomes subreddit memory.

Every feature must strengthen at least one of:

- visible shared mutation
- physical climb feel
- daily return anticipation
- Reddit-native community discussion
- mobile-first polish
- Devvit platform feedback evidence

If a feature only makes the solo platformer larger, it is secondary. If a judge plays 10 seconds and summarizes it only as a platformer, the implementation has failed.

## Current State

The project is pre-implementation. What exists:

- **Two working HTML mockups** with canvas rendering, Jump King-style physics, 3-zone tower, artifact derivation, mutation banners, checkpoint flow, result card, and mobile controls. These contain real physics constants, zone layouts, and artifact threshold logic worth extracting, not rewriting from scratch.
- **Concept log** with 38 settled grill decisions covering the entire game design.
- **PRODUCT.md** with positioning and brand.

What's next: Devvit Web Phaser scaffold, first playable with real persistence.

## Priority Stack

Ordered by judging impact. Work top-down:

1. **First 10 seconds** — the judging gate.
2. **Core gameplay loop** — controls, fall, mutation feedback.
3. **Shared mutation model** — the hook that separates this from a generic platformer.
4. **Mobile controls** — quality gate for judging.
5. **Seeded demo state** — submission requirement.
6. **Daily result card** — retention story and social material.
7. **Tower content** — chunk design, theme variety.
8. **Sound** — jump, land, fall, mutation, ambient.
9. **Feedback log** — parallel deliverable.
10. **App listing & demo video** — submission packaging.

## Hackathon Target

Target: Reddit's Games with a Hook Hackathon.

Requirements:

- Build on Devvit Web using Interactive Posts.
- Submit an app listing on developer.reddit.com.
- Submit a public demo post running the game (leave to human if needed).
- Demo must be self-explanatory — judging primarily evaluates the demo post.

Judging lens:

- **Delightful UX**: exciting, easy to understand, fun to uncover.
- **Polish**: close to publishable, Devvit-compliant, strong mobile experience.
- **Reddit-y**: community-minded, identity-driven, not on-the-nose Reddit theming. *Critical.*
- **Hook-y**: strong reason to return regularly. *Critical.*
- **Phaser Innovation**: if Phaser is used meaningfully.

Prize targets:

- Primary: place strongly enough for honorable mention or better. The concept is strong — execution on Reddit-y and Hook-y determines placement.
- Secondary: Best Use of Retention Mechanics, Best Use of User Contributions, Best Use of Phaser.
- Parallel (equally important): Feedback Awards — based on high-quality Developer Platform feedback.

## First 10 Seconds

The opening beat must prove the hook without a tutorial wall:

- Show a headline: "Today's tower has 37 failed climbs in it."
- Put 2–3 readable artifacts in the starting zone.
- Label one artifact with origin text: "14 falls made this foothold."
- Start the player near a jump where an artifact clearly matters.
- After the first fall, show concrete feedback: "Your fall added +1 to Moon Shelf. 2 more falls will spawn a Mercy Nail."
- Controls hint stays compact: "Arrows move · Hold Space · Release to leap."
- The first screen must show that today's tower has already been changed by community play.
- The first attempt must feel physical within seconds.
- The first fall or clear must visibly affect zone state.

## Core Gameplay

### Controls

Desktop: Left/Right Arrow keys to move or face direction. Hold Space to charge. Release Space to jump. Arrows nudge the arc mid-flight (not full air control — a light corrective steer, not a direction override).

Mobile: fixed Left, Jump, Right buttons at the bottom. Hold Jump to charge, release to leap. Arrows nudge mid-flight. Buttons must be large enough for thumbs and must not obscure the tower during critical jumps.

No drag aiming. No mouse placement. No manual artifact placement. No builder or planner mode.

### Jump Model

Analog charge. Hold duration maps to a continuous power curve (short hold = small hop, long hold = full leap). This is the model from `fallstack-mockup(3).html`.

Physics reference from the working mockup:

- Gravity: 1550
- Min power (tap): 32% → vy ≈ -560, vx ≈ 170
- Max power (full charge ~900ms): 100% → vy ≈ -1000, vx ≈ 400
- Air steering accel: 420–950 (tune to feel — lighter = more commitment)
- Air max vx clamp: 340–420

These are starting values. Tune for the "first checkpoint in 60–90 seconds" target.

### Fall & Respawn

- A run is one climb attempt until the player falls below the current zone's safe recovery line.
- Minor bonks do not end the run.
- Falling records a mutation in the failure zone and respawns at the latest checkpoint.
- Full reset to floor zero is not the default.

### Checkpoints

- Reaching a zone's upper boundary locks the player's respawn to the next zone's floor.
- A clear contributes `+1 successfulClear` to the cleared zone (subject to caps).
- If enough clears exist, the zone downgrades its curse or stabilizes.
- A compact checkpoint banner appears: "Lower Ruins stabilized by 3 clean climbs. Next: Bell Shaft, currently Haunted."
- Camera settles upward to preview the next zone.
- Player can continue immediately — no menu gate.

### Success & Stabilization

- Successful clears increment zone clear counters.
- 3 clears after a curse: downgrade Cursed → Haunted.
- 6 clears: stabilize the route for the rest of the day.
- Stabilized artifacts become safer but remain visible as history.
- Positive achievements name users; failures stay aggregate or anonymous.

## Shared Mutation Model

Design invariant: **failure should help, but accumulated failure should distort.**

Full rationale: `fallstack_concept_log.md` §2, §7–§9.

### Failure Buckets (4)

| Bucket | Trigger | Artifact |
|---|---|---|
| `short_jump` | Undershoot a gap | Corpse Stack → Mercy Nail |
| `overjump` | Overshoot past the landing | Cursed Brick |
| `wall_bonk` | Hit a wall face mid-air | Ghost Platform |
| `helper_overuse` | Fall within 4s of landing on a helper artifact | Cursed helper variant |

Detection: `wall_bonk` if the player hit a side wall during the jump. `overjump` if charge power > 82%. `helper_overuse` if standing on a corpse_stack or mercy_nail for < 4s before falling. Default: `short_jump`.

### Artifacts (5)

| Artifact | Collision | Visual Signal |
|---|---|---|
| Corpse Stack | Solid foothold | Chunky, stacked, stamped origin label |
| Mercy Nail | Solid, narrow ledge | Small peg, visually distinct from full platforms |
| Ghost Platform | Semi-solid or temporary | Translucent, fading, limited-use feel |
| Cursed Brick | Solid with timing hazard (wobble/crumble delay) | Cracked, shaky, visually dangerous |
| Lantern Trail | Visual-only, no collision | Faint arc or glow showing a successful route |

Every artifact must communicate its collision semantics **before contact** through shape, not just color.

### Thresholds

Per zone, per failure bucket:

- **1 fall**: faint local mark (player-only feedback).
- **3 matching failures**: visible community artifact spawns.
- **6 matching failures**: artifact upgrades.
- **10 matching failures**: zone becomes Haunted or Cursed.
- **3 successful clears after a curse**: downgrade or stabilize.

### Per-Zone Caps

- 1 helpful artifact.
- 1 cursed/hazard artifact.
- 1 route hint or ghost arc.
- 1 zone state badge (Quiet / Haunted / Cursed / Reinforced / Stabilized).

Do not store every fall as an object. Store aggregated counters, derive artifacts from thresholds.

### Anti-Griefing Contribution Caps

- A player can attempt the tower unlimited times.
- Only the first **3 matching failure contributions per user per zone per day** count toward shared mutation.
- Only the first **10 total failure contributions per user per day** count globally.
- Successful clears and stabilizations also cap per zone.
- Local feedback still appears after the cap: "Your fall was noticed, but this zone has heard enough from you today."

## Tower Design

Finite daily tower with a summit. Hybrid procedural generation, chunk-first.

Full rationale: `fallstack_concept_log.md`.

- Hand-designed chunks define intended jump patterns.
- Generator stitches compatible chunks by seed, theme, difficulty, and connectors.
- Small variation affects ledge widths, decoration, artifact slots, hazard state, or theme dressing.
- Every tower must pass reachability validation before use.

Fairness rules:

- Every chunk has entrance/exit connectors and a declared difficulty range.
- Every chunk has at least one clear path using default geometry (no artifacts required).
- Helpful artifacts may add alternate paths but cannot be required.
- Cursed artifacts may make a path harder but cannot block the only route.
- If validation fails, reroll or swap the chunk.

Themes (3):

- **Lower Ruins**: forgiving stone ledges. Corpse Stacks and Mercy Nails.
- **Bell Shaft**: narrower platforms. Wall-bonk Ghost Platforms.
- **Moon Roof**: unstable ledges. Cursed Bricks and Lantern Trails.

One global movement model. No separate physics per theme.

Procedural fallback: if generation isn't stable by submission, lock to one known-good seed generated by the same chunk system. Present it as "today's tower." Unlock daily rotation post-submission.

## Daily Loop

- **Today**: everyone climbs and mutates the same generated tower.
- **During the day**: the subreddit pushes checkpoints, curses zones, stabilizes routes.
- **End of day**: generate a result card.
- **Tomorrow**: new tower seed. One relic or memory from yesterday returns.

### Result Card

The result card is community story material, not just a scoreboard.

Fields: tower name and seed, summit cleared/uncleared, first summit clear (if any), highest climber (if uncleared), most cursed zone, most useful artifact, best stabilizer, total climbs/falls/clears, tomorrow hook ("Yesterday's Bell of Shame returns as a relic").

## Seeded Demo State

The judged demo post must start with believable seeded state:

- Framing: "37 climbers have already cursed today's tower."
- Include 2–3 visible artifacts and one cursed zone.
- Merge real activity into the same counters — do not replace the seed.
- No visible "demo mode" labels. Seeded state must feel like natural daily state.
- The judge's actions must mutate real state from that point onward.

## Difficulty Targets

- First fall: within 10–20 seconds.
- First visible mutation feedback: within 30 seconds.
- First checkpoint: reachable by an average judge within 60–90 seconds.
- Summit: hard but not streamer-hard.
- Early zones teach control and mutation. Later zones test mastery and community artifacts.
- Seeded artifacts should help the judge experience success even if they aren't good at platformers.

## Camera & Viewport

- Vertical follow camera, centered on player with more space above than below.
- While grounded, subtle bias toward the intended jump direction or next ledge.
- On charge, show the nearby landing area without revealing the whole tower.
- At checkpoints, briefly settle and frame the next zone name and artifact state.
- Mobile controls occupy a fixed bottom safe area — camera framing must account for it.
- Avoid tiny zoomed-out tower views during active play.

## Copy Tone

Mutation feedback should be dry, compact, mildly cursed, and never verbose.

Good:
- "14 falls made this foothold."
- "Moon Shelf is Haunted."
- "Your fall counted. 2 more short jumps spawn a Mercy Nail."
- "This brick remembers overconfidence."
- "Bell Shaft has heard enough from you today."
- "u/riverknife stabilized the Lower Ruins."

Bad:
- Long tutorial sentences.
- Fake bot commentary.
- Meme overload.
- Mean personal shaming.
- Lore paragraphs.

## Sound

In scope for v1. The game needs audio feedback for:

- Jump charge (rising tone or tension)
- Jump release / launch
- Landing (surface-dependent — stone vs metal vs moon)
- Fall / death (impact + brief mutation chime)
- Mutation feedback (artifact spawn or threshold cross)
- Checkpoint clear
- Cursed zone ambiance (subtle, not oppressive)
- UI interactions (buttons, result card)

Keep sounds compact and tactile. No music loop required for v1, but ambient texture per zone is good if time allows. Provide a mute toggle.

## Visual Direction

Target: **compact cursed diorama.** Tactile, damaged, vertical, legible.

The mockups explore a washi/indigo/persimmon Japanese-inspired palette. This is one valid direction — visual identity is open for exploration as long as it hits these constraints:

- Side-view tower, not dashboard.
- Chunky materials with strong silhouettes.
- Sparse overlays: zone name, climb/fall stats, current mutation.
- Artifact labels feel stamped into the tower.
- Artifacts differentiated by shape, not only color.
- Readable mobile layout with sufficient contrast.
- Reduced-motion support.

Do not produce:

- Generic pixel-art fantasy.
- Neon-gradient game template energy.
- Heavy card stacks or fake parchment overload.
- Desktop-first layouts.
- AI-looking generic polish.
- Reddit/karma/Snoo theming as identity.

## Architecture

### Three-Layer Split

| Layer | Owns | Does Not Own |
|---|---|---|
| **Pure game logic** | Tower generation, chunk selection, mutation threshold derivation, artifact derivation from zone state, scoring, result summaries | Rendering, input, persistence |
| **Phaser client** | Movement, collision, camera, jump/fall detection, rendering tower + artifacts, emitting events (`fallRecorded`, `checkpointReached`, `summitCleared`) | Persistent Reddit state, server validation |
| **Devvit Web server/client shell** | Loading/saving shared state through `/api`, compact stats + result panels, mobile controls, post lifecycle, persistence | Physics, collision, tower rendering |

Constraint: Phaser emits game events. The shell decides what to persist. Phaser should not directly own persistent Reddit state.

Pure game logic should be testable without launching a canvas.

### Persistence Timing & Concurrency

- During play, falls and checkpoints are local events.
- When an attempt ends (fall below zone recovery line), the shell sends one mutation event: `{ dailySeed, zoneId, failureBucket, userIdHash, timestamp }`.
- Persistence increments the relevant counter if the user hasn't exceeded contribution caps.
- Artifact state is derived from counters after the merge.
- If two players update the same zone, both increments coexist (additive counters).
- Prefer additive counters over storing final object state directly — avoids last-write-wins.

### Devvit Platform Notes

- **Runtime**: Devvit Web app rendered in a Reddit iframe. Client code uses configured HTML entrypoints from `devvit.json` and calls server endpoints under `/api`.
- **Persistence**: Redis-like key-value store via `redis` from `@devvit/web/server`. No SQL. No WebSockets — use event writes, sparing polling, or supported realtime features only when justified.
- **Viewport**: Reddit posts render ~400–500px wide with variable height. The mockups assume 480px — likely correct.
- **Rate limits**: Devvit has API call quotas. Batch state writes per attempt, not per frame or per jump.
- **App review**: Content policies apply. No NSFW, no real-money mechanics.
- **Phaser in Devvit**: Phaser runs in the expanded Devvit Web client entrypoint. It has no direct Redis or Reddit API access; privileged work happens through server endpoints using `@devvit/web/server`.

Use project-native Devvit patterns when the scaffold exists. Ask before adding heavy dependencies or paid services.

## Scaling Model

The game must work at every traffic level:

- **1 player (judge)**: seed believable state. First fall immediately creates visible feedback. The judge's own artifacts make the next attempt different.
- **10 players**: most contributions show. Low thresholds make the tower feel alive.
- **50 players**: aggregate repeated events. Cap visible artifacts per zone.
- **100 players**: represent each zone as a state (Quiet → Haunted → Cursed → Reinforced → Stabilized). Anti-griefing caps engage.
- **500 players**: aggregated counters, capped artifacts, no sharding needed for v1.

## Hackathon Submission Checklist

- [ ] A new judge understands shared mutation from the first viewport.
- [ ] Desktop and mobile controls both preserve the commitment loop.
- [ ] A seeded daily tower opens with believable community state.
- [ ] A fall updates feedback and shared state without cluttering the map.
- [ ] A clean clear or stabilization has visible value.
- [ ] The tower remains finishable after mutation.
- [ ] The result card turns the day into a story.
- [ ] Sound feedback reinforces key moments.
- [ ] Devvit rules and platform constraints have been checked.
- [ ] App listing is submitted on developer.reddit.com.
- [ ] Public demo post is live and self-explanatory.
- [ ] Feedback log supports a high-quality survey response.


### App Listing

Needs: title ("Fallstack" or "Fallstack: Cursed Tower"), short description emphasizing the shared mutation hook, screenshots showing artifacts and community state, and category selection.

## Feedback Award Track

Treat Developer Platform feedback as a parallel deliverable.

Maintain `docs/devvit-feedback-log.md` from the moment Devvit work begins. Each entry:

- Date/time, environment (OS, browser, Node, Devvit CLI version).
- Task attempted, exact command or UI path.
- Expected vs actual result. Reproduction steps.
- Screenshots/logs when useful.
- Severity: blocker, confusing, rough edge, docs gap, feature request, praise.
- Workaround if any.

Test intentionally: happy paths, common wrong paths, edge cases (interrupted deploys, mobile reloads mid-game, duplicate tabs, rapid input, reinstall loops). Record platform strengths too.

Quality bar: actionable, specific, reproducible, fair, includes evidence, separates bugs from suggestions.

## Do Not Build

One canonical list. If it's here, do not build it before submission:

- Endless mode or infinite generation.
- Skins, cosmetics, shop, or inventory.
- Complex relic or meta-progression system.
- Per-player replays.
- Comments-as-input or subreddit voting mechanics.
- Multiplayer presence or real-time ghosts.
- User-generated tower chunks.
- Full moderation tools.
- Multiple game modes.
- Long tutorial or onboarding sequence.
- Dashboard-with-a-game-in-it layouts.
- Reddit/karma/Snoo theming.
- Fake demo labels.

## Non-Negotiables (Quick Reference)

- The shared mutation hook must be understandable without reading comments.
- Comments amplify the game; comments do not hold required state or inputs.
- No visible "demo mode" labels in the judged path.
- Do not add broad systems unless they improve the judged loop.
- The tower is the hero, not the panels.


## important
- Do not checkpoint after each phase completion.
- try to run one big task, instead treating every phase as a separate task.
- NO need to provide me with anything after you implement a phase. What has been done, commands run, validation --- Nothing. 
- Just try not to stop until you complete the complete /phases folder. all the 30 phases.
- try to treat all of this execution as a one big task.
