# Visual redesign toolchain

| Tool | Owns | Does not own | Gate |
| --- | --- | --- | --- |
| Official Figma MCP and skills | Native canvas, three directions, components, tokens, art bible, selected shell measurements | Game art quality, physics, persistence | OAuth and native file creation |
| Scenario or Layer | Controlled source art for material, artifact, player, and effects families | Final unedited runtime assets or UI composition | Equal bake-off; select one |
| Phaser Editor v5 | Visual scene composition, asset packs, prefabs, particles, layout proof | Pure generation, game rules, server state | Phaser 4.2.1 compatibility proof |
| `$fallstack-art-director` | Sequence, invariants, scoring, decision record, vertical-slice constraint | Replacing user selection or bypassing accounts | Every stage |
| Playwright/Vite | Deterministic baseline and before/after evidence | In-Reddit authenticated QA | Each visual checkpoint |

The official Figma plugin is installed in the local Codex plugin cache and enabled. Its tools are unavailable to the current process until Codex restarts. The cached suite includes `figma-use`, `figma-create-new-file`, `figma-generate-design`, `figma-generate-library`, and design-to-code support; use the installed official suite rather than copying skills into the repository.

Do not introduce another component library, CSS framework, level editor, motion system, or asset provider during this workflow. The constraint is deliberate: each tool has one responsibility and must earn adoption with evidence.
