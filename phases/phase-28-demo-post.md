# Phase 28 — Demo Post Preparation

> Prepare the public demo post so a judge understands the shared mutation hook from the first viewport.

---

## Context

Judging primarily evaluates the demo post. The post must be self-explanatory without a tutorial wall. The game itself carries the explanation: a tower already changed by community failure, then the judge's fall changes it again.

---

## What This Phase Builds

### Demo State Verification

Before posting, verify:

- Headline shows roughly `Today's tower has 37 failed climbs in it.`
- Starting viewport has 2-3 artifacts.
- One artifact has origin text.
- One zone is Haunted or Cursed.
- First fall produces concrete mutation feedback.
- No visible "demo mode" label.

### Post Copy

Keep the Reddit post text short:

- One sentence explaining the premise.
- One sentence inviting a climb.
- No long tutorial.

Example:

```text
Today's tower is already full of failed climbs. Add yours, or stabilize what the subreddit cursed.
```

The controls hint should live in the game UI.

### Target Subreddit / Test Flow

Prepare:

- test subreddit post for QA
- final public demo post
- known-good seed/date behavior
- fallback plan if daily rotation changes before judging

### Screenshot Checklist

Capture:

- first viewport
- first fall mutation feedback
- checkpoint or stabilization
- result card if reachable

These can feed the app listing and Devpost submission.

---

## Key Technical Considerations

- The post must work for a cold visitor with no context.
- Avoid explaining the whole design in post copy.
- Demo state must merge with real activity.
- If posting requires authenticated Reddit UI actions, leave that step to the human or document exact steps.

---

## How to Know It's Working

- A fresh visitor understands "the level is made of community failures" within 10 seconds.
- First input feels physical.
- First fall or clear visibly affects state.
- Mobile post view is playable.
- Screenshots show the hook without needing captions.

