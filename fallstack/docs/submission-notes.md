# Fallstack Submission Notes

## App Listing Draft

- Title: `Fallstack`
- Short description: `A daily shared climbing game where failed jumps become tomorrow's footholds, hazards, and subreddit memory.`
- Category: Game
- Screenshots to capture:
  - First viewport with `Today's tower has 37 failed climbs in it.`
  - A fall feedback banner after a counted mutation.
  - The daily result card with most cursed zone and useful artifact.

Prepared static browser captures:

- `docs/screenshots/fallstack-first-viewport-static.png`
- `docs/screenshots/fallstack-result-static.png`

## Human-Only Steps

- Submit the app listing on developer.reddit.com.
- Create the public demo post from the moderator menu in the target subreddit.
- Add the final demo post URL to the hackathon submission.
- Record/upload the demo video if required. This phase is intentionally left to the human owner.

## Current Playtest Evidence

- Devvit CLI authenticated as `u/BrightyBrainiac`.
- Latest observed playtest URL: `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- The app uses Devvit Web entrypoints only, with Phaser bundled through Vite in the expanded `game` entrypoint.

## Final QA Evidence

- `npm test`: passes 8 pure game-logic tests covering daily seeds, seeded hook state, status display labels, artifact caps, feedback copy, tower bounds, and zone progression.
- `npm run lint`: passes with non-blocking Fast Refresh warnings on Vite entrypoint files.
- `npm run build`: passes; Vite still warns that the Phaser client chunk is larger than 500 kB.
- `npm run dev`: last verified playtest succeeded at version `v0.0.1.7`.
- Static browser smoke with Playwright/Chrome: `game.html` renders a nonblank Phaser tower, seeded local fallback state, an enabled result card, and a readable result dialog when `/api/init-game` is unavailable.
- Real Reddit playtest browser inspection from this VM is blocked by Reddit network security with HTTP 403 before the post loads; use a logged-in human browser for final in-Reddit visual QA.

## Remaining Owner Checks

- Open the playtest URL on an actual phone and logged-in desktop browser.
- Capture final production screenshots inside the real Devvit playtest post.
- Submit the app listing and public demo post.
- Record the demo video if the submission requires it.
