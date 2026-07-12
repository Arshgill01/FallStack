# Devvit CLI Diagnostics Pass

Date: 2026-07-12 18:49–19:02 UTC
Environment: Ubuntu VM, `@devvit/cli@0.13.7`, Node v24.18.0, authenticated as the Fallstack app owner.

## Method

Controlled alternate configuration files were created in the app root, passed explicitly through `--config`, and removed immediately after each experiment. Broken configurations were chosen so validation stopped before any version upload or installation change.

## Results

| Probe | Command result | Assessment |
| --- | --- | --- |
| Unknown top-level field | Exit 1 in ~5 seconds: `config is not allowed to have the additional property "unknownDiagnosticProbe"` | Good schema path and concise message; filename/line absent but not essential for this case |
| Menu endpoint without `/internal/` | Exit 1 in ~5 seconds: `menu.items[0].endpoint does not match pattern "^/internal/.+"` | Good exact object path and expected pattern |
| Missing custom server entry after successful build | Exit 2 after ~22.6 seconds total; later source inspection confirmed a fixed 10-second artifact poll, then a clear missing path but instruction to edit `devvit.json` | Core diagnosis good; wait and wrong config filename are actionable polish issues |
| Historical logs, human format | Printed a streaming banner after ~6 seconds, then waited without an empty-history/completion message | Connection is visible; history versus tail phase is not |
| Historical logs, JSON and verbose JSON | No bytes emitted for up to ~60 seconds; Ctrl+C exited 0 | Valid record-only JSONL, but unusable for determining readiness/empty history in automation |
| Documented `devvit build` | `Error: Command build not found.` | Direct current-docs error |
| App-name constraint | Docs: max 16; live schema and changelog: max 20 | Direct first-party source inconsistency |

## What worked well

- Schema validation happens before upload for structural errors.
- Error paths identify nested configuration locations such as `menu.items[0].endpoint`.
- The missing-artifact error includes the exact expected output path and explains the CJS/build relationship sufficiently to act.
- Human log mode names the app and subreddit, reducing wrong-installation debugging risk.

## Recommended package for the Devvit team

1. Add `devvit validate [--config path] [--artifacts]` with no remote mutation.
2. Generate duplicated constraint prose from `config-file.v1.json`; test docs code blocks against the released CLI command registry.
3. Carry the resolved `--config` filename through every diagnostic instead of hard-coding `devvit.json`.
4. When a one-shot build command exits, validate missing artifacts immediately or expose the wait duration and reason.
5. Add optional JSON lifecycle records for log connection, historical drain completion, heartbeat, reconnect, and terminal errors.

## Safety and cleanup

- No broken configuration reached upload.
- All three temporary `devvit.experiment-*.json` probes were deleted.
- The installed v0.0.14.4 playtest was not changed by this pass.
