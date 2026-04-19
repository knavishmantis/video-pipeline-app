Break the script of a short into scenes and create them via the MCP server. Ground the clipper/editor notes in the KnavishMantis house style AND in real Mogswamp precedents pulled from the competitor cut library.

## Steps

1. **Read BOTH style references** (mandatory before any drafting):
   - `script-guide/scene-prompt.md` — KnavishMantis structural rules: field semantics, preset catalog (real IDs), scene types, density targets, Bart-no-nametag, Flashback vocabulary, link_group conventions.
   - `script-guide/competitor-data/mogswamp/mogswamp-patterns.md` — Mogswamp craft playbook: pacing signature (~1s median cuts, 30-40 per short), text-overlay-on-85%+-of-cuts rule, IRL metaphor usage, opening/closing moves, persona framing, music-change-as-structure.

2. **Identify the short** — if a short_id was given as `$ARGUMENTS`, use that. Otherwise ask which short to work on.

3. **Get the short's script** via `mcp__video-pipeline__get_short`. If `script_content` is empty, tell the user the script needs writing first and stop.

4. **Draft a scene plan** applying BOTH rule sets:
   - **Structural (KM)**: scene density ~30-40 scenes; script_line 3-6 words verbatim from the script (never paraphrase); `direction` field stays blank (it's dead); `clipper_notes` is the main field; Bart Simpson = no nametag.
   - **Craft (Mogswamp)**: every cut should have a planned on-screen text overlay (word-by-word with narration). Include it in `clipper_notes` on its own line as `OVERLAY: "<2-4 word fragment>"`. Prefer the **persona walking-toward-camera** opening template. Cut length should feel ~1s per beat — if a scene's narration has a comma, that's a scene boundary.
   - **Preset usage**: ~10% of scenes. No forced opening/closing preset rule. Use them only where the script has a clear reaction beat. Always use a "No Nametag" variant. Preset 12 (Room Close Angle No Nametag) is the default pick.
   - **Link groups**: any time 2+ consecutive scenes share a filming setup (studio world build, specific mob encounter, a specific overworld location), assign them the same `link_group` using the `<location>_<descriptor>` convention.

5. **Classify each scene by sourcing path**:
   - **film-in-Flashback** (default) — the clipper records in-game
   - **source-external** — the beat calls for stock footage, a pop-culture reference, a meme, or another creator's clip. Cues: IRL metaphor (explosion, timelapse, black hole), named meme, movie reference, "here's the clip where…".

6. **Retrieve Mogswamp references** per scene — for each drafted scene, call `mcp__video-pipeline__find_similar_cuts_by_text` with:
   - `script_line`: the drafted script_line
   - `short_context`: one sentence summarizing the short's topic + what comes before/after
   - `k: 3`
   - `channel: "Mogswamp"`
   
   Inspect results. A "strong precedent" = similarity is clearly on-topic and `clip_type` fits your scene type.

7. **Integrate the retrieval into the draft**, behavior depends on sourcing path:
   - **film-in-Flashback scenes with a strong precedent**: append a citation line at the bottom of `clipper_notes`: `Reference: Mogswamp {youtube_video_id} at {timestamp} — {visual_description}. Match {pov} POV and {clip_type} style.`
   - **film-in-Flashback scenes with no strong precedent**: just write `clipper_notes` per the KM style guide; do not fabricate a reference.
   - **source-external scenes**: put 2-3 sourcing options in `editor_notes`. Format:
     ```
     [source-external]
     OPTION A: Mogswamp {yid} at {mm:ss} — https://youtube.com/shorts/{yid}?t={start_s}
       (his version: "{visual_description}")
     OPTION B: <search terms for editor to find original source>
     OPTION C: <alternative stock footage suggestion if applicable>
     ```
     Leave `clipper_notes` brief: `[source-external — see editor_notes for options]`.
   - Retrieved cuts with `clip_type IN ('pop-culture', 'irl')` are strong candidates for source-external treatment, since Mogswamp himself was sourcing externally for that beat.

8. **Show the full plan** as a numbered list. For each scene show: scene_order, script_line, scene type (preset/flashback/source-external), preset_id if applicable, link_group if applicable, and a one-line preview of clipper_notes + any Mogswamp reference. Then ask: **"Does this look right? I'll call `bulk_create_scenes` once you confirm."**

9. **Wait for explicit approval** ("yes", "go ahead", "looks good"). If the user wants changes, adjust and re-present. Do not auto-proceed.

10. **Call `mcp__video-pipeline__bulk_create_scenes`** with the full scenes array, including `preset_clip_id` and `link_group` where set.

11. **Report results** — confirm how many scenes were created. Note any scenes flagged `[NEEDS REVIEW]` or `[source-external]` so the user knows to check them in the app.

## Rules to follow

- Follow ALL rules in `script-guide/scene-prompt.md` exactly (real preset IDs 1-23, not 20-39)
- Never paraphrase `script_line` — copy verbatim from the script
- Leave `direction` empty — it's deprecated
- Every scene's `clipper_notes` should include an `OVERLAY: "..."` line unless it's a preset-only or source-external scene
- Bart Simpson = always NO nametag
- Only cite Mogswamp precedents that actually came back from `find_similar_cuts_by_text` — never invent cut_ids or timestamps
- When uncertain about a clipper scene, prefix `clipper_notes` with `[NEEDS REVIEW]`
