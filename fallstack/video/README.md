# Fallstack pitch video

A 58-second, board-only Remotion pitch cut assembled from a real production-build playthrough.

From `fallstack/video/`:

```sh
npm install
npm run capture
npm run assets
npm run score
npm run type-check
npm run render
npm run verify
```

`npm run capture` builds the game, serves `dist/client`, and drives the real Phaser tower from the opening fall to the summit. Generated footage, stills, and audio stay under `public/generated/`; the final deliverable is `output/fallstack-pitch.mp4`.

The soundtrack is a custom 58-second edit of “Forest Walk” by Eugenio Mininni, used under the Mixkit Stock Music Free License. `scripts/generate-score.mjs` downloads the reviewed source, verifies its checksum, trims the selected passage, and masters it for the pitch cut. See `MUSIC.md` for provenance and edit details.
