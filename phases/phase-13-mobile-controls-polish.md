# Phase 13 — Mobile Controls Polish & Touch Input Quality

> Take the mobile controls from functional to polished — proper touch handling, prevent scroll interference, fix edge cases with multi-touch, ensure buttons are thumb-friendly, and make the controls feel as responsive as keyboard input.

---

## Context

By this point the game runs inside a Devvit interactive post. The control bar exists in the DOM shell (not in the Phaser canvas) and updates a shared client input state that Phaser reads each frame. The mockup's `bindHold()` function handles a basic touch lifecycle — press, hold, release — but it was built for a proof-of-concept, not for the edge cases real mobile play surfaces. Keyboard input on desktop already feels tight. Mobile needs to match it.

The control bar is **DOM content managed by Devvit**, sitting below the Phaser canvas. Reddit's post iframe already sets `touch-action: none` and `user-select: none`, which helps prevent browser-level interference, but those need verification on both iOS Safari and Android Chrome.

---

## What This Phase Builds

### Touch Event Handling Refinement

The control buttons need to intercept the full touch lifecycle cleanly:

- **Prevent default** on `touchstart`, `touchmove`, `touchend`, and `touchcancel` to suppress scroll, zoom, and rubber-band bounce.
- **Handle `touchcancel`** — iOS fires this when the system interrupts (notification banner, gesture conflict). Any held state must release cleanly.
- **Multi-touch support**: a player holding left with their left thumb must be able to tap jump with their right thumb simultaneously. This is standard in mobile platformers and non-negotiable. Track touches by `Touch.identifier`, not by assuming a single active touch.
- **Prevent ghost clicks**: touching a button fires `touchstart` → `touchend` → `mousedown` → `mouseup` → `click` in sequence. The mouse events are synthetic. Either call `preventDefault()` on the touch events to suppress them, or debounce/ignore mouse events that arrive within ~300ms of a touch event. Do not allow double-firing.

### Button Sizing and Layout

From the mockup's established dimensions:

| Element | Size | Notes |
|---------|------|-------|
| Direction buttons (←, →) | 62×62px | 14px border-radius |
| Jump button | flexible width, max 220px, 62px height | Fills space between direction buttons |
| Controls bar | 88px height | 14px horizontal padding |

These sizes are already thumb-friendly at standard mobile DPIs. The key constraint is that they must not shrink below usable size on narrow viewports (320px width phones still exist). If the viewport is too narrow for all three buttons at full size, the jump button width compresses first — the direction buttons stay at 62×62px.

### Pressed States

When a button is actively held:

- **Visual**: `translateY(2px)`, reduced box-shadow (shadow shrinks to match the "pushed in" offset), slightly darker background color.
- **Haptic**: if `navigator.vibrate` is available, fire a light pulse on press — `navigator.vibrate(10)` or similar. This is a single short buzz, not a pattern. Gated behind the vibration API check and the mute/preference state.

### Charge Feedback on Jump Button

The jump button doubles as a charge meter:

- A fill overlay inside the button grows from `width: 0%` to `width: 100%` as the player holds the jump button and the charge accumulates.
- Fill color: persimmon at 28% opacity (`rgba(206, 76, 53, 0.28)` or the equivalent from the palette).
- Transition: `0.03s linear` — fast enough to feel responsive, smooth enough to not flicker.
- The fill resets to 0% on release (when the jump fires).
- The charge state comes from Phaser through shared client state or a lightweight local event emitter — the DOM button reflects what Phaser reports, not what the DOM calculates independently. This keeps the charge meter in sync with actual game physics.

### Viewport Safety

- The game canvas ends above the control bar. There must be no overlap during critical moments (peak of a jump, landing near the bottom of the viewport).
- The canvas height is `viewportHeight - controlBarHeight` (88px). This is set during initialization and does not change.
- On very small screens (viewport height < 500px), verify that the playable area is still sufficient. If it isn't, the control bar can compress slightly (minimum 72px height), but this is a fallback, not the default.

### Input Timing

- Touch-to-action latency must be imperceptible. The `touchstart` event should immediately update the input state object and post the message to Phaser. No debouncing on press — only on release if needed.
- The hold-to-charge → release-to-jump cycle must feel identical to holding and releasing the spacebar. Same charge curve, same release timing, same jump result. If there's a perceptible difference, inspect the shared input state timing and Phaser update loop.
- On iOS Safari, the legacy 300ms tap delay applies to `click` events but **not** to `touchstart`. Using touch events directly avoids this entirely. Do not fall back to click handlers for game input.

### Accessibility

- All control buttons get `aria-label` attributes: "Move left", "Move right", "Jump (hold to charge)".
- Button contrast must meet WCAG AA against the control bar background. The current mockup palette (dark buttons on washi-cream bar) likely passes, but verify.
- Keyboard focus indicators: if a user tabs to a control button (unusual on mobile but possible with external keyboards), a visible focus ring should appear.
- The buttons are `<button>` elements, not `<div>`s with click handlers. This gives free keyboard and screen reader support.

---

## Key Technical Considerations

- **Touch identifier tracking**: store active touches in a `Map<number, string>` mapping `Touch.identifier` to the button ID. On `touchend`/`touchcancel`, look up by identifier to know which button to release. This handles the case where a finger slides off a button — the release still fires for the correct button.
- **Input state forwarding**: the DOM maintains a simple state object like `{ left: boolean, right: boolean, jump: boolean, jumpChargeStart: number | null }`. Phaser's input handler reads this and applies it identically to keyboard state.
- **No input during overlay**: when a result card, pause menu, or other overlay is visible, touch input on the control bar should be suppressed or ignored by the game. The buttons can still be pressed (for haptic/visual feedback) but the game should not respond.
- **`bindHold()` refinement**: the mockup's existing function handles press/release but doesn't track touch identifiers or handle multi-touch. It's a starting point, not the final implementation.

---

## How to Know It's Working

- Playing on a phone feels the same as playing with a keyboard on desktop. Same responsiveness, same charge timing, same jump distances.
- Holding the left button with one thumb and tapping jump with the other thumb works — the character moves left and jumps simultaneously.
- No accidental page scroll, zoom, or bounce happens during play, on either iOS or Android.
- The charge fill on the jump button tracks the charge smoothly and resets on release.
- Lifting a finger off a button always cleans up — no stuck "moving left" state after releasing.
- Buttons are easy to hit with thumbs without looking at them. No precision required.
- The pressed visual state is clearly visible — you can tell which buttons are held.
- Rotating the device or resizing doesn't break the control layout.
