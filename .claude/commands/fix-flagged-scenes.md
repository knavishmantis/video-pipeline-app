Find all scenes flagged as needing rework for a short and rewrite them.

## Steps

1. **Read the scene prompt reference** at `script-guide/scene-prompt.md`.

2. **Identify the short** — use `$ARGUMENTS` as the short_id, or ask the user.

3. **List all scenes** — call `mcp__video-pipeline__list_scenes` for the short.

4. **Find flagged scenes** — look for scenes where `needs_rework = true`. List them for the user:
   - Scene #N: "[script_line]" — current clipper_notes: "..."

5. **Rewrite each flagged scene** — for each flagged scene, generate new `clipper_notes`, `direction`, and `editor_notes` (keep `script_line` unchanged). Show your proposed rewrites to the user before applying.

6. **Apply the rewrites** — call `mcp__video-pipeline__update_scene` for each flagged scene with:
   - The new `clipper_notes`, `direction`, `editor_notes`
   - Set `needs_rework: false` to clear the flag

7. **Report** — confirm which scenes were updated.

## Notes

- Never change `script_line` — only rewrite the production notes
- If you're unsure about a rewrite, say so and ask the user for clarification before applying
- If no scenes are flagged (`needs_rework = false` on all), tell the user and list all scenes so they can decide what needs work
