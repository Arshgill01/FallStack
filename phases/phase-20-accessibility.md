# Phase 20 — Accessibility, Reduced Motion & Contrast

> Ensure the game meets accessibility standards — WCAG contrast ratios, keyboard navigability, reduced-motion support, screen reader basics for UI elements, and inclusive design for colorblind players.

---

## Context

FallStack is a visual game rendered on a Phaser canvas inside a Devvit webview. The canvas itself is inherently inaccessible to screen readers — that's a known constraint of any canvas-based game and is acceptable. But the game isn't just the canvas. It has shell UI: a header bar, control buttons, HUD overlays, mutation banners, checkpoint banners, and a result card. All of these are HTML elements rendered around or above the canvas, and all of them must be accessible.

The game's visual palette — washi, indigo, persimmon — was chosen for warmth and thematic fit. But warmth doesn't guarantee contrast. The artifact system was designed to use shape differentiation (§18, §25), not just color. This phase verifies those design intentions hold in practice and fills in what's missing.

Accessibility isn't a checkbox phase. It's a quality-of-experience pass that makes the game usable for more people without degrading the experience for anyone.

---

## What This Phase Builds

### Color Contrast Verification

Every text element in the game shell needs to meet WCAG AA contrast ratios:

| Element | Ratio Required | Notes |
|---------|---------------|-------|
| Normal body text (< 18px) | 4.5:1 minimum | Result card content, HUD stats, banner text |
| Large text (≥ 18px or ≥ 14px bold) | 3:1 minimum | Zone badge labels, header title, artifact labels |
| UI components and graphics | 3:1 against adjacent colors | Button borders, focus indicators, icon outlines |

Specific elements to audit:

- **Zone badge text** against the zone's background color (Ruins stone, Bell metal, Moon sky)
- **Artifact labels** against the game background
- **HUD text** (zone tag, stats counters) against the semi-transparent HUD background
- **Mutation banner text** against the banner background
- **Result card** — all text fields against the card background
- **Control button icons/labels** against the button background
- **Checkpoint banner text** against the banner overlay

Use browser DevTools or a contrast checker tool. If any element fails, adjust the specific text color or background opacity — don't redesign the palette. Small adjustments (darkening text, increasing background opacity) usually resolve contrast issues without changing the visual identity.

### Reduced Motion Support

Detect the user's motion preference and adjust accordingly:

```javascript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

Pass this flag into the Phaser game config and use it to gate cosmetic animations:

| Animation | With Motion | Reduced Motion |
|-----------|------------|----------------|
| Cursed brick wobble | Wobbles with increasing amplitude | Static, maybe subtle color shift |
| Ghost platform pulse | Opacity pulses gently | Static at mid-opacity |
| Charge glow animation | Growing particle effect | Static glow at current charge level |
| Banner slide-in/fade | Slides in from edge, fades out | Appears/disappears instantly |
| Background parallax | Subtle depth movement | Static background |
| Dust/debris particles | Particle bursts on events | No particles |
| Screen shake on fall | Brief camera shake | No shake |
| Artifact spawn shimmer | Glow/sparkle effect | Instant appearance |

**Keep functional animations intact.** The jump arc, the fall, the player movement — these are gameplay, not decoration. They convey information (where am I going, am I falling) and should play even with reduced motion. The line is: if removing the animation makes the game harder to understand, keep it. If the animation is purely decorative, respect the preference.

Listen for changes to the preference during the session:

```javascript
window.matchMedia('(prefers-reduced-motion: reduce)')
  .addEventListener('change', (e) => {
    game.registry.set('reducedMotion', e.matches);
  });
```

### Keyboard Accessibility

All interactive HTML elements (outside the canvas) must be keyboard-navigable:

- **Tab order:** Header elements → Control buttons → Any overlay content (result card, checkpoint banner)
- **Focus indicators:** Every focusable element must have a visible focus ring. Use `:focus-visible` to show focus rings only for keyboard navigation, not mouse clicks. The focus ring should have sufficient contrast (3:1 against adjacent colors).
- **Control buttons:** Left, Jump, Right buttons must be focusable and activatable with Enter/Space
- **Result card:** Close button is focusable. If the result card has scrollable content, it should be scrollable with arrow keys.
- **Overlays:** When a modal overlay (result card) opens, focus should move to it. ESC should close it. When it closes, focus should return to the previously focused element.
- **Skip link (optional):** If the header has many elements, a skip link to jump to the game controls could help.

Focus trapping in overlays:

```javascript
// When result card opens
resultCard.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeResultCard();
  // Tab trapping within the overlay
});
```

### Screen Reader Support

The canvas is opaque to screen readers. Focus on making the shell UI meaningful:

- **Control buttons:** `aria-label="Move left"`, `aria-label="Charge jump"`, `aria-label="Move right"`
- **HUD zone tag:** `aria-label="Current zone: Lower Ruins"` — update dynamically as the player moves between zones
- **HUD stats:** `aria-label="Height: 47 meters, Falls: 3"` — update on change
- **Mutation banner:** Use `aria-live="polite"` so screen readers announce new banners without interrupting. The banner text is already descriptive ("14 falls made this foothold.") — it works as-is for screen readers.
- **Result card:** Structure with proper headings. The result card title, stats, and artifact summary should be in a logical reading order. Use `role="dialog"` and `aria-modal="true"` when it's open.
- **Checkpoint banner:** `aria-live="polite"` for checkpoint announcements

Example banner markup:

```html
<div class="mutation-banner" role="status" aria-live="polite">
  14 falls made this foothold.
</div>
```

### Colorblind Safety

The game's artifact system was designed with shape differentiation (§18, §25). Verify this holds:

- **Artifacts:** Each artifact type has a distinct shape: Corpse Stack is chunky and stacked, Mercy Nail is a narrow peg, Ghost Platform is translucent and soft-edged, Cursed Brick is cracked and unstable, and Lantern Trail is a visual-only arc. Shape and label carry the meaning, not color alone.
- **Zone state indicators:** If zones use color to indicate state (Quiet → Haunted → Cursed → Reinforced → Stabilized), add a secondary indicator — an icon, a pattern, or a text label.
- **Danger indicators:** Cursed bricks and ghost platforms must be distinguishable by more than color. The wobble animation (cursed) and pulse animation (ghost) provide motion cues. With reduced motion on, use patterns or outlines instead.
- **Platform types:** Standard, cursed, ghost, moving — each needs a visual distinction beyond color. Outline style, fill pattern, or shape variation.

Test with colorblind simulation:
- Protanopia (red-blind)
- Deuteranopia (green-blind)
- Tritanopia (blue-blind)

Browser DevTools has rendering emulation for vision deficiencies — use it.

---

## Key Technical Considerations

- **The Phaser canvas is a black box to assistive technology.** This is true of all canvas-based games. Don't try to make individual platforms or the player character screen-reader accessible. Focus on the HTML shell.

- **Reddit's iframe context may limit accessibility features.** Test focus management, `aria-live` regions, and keyboard events within the actual Devvit webview, not just a standalone HTML page. Some events might not propagate through the iframe boundary.

- **`prefers-reduced-motion` is inherited into iframes** from the parent page's OS/browser settings. Verify this works in Devvit's webview context.

- **Don't break the visual design for accessibility.** Most accessibility improvements are additive (adding aria labels, adding focus rings) or minor adjustments (tweaking a text color by a few shades). The game should look the same to sighted users.

- **The mockup's shape differentiation principle is the most important thing to verify.** If artifacts are distinguishable by shape in the HTML mockup but rendered as same-shaped colored dots in Phaser, that's a regression. Carry the shape language through to the game rendering.

---

## How to Know It's Working

- Run a contrast checker on every text element in the game shell. All pass WCAG AA (4.5:1 for normal text, 3:1 for large).

- Set `prefers-reduced-motion: reduce` in browser/OS settings. Load the game. No cosmetic animations play — no wobble, no pulse, no particles, no screen shake. The game is still fully playable. Functional animations (jumping, falling, moving) still work.

- Navigate the entire UI with only the keyboard. Tab through header, controls, HUD. Open the result card — focus moves to it. Press ESC — it closes and focus returns. Every interactive element has a visible focus ring.

- Turn on VoiceOver (macOS) or a screen reader. Navigate the control buttons — hear "Move left," "Charge jump," "Move right." When a mutation banner appears, the screen reader announces it without being prompted. The result card reads out in a logical order.

- Apply a deuteranopia simulation filter. Look at the game. Every artifact type is still distinguishable. Every zone state is still identifiable. Every platform type is still recognizable. If anything becomes ambiguous, it needs a non-color cue.
