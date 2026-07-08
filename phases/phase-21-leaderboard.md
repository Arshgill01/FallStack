# Phase 21 — Leaderboard & Player Identity

> Add lightweight daily recognition that supports the community story without turning the game into a generic scoreboard.

---

## Context

Fallstack is not primarily a leaderboard game. Recognition exists to create comment material and reward useful contributions: first clear, highest climber, best stabilizer, most useful fall. Keep it compact and daily.

---

## What This Phase Builds

### Daily Achievements

Track a small set:

- First summit clear.
- Highest climber if summit remains uncleared.
- Best stabilizer.
- Most useful artifact contributor if attribution is available.
- Total community climbs, falls, and clears.

Avoid broad ranked lists for v1. A top-100 leaderboard is scope creep.

### Identity Rules

- Use Devvit-authenticated username/user ID.
- Positive achievements can name users.
- Failure/cursing stays aggregate or anonymous.
- Do not accept client-supplied usernames.

### Storage

Store daily achievement state under:

```text
fallstack:{YYYY-MM-DD}:achievements
```

Use additive counters where possible:

- per-user clears
- per-user summit clear timestamp
- per-user highest zone/height

### Display Surfaces

Use achievement data in:

- result card
- checkpoint/stabilization banner
- optional compact post-session panel

Do not place a dashboard beside the tower.

---

## Key Technical Considerations

- The tower remains the hero.
- Recognition should support the Reddit story, not distract from play.
- Store minimal personal data.
- Achievement writes must tolerate duplicate tabs and retries.

---

## How to Know It's Working

- First summit clear is recorded once.
- Highest climber updates when a user reaches a new high point.
- Best stabilizer reflects successful clear contributions.
- Result card can name positive contributors.
- No UI resembles a generic leaderboard dashboard.

