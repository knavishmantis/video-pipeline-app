Break the script of a short into scenes and create them via the MCP server.

## Steps

1. **Read the scene prompt reference** at `script-guide/scene-prompt.md` — this has all the rules, scene types, preset IDs, and the worked example. You MUST read this before proceeding.

2. **Identify the short** — if a short_id was given as `$ARGUMENTS`, use that. Otherwise ask the user which short to work on (they can check the URL in the app: `/short/123`).

3. **Get the short's script** — use `mcp__video-pipeline__get_short` with the short_id to retrieve `script_content`. If `script_content` is empty, tell the user the script needs to be written first.

4. **Plan the scene breakdown** — before calling the tool, write out your full scene plan as a numbered list so the user can review it. Show: scene number, script_line, scene type (preset/gameplay/studio/bart/editor-only), and which preset_id if applicable.

5. **Wait for user approval** — ask "Does this look right? I'll call bulk_create_scenes once you confirm." If the user says yes or go ahead, proceed. If they want changes, adjust the plan.

6. **Call `mcp__video-pipeline__bulk_create_scenes`** with the full scenes array, including `preset_clip_id` where appropriate.

7. **Report results** — confirm how many scenes were created and note any scenes you were uncertain about (flag them for the user to review in the app).

## Rules to follow

- Follow ALL rules in `script-guide/scene-prompt.md` exactly
- Never paraphrase `script_line` — copy the exact words from the script
- Always start with a preset (opening scene)
- Always end with a preset (punching or shaking head for the punchline)
- Insert a preset every 3–5 content scenes
- Bart Simpson = always NO nametag
- When uncertain about a clipper scene, write `[NEEDS REVIEW]` at the start of `clipper_notes` so the user knows to check it in the app
