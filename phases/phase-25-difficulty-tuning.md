# Phase 25 — Difficulty Tuning & Progression Curve

> Tune the physics constants, ledge placement, and zone progression so the game hits the target difficulty: first fall within 10–20 seconds, first checkpoint within 60–90 seconds, summit is hard but not unreachable.

---

## Context

By this point the game is functionally complete — physics, mutations, checkpoints, zones, artifacts, sound, result card, mobile controls, and community state all exist. The numbers driving the feel, though, are inherited from the canvas mockup prototype. Those values were tuned for a standalone HTML page with a mouse, not a Phaser game running inside a Devvit webview on a phone. This phase is about making the game feel right for the actual delivery environment.

The difficulty curve isn't decorative. It directly determines whether a judge experiences the shared mutation hook (§32). If the first zone is too easy, the player never falls, never sees mutation feedback, and never understands the game. If it's too hard, they rage-quit before reaching the first checkpoint and never see what the community built. The sweet spot is: fall fast, learn fast, progress steadily.

---

## What This Phase Builds

### Target Difficulty Benchmarks

These come from §32 and are the north star for all tuning:

| Benchmark | Target | Why It Matters |
|---|---|---|
| First fall | 10–20 seconds from start | Creates the first mutation event — the hook |
| First visible mutation feedback | Within 30 seconds of first fall | Player sees their failure shaped the tower |
| First checkpoint reached | 60–90 seconds (average player) | Proves the game is winnable, not just punishing |
| Summit reachable | Hard but not streamer-hard | Gives skilled players a goal without gatekeeping content |
| Zone progression | Teach → test → demand | Early zones teach control + mutation; later zones test mastery |

These are targets, not hard gates. If playtesting shows 25 seconds to first fall but the experience feels right, that's fine. The spirit matters more than the stopwatch.

### Physics Tuning Levers

Every constant below is a dial. The mockup values are starting points.

| Constant | Mockup Value | What It Controls |
|---|---|---|
| `GRAVITY` | 1550 | Fall speed. Higher = faster falls, more punishing |
| Jump vy (min charge) | -560 | Minimum vertical launch power |
| Jump vy (max charge) | -1000 | Maximum vertical launch power |
| Jump vx (min charge) | 170 | Minimum horizontal launch speed |
| Jump vx (max charge) | 400 | Maximum horizontal launch speed |
| `AIR_ACCEL` | 950 | Mid-air horizontal correction strength |
| `AIR_MAX_VX` | 420 | Max horizontal speed during flight |
| Charge time | 0–900ms | Duration from tap to full charge |
| `WALK_SPEED` | 140 | Lateral ground movement speed |

Key relationships to keep in mind:

- **Gravity vs. jump power** determines arc shape. High gravity + high jump = fast, punchy arcs. Low gravity + low jump = floaty, forgiving arcs.
- **Air accel vs. air max vx** determines mid-air correction. High air accel means players can steer after jumping — more forgiving. Low means committed arcs — more punishing.
- **Charge time** determines the skill floor. Longer charge time means more granularity but also more room for error. Shorter means snappier but less control.

### Platform Geometry Tuning

Platform layout is the other half of difficulty. The physics are only hard relative to the gaps they have to cross.

| Parameter | What It Controls |
|---|---|
| Ledge width | Wider = more forgiving landings |
| Horizontal gap distance | How far the player must jump laterally |
| Vertical gap distance | How high/low the next platform is |
| Landing zone tolerance | Vertical (26px) and horizontal (4px) buffer on landing detection |

#### Zone-Specific Geometry Targets

**Ruins (Moss Steps)** — Forgiving. This is where players learn.
- Ledge widths: 96–108px (widest in the game)
- Gaps: moderate horizontal, gentle vertical
- Precision required: low
- One intentional "bait jump" — a gap that looks easy but catches most first-timers. This is the designed first-fall point. It creates the first mutation event quickly and naturally.

**Bell Shaft** — Moderate. Players know the controls; now they need accuracy.
- Ledge widths: ~78px (noticeably narrower)
- Gaps: wider horizontal, some vertical variety
- Wall-bonk opportunities: some platforms near walls where overcharging punishes
- Precision required: moderate

**Moon Roof (Moon Terrace)** — Demanding. Mastery zone.
- Ledge widths: 84–88px (narrow but not cruel)
- Gaps: long horizontal distances, precision timing matters
- Precision required: high
- The summit should feel earned, not gifted

### Seeded Artifact Assistance

The seeded artifacts placed during Phase 12 aren't just decoration — they're difficulty modifiers for the first zone.

- A **Worn Step** in Ruins should appear near an early gap, making it bridgeable without a perfect jump
- A **Lucky Charm** should be positioned to help a struggling player reach the first checkpoint
- A **Mossy Stone** or **Paper Lantern** can serve as visual landmarks that guide the path

The goal: a judge who isn't great at platformers should still reach the first checkpoint thanks to seeded artifacts (§32). The artifacts are the difficulty assist system — they just don't look like one.

### Playtesting Methodology

Tuning without testing is guessing. Track these metrics during playtesting:

| Metric | How to Measure | Target |
|---|---|---|
| Time to first fall | Stopwatch from first input to first respawn | 10–20 seconds |
| Time to first checkpoint | Stopwatch from first input to first checkpoint clear | 60–90 seconds |
| Attempts to first checkpoint | Count of respawns before first checkpoint | 3–6 attempts |
| Most-failed gaps | Track which gaps cause the most falls | These become mutation hotspots |
| Summit completion rate | Fraction of test sessions that reach summit | Low but non-zero |

The most-failed gaps are especially important — they're where artifacts will naturally accumulate in live play, which means they're the spots where the mutation hook is most visible. If the hardest gap is in a visually boring area, consider moving it.

---

## Key Technical Considerations

- **Mockup values ≠ final values.** The prototype ran at a different resolution, in a different rendering context, with mouse input. Expect every constant to need adjustment for Phaser + Devvit + mobile touch.
- **Failure should be funny, not frustrating.** If a player's reaction to falling is "ugh" instead of "hah," the difficulty is wrong. The mutation hook depends on players finding their failures amusing enough to stay and see what they become. If players rage-quit, they never see the shared mutation.
- **The first zone is the most critical.** It determines whether a judge sees the rest of the game. Spend disproportionate tuning effort on Ruins. The Bell Shaft and Moon Roof can be rougher — players who reach them are already invested.
- **The bait jump is a design tool.** Having one gap in Ruins that most players fail on first try isn't a bug — it's the fastest path to the first mutation event. Make it look inviting, make it slightly too far for a minimum-charge jump.
- **Mobile touch vs. desktop keyboard.** The same physics constants will feel different on touch vs. keyboard. Charge timing, in particular, is harder to control on a touchscreen. Consider whether the charge curve needs to be slightly more forgiving on mobile (wider "good enough" zone for charge duration).
- **Test at the target resolution.** Devvit webviews have specific dimensions. A gap that's jumpable at 1080p might not be at mobile resolution if the physics are resolution-dependent. Verify all gaps are jumpable at the actual render size.

---

## How to Know It's Working

- A new player, playing for the first time, falls within 10–20 seconds.
- That fall produces visible mutation feedback within 30 seconds — a counter increments, a message appears, the zone badge shifts.
- After a few attempts (3–6), the player reaches the first checkpoint. The seeded artifacts helped.
- The Bell Shaft feels noticeably harder — narrower ledges, wider gaps — but a player who cleared Ruins can make progress.
- The Moon Roof requires precision timing and full-charge jumps. It's hard. It's not impossible.
- The bait jump in Ruins catches most first-timers. It's positioned where the resulting mutation feedback is immediately visible.
- Seeded artifacts in Ruins actually make a difference — removing them makes the first zone noticeably harder.
- On mobile, the game feels slightly more forgiving than on desktop (or at least not harder). Touch controls don't create artificial difficulty.
