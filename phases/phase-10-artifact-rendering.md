# Phase 10 — Artifact Rendering & Collision

> Render the five mutation artifact types and wire their collision behavior into the tower without letting artifacts clutter or break the route.

---

## Context

Artifacts are the visible proof that the tower is shared. They must be readable before contact. Shape and behavior matter more than color.

This phase consumes derived artifact state from Phase 09 and turns it into Phaser objects.

---

## What This Phase Builds

### Artifact Types

| Artifact | Collision | Visual Signal |
|----------|-----------|---------------|
| Corpse Stack | Solid foothold | Chunky stacked blocks, stamped origin label |
| Mercy Nail | Solid narrow ledge | Small peg/nail, visibly narrower than platforms |
| Ghost Platform | Semi-solid or temporary | Translucent plank, soft outline, limited-use feel |
| Cursed Brick | Solid timing hazard | Cracked brick, wobble/crumble warning |
| Lantern Trail | Visual-only | Faint arc/glow showing a route |

### Artifact Placement

Artifacts should attach to declared artifact slots in the static tower layout or generated chunks. Do not calculate random positions from failure events.

Each zone can show at most:

- One helpful artifact.
- One hazard artifact.
- One route hint.

### Collision Behavior

Corpse Stack:

- Solid.
- Wider than Mercy Nail.
- Safe to stand on.

Mercy Nail:

- Solid.
- Narrow, precise, helpful.
- Should not look like a full ledge.

Ghost Platform:

- Semi-solid from above.
- Optional limited lifetime or opacity pulse.
- Must not become required for the default route.

Cursed Brick:

- Solid initially.
- Wobbles or cracks after landing.
- Can crumble after a short delay.
- Respawns/reset behavior should be local and temporary; the shared counter remains.

Lantern Trail:

- No collision.
- Pure route hint.
- Never blocks visibility of platforms.

### Labels

At least one visible artifact in the opening zone should carry origin text such as:

```text
14 falls made this foothold.
```

Keep labels compact and stamped into the world. Do not create floating dashboard cards.

---

## Key Technical Considerations

- Artifacts are derived objects, not persisted objects.
- Collision semantics must be communicated by shape before contact.
- Stabilized zones can calm artifact animation, but artifacts remain visible as history.
- Reduced-motion disables cosmetic wobble/pulse but preserves hazard readability via cracks/outlines.
- Artifact rendering should be data-driven from `ArtifactViewModel` objects.

---

## How to Know It's Working

- Seeded state shows 2-3 readable artifacts in the starting viewport.
- Each artifact type has a distinct silhouette.
- Helpful artifacts can be landed on.
- Cursed Brick behavior is readable and not unfair.
- Lantern Trail never collides.
- Per-zone caps prevent visual clutter even with high counters.

