# Phase 26 — Copy, Tone & Language Polish

> Audit and polish all player-facing text — mutation feedback, checkpoint banners, result card copy, button labels, headings, artifact names, and error messages — to match the dry, compact, mildly cursed tone established in §34.

---

## Context

By this point, player-facing strings exist throughout the codebase — mutation feedback messages, checkpoint banners, result card labels, button text, artifact names, zone badge names, error messages. Most of these were written while building features, prioritizing correctness over voice. This phase is a dedicated pass to make every string feel like it belongs in the same game.

Tone is not cosmetic. It's the primary way the shared mutation hook feels personal and alive. A mutation message that reads "Zone counter incremented" is functionally correct but emotionally dead. A message that reads "This brick remembers overconfidence" makes the player feel like the mountain noticed them. The copy is how the game's personality reaches the player.

---

## What This Phase Builds

### Mutation Feedback Copy

Every fall produces a message. These messages should be:

- **Specific** to the zone, the failure bucket, and the count
- **Short** — one line, two at most
- **Dry** — observational, not exclamatory
- **Mildly cursed** — the mountain has opinions, but it's not mean

#### Good examples:
- "Your fall added +1 to Moon Terrace. 2 more short jumps spawn a Mercy Nail."
- "This brick remembers overconfidence."
- "Bell Shaft has heard enough from you today."
- "Moss Steps absorbs another stumble."
- "That gap has claimed 14 climbers. It's getting comfortable."

#### Bad patterns to avoid:
- **Long sentences.** No tutorials in mutation feedback. The message is flavor, not documentation.
- **Tutorial-style explanations.** Not "You fell because your jump was too short. Try holding longer next time."
- **Meme references.** Not "skill issue lol" or "L + ratio + fell."
- **Mean personal shaming.** Not "Wow, you're terrible at this." The mountain is wry, not cruel.
- **Generic filler.** Not "Oops!" or "Try again!" or "Better luck next time!"

### Artifact Names

The artifact naming convention uses softened, tactile language — these are objects that feel like they belong on an old mountain, not items in a video game inventory.

| Artifact | Name | Notes |
|---|---|---|
| Step assist | Worn Step | Sounds like it's been there forever |
| Luck modifier | Lucky Charm | Unassuming, slightly mysterious |
| Visual landmark | Paper Lantern | Warm, fragile, human |
| Decorative | Mossy Stone | Natural, ancient |
| Path guide | Lantern Path | Suggests someone left it for you |

These names must be consistent across every surface they appear on:
- In-game labels (when artifacts are visible on the tower)
- Checkpoint banners (when an artifact's origin is described)
- Result card (artifact contribution summary)
- Mutation feedback messages (when an artifact threshold is approaching or triggered)

### Zone Badge Display Names

The internal badge states map to player-facing display names. These names describe how the zone feels, not what state it's in.

| Internal State | Display Name | Feeling |
|---|---|---|
| Quiet | Untouched | Pristine, waiting |
| Haunted | Restless | Something's stirring |
| Cursed | Overgrown | Too many failures, nature took over |
| Reinforced | Well-Trodden | Many climbers passed through carefully |
| Stabilized | Blessed | Community care healed this zone |

These must be consistent across:
- The HUD zone indicator
- Checkpoint banners
- The result card zone summary
- Any mutation feedback that references zone state

### Checkpoint Copy

When a player clears a checkpoint:

**Normal clear:**
> "{zoneName} noted your care."

**Stabilized zone clear:**
> "{zoneName} settles quiet."

**Subtitle (both cases):**
> "{N} clean climb(s) tended this slope · Next: {nextZone}, {badge}"

The subtitle provides community context — how many clean clears this zone has seen — and previews what's ahead. It uses "tended" rather than "completed" or "cleared" because the metaphor is caretaking, not conquest.

### Result Card Copy

The result card is the last thing a player sees. It should summarize their relationship with the tower and tease tomorrow.

**Elements:**
- **Tower name and seed:** Displayed prominently. The tower has an identity.
- **Tomorrow hook:** Varied daily teaser text. Not the same message every day.
  - "Tomorrow's tower carries a relic from today."
  - "This mountain sleeps soon. Another wakes."
  - "The moon remembers what the ruins forgot."
- **Achievement labels:** Brief and descriptive.
  - "First clear of Moon Terrace" — not "🏆 ACHIEVEMENT UNLOCKED: Moon Master"
  - "Cleanest climb through Bell Shaft" — not "Perfect Run!"
  - "Most cursed zone: Moss Steps (47 falls)" — factual, slightly amused

### Header Copy

The persistent header at the top of the game:

> "X travelers slipped on this mountain today"

Where X is the real community fall count. This is the first thing a player reads. It establishes that this isn't a solo game — other people have been here, and they failed.

### Controls Hint

> "Arrows move & steer midair · Hold Space · Release to leap"

On mobile, adapt to touch context:

> "Drag to move & steer · Hold to charge · Release to leap"

Short. Scannable. No paragraph explanations.

### Opening Message

On first load, before the player touches anything:

> "Moss Steps already holds a Mossy Stone, a Lucky Charm, and a Paper Lantern. Your first slip will shape it too."

This tells the player three things in one sentence: other people have been here, they left things behind, and your failures will do the same. It's the hook in miniature.

### Error & Edge-Case Copy

Errors should maintain the game's voice. Don't break the fourth wall with technical jargon, but don't obscure what's happening either.

| Scenario | Copy |
|---|---|
| State loading failure | "The mountain remembers, but the clouds are thick. Retrying..." |
| Network error on mutation | "Your mark was placed, but the mountain hasn't noticed yet." |
| Redis timeout | "The stone is slow to respond. Give it a moment." |
| Unexpected state | "Something shifted. The mountain resets." |

---

## Key Technical Considerations

- **Centralize all copy strings.** Every player-facing string should live in one location — a constants file, a copy module, a strings map. Scattered string literals across components make auditing impossible and inconsistency inevitable. This also makes future localization (out of scope for v1, but worth not blocking) straightforward.

- **The copy generates comments without being the main content (§34).** The tone should make players want to screenshot a message and share it, not because it's trying to be viral, but because it's genuinely surprising or funny in context. "Bell Shaft has heard enough from you today" is the kind of line someone might post.

- **Short labels > long explanations.** The tower is legible, not annotated. If a player needs to read a paragraph to understand what happened, the copy failed. One line. Specific. Done.

- **Localization is out of scope for v1.** English only. But keeping strings centralized means localization is a future possibility without a rewrite.

- **Test copy in context, not in a spreadsheet.** A message that reads well in a document might feel wrong when it appears after a fall. Read every string in the moment it appears — after a death, on a banner, on the result card. Timing and context change how copy lands.

---

## How to Know It's Working

- Every player-facing string feels intentional. Nothing reads like a placeholder or a TODO.
- The tone is consistent: dry, specific, mildly cursed. Never generic ("Oops!"), never verbose ("You have fallen and your failure has been recorded in the zone counter..."), never mean ("You suck").
- Artifact names match across all surfaces — the in-game label says "Worn Step," the banner says "Worn Step," the result card says "Worn Step." No surface calls it "step_assist" or "Step Block."
- Badge display names are consistent — the HUD says "Restless," the banner says "Restless," the result card says "Restless." No surface shows the internal state name "Haunted."
- A player reading any mutation message understands exactly what happened (they fell), where it counted (which zone), and what it means for the tower (counter moved, artifact approaching or triggered).
- The opening message communicates the hook before the player presses a single key.
- Error messages maintain the mountain's voice — they don't break immersion with stack traces or generic browser errors.
