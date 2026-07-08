# Phase 07 — Tower Rendering & Visual Identity

> Render the tower with themed visuals per zone — the stone, metal, and lunar materials, background atmospheres, and platform shapes that give the game its "compact cursed diorama" identity.

---

## Context

By this point, the tower has structure: zones are defined, platforms have positions and collision types, the player moves and falls through them. But visually it's all debug rectangles and placeholder fills. This phase makes the tower look like the mockup — warm stones at the bottom, twilight metal in the middle, moonlit platforms at the top. The visual identity isn't decoration; it's how the player reads the world.

The reference implementation is `mockup(3).html`, which draws everything procedurally on a canvas with no sprite assets. That approach works and should carry forward into Phaser.

---

## What This Phase Builds

### Per-Zone Color Palettes

Three distinct visual themes, each with a sky gradient, stone colors, edge colors, and glow accents:

**Ruins (Zone 1 — bottom)**
- Sky: warm gold gradient (top to bottom warmth)
- Stone fill: `#a9906c`
- Stone dark: `#7d6a4c`
- Edge/shadow: `#5f5138`
- Glow accent: persimmon (`~#c1440e` range)
- Background element: mountain silhouette along the horizon

**Bell Tower (Zone 2 — middle)**
- Sky: twilight gradient (warm-to-cool transition)
- Stone fill: `#5c6b74`
- Stone dark: `#3a444c`
- Edge/shadow: `#28313a`
- Glow accent: gold
- Background element: hanging lanterns (sparse, soft glow)

**Moon Shelf (Zone 3 — top)**
- Sky: deep indigo gradient
- Stone fill: `#d8d2bd`
- Stone dark: `#a49d84`
- Edge/shadow: `#7d7561`
- Glow accent: lavender
- Background elements: moon disc and scattered stars

These palettes come directly from the mockup and the washi/indigo/persimmon brand palette established in PRODUCT.md.

### Platform Rendering

Platforms are **rounded-rectangle ledges** — not sharp boxes. Each platform has:

- A **top surface** fill (lighter stone color)
- A **shadow edge** along the bottom/sides (darker stone color)
- A **material texture** implied by the theme:
  - Ruins: rough stone blocks — slight irregularity, warm tones
  - Bell Tower: iron/metal platforms — cooler tones, slightly sharper edges
  - Moon Shelf: moon-stone — pale, chalky, luminous edges

The visual shape must communicate collision semantics without relying solely on color (per §18):
- **Solid platforms**: fully opaque, strong shadow edge, chunky feel
- **Semi-solid platforms**: translucent fill, dashed or soft outline
- **Hazardous platforms**: visual cracks, wobble animation, warning color accent
- **Visual-only elements**: no shadow edge, very low opacity, clearly decorative

### Checkpoint Platforms — Torii Gate Style

Checkpoint platforms are visually distinct from regular ledges:

- **Two vertical posts** rising from the platform surface
- **Crossbeams** connecting the posts (torii gate silhouette)
- Posts and beams use the zone's edge color with slight glow
- The ground-level checkpoint (zone 1 start) gets a **bedrock fill** — darker, heavier, foundation-like
- The torii gate should read clearly at the game's small scale — keep proportions chunky

### Summit Platform

The summit (top of Moon Shelf) has a distinct appearance:

- Wider than regular platforms
- Visually marked with a **summit label** (small text chip)
- Slightly different fill — brighter, more luminous than other Moon Shelf platforms
- Should feel like an arrival point, not just another ledge

### Background Atmospheres

Each zone gets a background layer rendered behind the platforms:

- **Ruins**: a mountain silhouette along the lower edge of the zone's vertical range. Dark, layered ridge shapes against the warm sky gradient. Static.
- **Bell Tower**: sparse hanging lanterns. Small warm-glow circles at varying heights, connected by thin lines (strings). These can be static or have a very subtle sway.
- **Moon Shelf**: a moon disc (large pale circle, upper portion of zone background) and scattered stars (small dots, varying brightness). Stars can twinkle subtly.

These are atmosphere, not gameplay elements. They occupy the background layer and never interfere with platform visibility.

### Player Character — Fox-Spirit

The player character from the mockup:

- **Round body** — small circle or slightly squashed oval
- **Pointed ears** — two small triangles on top
- **Blush marks** — small persimmon dots on the cheeks
- **Directional eyes** — simple dots that shift based on facing direction (left/right)
- **Charge glow**: when the player holds jump to charge, a **glow circle** expands around the character. The glow uses the current zone's glow accent color and grows with charge level.

The character should be charming and readable at small size. It's a mascot, not a detailed sprite. Procedural rendering (like the mockup does) is preferred over sprite sheets — avoids asset pipeline complexity for the hackathon timeline.

### The "Compact Cursed Diorama" Aesthetic

From AGENTS.md §25, the visual direction:

- **Chunky materials**: platforms and structures feel like physical objects with weight
- **Strong silhouettes**: everything reads clearly against the background gradient
- **Sparse overlays**: don't clutter the screen — a few well-placed background elements, not a busy scene
- **Stamped labels**: text elements (zone tags, artifact labels, summit marker) have a label/stamp quality — small rounded-rectangle backgrounds, compact text
- **Washi/indigo/persimmon palette**: warm paper tones as base, deep indigo for contrast, persimmon for accents and highlights

---

## Key Technical Considerations

### Procedural vs. Sprite-Based Rendering

The mockup draws everything with canvas 2D calls — `fillRect`, `arc`, `beginPath`. In Phaser, the equivalent is `Phaser.GameObjects.Graphics`. This approach:

- Avoids asset loading complexity (no sprite sheets, no texture atlases)
- Makes it easy to parameterize colors by zone theme
- Keeps the build pipeline simple for hackathon pace

If pre-rendered assets are added later (post-hackathon polish), the procedural shapes can be replaced with sprite textures without changing the game logic.

### Rendering Code Organization

Organize rendering by zone theme so visual variety is easy to extend:

```
// Conceptual structure, not prescriptive
rendering/
  themes/
    ruins.ts      — ruins palette, ruins platform shapes, ruins background
    bell.ts       — bell palette, bell platform shapes, bell background
    moon.ts       — moon palette, moon platform shapes, moon background
  player.ts       — fox-spirit rendering, charge glow
  checkpoint.ts   — torii gate rendering
  summit.ts       — summit platform rendering
```

Each theme module exports a drawing function that takes position/size and draws using the theme's palette. The main rendering loop selects the correct theme based on which zone a platform belongs to.

### Draw Order

Back to front:
1. Sky gradient (full viewport background)
2. Background atmosphere elements (mountains, lanterns, moon/stars)
3. Platforms and structures (back layer artifacts, then platforms, then front layer artifacts)
4. Checkpoint torii gates
5. Artifact overlays and labels
6. Player character
7. Charge glow (on top of player)

### Performance Notes

- The tower is vertically scrolled — only platforms near the viewport need full rendering
- Background elements can be drawn once and cached if they don't animate
- The star twinkle and lantern sway (if animated) should be simple sin-wave offsets, not particle systems
- The mockup renders the full visible tower every frame at 60fps on canvas 2D — Phaser with WebGL should handle this comfortably

---

## How to Know It's Working

- The tower looks like `mockup(3).html` — warm stones at the bottom, twilight metal in the middle, moonlit platforms at the top
- Each zone has a visually distinct atmosphere — you can tell which zone you're in without reading labels
- Platforms look chunky and physical — rounded edges, shadow underneath, material difference per theme
- The player character is charming at small size — round body, ears, blush marks visible
- Torii gates clearly mark checkpoints — you can spot them scanning the tower
- The summit looks like a destination, not just another platform
- When the player charges a jump, a glow circle expands around them using the zone's accent color
- The overall visual impression is "compact cursed diorama" — not a generic platformer, not overly busy
