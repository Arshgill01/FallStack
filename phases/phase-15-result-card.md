# Phase 15 — Daily Result Card & Session Summary

> Build the result card that appears at summit clear (and optionally at session end) — a community story summary that turns the day's climbing into comment fuel and social material.

---

## Context

The game has a summit. Players can reach it. But reaching the summit currently means... nothing visible happens. No ceremony, no summary, no social artifact. The result card is where the daily climb becomes a **story** — a summary of what the community did today, who helped, what went wrong, and what carries forward.

From §22 in the concept log: the result card is how the game becomes Reddit-native outside the play session. It's the thing players screenshot, the thing they reference in comments, the thing that makes someone say "wait, who cursed the Bell Tower?" The card is social material first, personal stats second.

The result card lives in the DOM (Devvit Web client shell), not in the Phaser canvas. It overlays the game as a modal card with a dark backdrop.

---

## What This Phase Builds

### Result Card Content

The card presents the day's community story in a structured layout. Content fields:

| Section | Content | Source |
|---------|---------|--------|
| **Header** | Tower name + seed | Daily meta from Redis: `fallstack:{date}:meta` |
| **Summit status** | "Summit Cleared" / "Summit Unclaimed" + first clear username | `fallstack:{date}:meta:summitClear`, `fallstack:{date}:meta:firstClearer` |
| **Most cursed zone** | Zone with worst net curse score + its current badge | Compare `totalFalls - successfulClears` across zones, pull badge |
| **Most useful artifact** | Zone with highest helpful artifact count + artifact name | Artifact spawn/effect data from zone state |
| **Best stabilizer** | Username who contributed most successful clears | Aggregate clear contributions per user across zones |
| **Session stats** | "X climbs · Y falls · Z clears" | Player's session counters (local) |
| **Tomorrow hook** | Flavor text about continuity | Static text with optional relic reference from `fallstack:{date}:relic` |

### Result Card Styling

From the mockup's established visual language:

- **Background**: paper card (`#f7f0e2` / washi-cream), rounded corners (14px), strong drop shadow.
- **Title**: Shippori Mincho font, persimmon-deep color. Large, centered.
- **Row separators**: dashed borders between content sections. Light, not heavy — suggests paper folds or perforated edges.
- **Stats rows**: clean left-aligned labels with right-aligned values. Monospace or tabular figures for numbers.
- **Summit status**: prominent position below the title. If cleared, show the username in persimmon. If unclaimed, show in muted stone-gray.
- **Tomorrow hook section**: moss-green background tint with a left border accent in moss. Set apart from the stats above it. This is the emotional close of the card.
- **"Keep Climbing" button**: persimmon background, cream text, rounded, centered at the bottom of the card. This is the only interactive element on the card.
- **Dark overlay**: `rgba(0, 0, 0, 0.5)` or similar behind the card. Clicking the overlay does **not** dismiss the card — only the button does.

### Summit Trigger

The result card appears when the player **lands on the summit platform** — the final platform at the top of the Moon zone. This is detected by Phaser (collision with the summit platform object), written through `/api/record-summit`, and reflected in the DOM shell.

The trigger flow:

```
Phaser: player lands on summit platform
  → client calls /api/record-summit
Devvit Web server:
  → validates and writes summit state
Client shell:
  → fetches/receives community stats
  → renders result card overlay
  → pauses game input (optional — the card blocks interaction anyway)
```

### Close Behavior

- "Keep Climbing" button dismisses the overlay.
- The game resumes — the player is still on the summit platform and can continue playing (jump off, explore, etc.).
- The card can be re-shown if the player lands on the summit again, but it shouldn't pop up aggressively. Consider a cooldown (don't show again for 30 seconds) or a manual trigger (a small "📜" icon appears in the UI after first summit clear).

### Optional: Menu Access

Players who haven't summited should still be able to see the community's progress. Consider:

- A small button or icon in the game header that opens the result card at any time.
- The card shows the same community data but the summit status shows "Unclaimed" and the session stats reflect the current session.
- This lets curious players see what the community has done without needing to reach the top.

### Data Fetching

The result card reads from shared Redis state. The fetch happens when the card is triggered, not continuously. Fields to read:

```
fallstack:{date}:meta               → seed, summitClear, firstClearer
fallstack:{date}:zone:ruins         → totalFalls, successfulClears, badge, artifacts
fallstack:{date}:zone:bell          → totalFalls, successfulClears, badge, artifacts
fallstack:{date}:zone:moon          → totalFalls, successfulClears, badge, artifacts
fallstack:{date}:zone:*:stabilizer  → per-zone stabilizer usernames
```

The "best stabilizer" requires aggregating across zones. This can be computed client-side from the zone data, or stored as a derived field in Redis if the computation is expensive.

---

## Key Technical Considerations

- **DOM rendering, not Phaser**: the result card is HTML/CSS in the Devvit Web client shell. This gives access to proper typography (Shippori Mincho), text layout, and screenshot-friendly rendering. Phaser would make this harder for no benefit.
- **Redis read latency**: fetching community stats adds a round-trip. The card should show a brief loading state (or pre-fetch stats periodically) so the summit moment isn't interrupted by a spinner.
- **Screenshot-friendly**: players will screenshot this card and post it in comments. The card should look good as a standalone image — no UI chrome that looks weird out of context. Consider the card's appearance when cropped from the game.
- **Community data, not just personal data**: the card's value is in showing what *everyone* did. "Most cursed zone: Bell Tower (Cursed)" tells a story. "You jumped 47 times" doesn't. Personal stats are secondary — present them, but don't lead with them.
- **The tomorrow hook matters**: "Tomorrow, today's stumbles return as tomorrow's stepping stones" or a reference to the daily relic. This single line is the retention mechanic in text form. It should hint that coming back tomorrow is worthwhile because today's play had consequences.
- **First clearer attribution**: when a player clears the summit and no one has before (for the day), write their username to `fallstack:{date}:meta:firstClearer`. This is a race condition — use Redis transactions or atomic operations to ensure only the first write sticks.

---

## How to Know It's Working

- Landing on the summit platform shows the result card overlay with a dark backdrop.
- The card displays real community data: actual zone stats, actual badges, actual usernames.
- "Most cursed zone" correctly identifies the zone with the worst failure-to-success ratio.
- "Most useful artifact" names a real artifact from the day's play.
- If someone has cleared the summit, their username appears. If not, it shows "Unclaimed."
- The session stats ("X climbs · Y falls · Z clears") match the player's actual session performance.
- The card looks polished: paper texture background, Shippori Mincho title, dashed separators, moss-green hook section.
- "Keep Climbing" dismisses the card and returns to gameplay.
- The card looks good as a screenshot — clean, complete, no awkward cropping.
- The tomorrow hook text appears and references continuity.
