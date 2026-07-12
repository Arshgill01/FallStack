# Devvit Playtest Evidence — 2026-07-12

## Scope

Verify the current CLI build/upload loop and attempt to inspect Fallstack in the real Reddit host using the documented `?playtest=fallstack` URL.

## CLI result

- Command: `npm run dev` (`devvit playtest`)
- Authentication: CLI reported the account as `u/BrightyBrainiac` before this pass.
- Build output:
  - initial build: 3 ms
  - server rebuild: 972 ms
  - client rebuild: 1,442 ms
  - Vite repeated the existing chunk-over-500-kB warning
- Upload/update phase: approximately 30 seconds of an animated `Updating...` label with no phase or byte progress.
- Result: success, playtest version v0.0.14.4.
- URL: `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`
- Exit behavior: Ctrl+C stated that the playtest version remains installed and provided `devvit install fallstack_dev fallstack@latest` as the revert command, matching current documentation.
- Read-back verification:
  - `devvit list installs fallstack_dev` reported `fallstack (v0.0.14.4)`.
  - `devvit view fallstack@0.0.14.4 --json` reported upload time `2026-07-12T18:43:48.460Z`, successful build status, build completion at `18:43:54.149Z`, and public API version 0.13.7.

## Host-page result

Browser setup:

- `agent-browser@0.31.1`
- Chrome for Testing 150.0.7871.115
- `--no-sandbox` required because the Ubuntu VM disables the usable Chrome sandbox/user namespace path

Attempts:

1. Fresh named browser session.
2. Separate session using `/home/arshdeepsingh/.config/google-chrome` as the existing profile.

Both attempts loaded Reddit's network-security block page before subreddit content or the Devvit iframe appeared:

> You've been blocked by network security. To continue, log in to your Reddit account or use your developer token.

Evidence: [reddit-network-block.png](screenshots/reddit-network-block.png).

## Conclusions

- Proven: current source builds, uploads, and installs as a real playtest version.
- Proven: CLI build timing is separated into server and client phases.
- Observed rough edge: the materially longer remote update phase exposes no phase, bytes, or elapsed-time detail. This is not yet a submission-primary complaint because it completed successfully and was only measured once.
- Not proven: real-host rendering, inline-to-expanded navigation, client-log forwarding, live endpoint behavior, mobile host layout, or Redis mutation behavior.
- Required next step: open the playtest URL in a logged-in human browser (or use a documented safe developer-token browser setup) and capture host-level evidence. Do not treat local/static smoke as equivalent.
