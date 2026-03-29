# Scene Breakdown Reference — KnavishMantis

Use this file every time you are asked to break a script into scenes. Read it fully before calling `bulk_create_scenes`.

---

## What a Scene Is

Each scene = **one visual clip** the clipper records in Flashback (Minecraft replay mod) or the editor sources externally. Scenes are granular — one phrase, not one sentence.

### Fields

| Field | Purpose | Notes |
|-------|---------|-------|
| `script_line` | Exact narration words spoken during this clip | 3–10 words. Split at breath/phrase boundaries. |
| `direction` | One-line visual summary for the editor | e.g. "wide village establishing shot", "KM close up nodding" |
| `clipper_notes` | Full instructions for the clipper — what to build, where, which skin, which angle, what action | Most important field. Be specific. |
| `editor_notes` | Post-production notes — SFX, transitions, overlays, timing, external media | Only include when there's something specific. |

---

## Scene Types

### 1. Preset Clip (pre-recorded loop)
Use `preset_clip_id` and keep `clipper_notes` minimal ("use preset"). These are pre-recorded KnavishMantis reactions. Use them for:
- Opening scene of the short
- After each major topic transition (every 3–5 content scenes)
- Single punchy lines where a character reaction beats custom footage
- Whenever KnavishMantis needs to "react" to what was just explained

**Available presets — choose the right emotion:**

| ID | Label | Description | Use when |
|----|-------|-------------|----------|
| 20 | 1 — Room Nodding Nametag | KM nodding in room, with nametag | Agreeing, confirming something good, emphasis |
| 21 | 2 — Room Nodding No Nametag | KM nodding in room, no nametag | Same but no nametag wanted |
| 22 | 3 — Room Punching Nametag | KM punching toward cam, nametag | Excitement, revelation, "boom" moment |
| 23 | 4 — Room Punching No Nametag | KM punching, no nametag | Same without nametag |
| 24 | 5 — Room Shaking Head Nametag | KM shaking head, nametag | Disapproval, "this is wrong", ironic reaction |
| 25 | 6 — Room Shaking Head No Nametag | KM shaking head, no nametag | Same without nametag |
| 26 | 7 — Room Shifting Nametag | KM shifting, nametag | Conversational, neutral setup, transition |
| 27 | 8 — Room Shifting No Nametag | KM shifting, no nametag | Same without nametag |
| 28 | 9 — Room Close Angle Nametag | KM close-up, nametag | Intimate, confessional, "let me tell you" |
| 29 | 10 — Room Close Angle No Nametag | KM close-up, no nametag | Same without nametag |
| 30 | 11 — Magenta Nodding Nametag | KM nodding, magenta bg, nametag | Same as #1 but for chromakey/editor effects |
| 31 | 12 — Magenta Nodding No Nametag | KM nodding, magenta, no nametag | |
| 32 | 13 — Magenta Punching Nametag | KM punching, magenta, nametag | |
| 33 | 14 — Magenta Punching No Nametag | KM punching, magenta, no nametag | |
| 34 | 15 — Magenta Shaking Head Nametag | KM shaking head, magenta, nametag | |
| 35 | 16 — Magenta Shaking Head No Nametag | KM shaking head, magenta, no nametag | |
| 36 | 17 — Magenta Shifting Nametag | KM shifting, magenta, nametag | |
| 37 | 18 — Magenta Shifting No Nametag | KM shifting, magenta, no nametag | |

**Nametag rule**: Use "Nametag" when KnavishMantis is the direct speaker/narrator. Use "No Nametag" when acting as a character or when the nametag would be distracting.

**Room vs Magenta**: Default to Room. Use Magenta when the editor will be compositing something behind/around the character.

---

### 2. Flashback Gameplay Scene (most common)
Recorded in Flashback (Minecraft replay mod). The clipper needs to know:
- **Location/biome**: what Minecraft world/biome/structure to film in
- **Action**: what is happening (walking, building, fighting, opening chest, etc.)
- **Skin**: always KnavishMantis skin unless specified otherwise
- **Nametag**: include or omit depending on whether it should show
- **Camera angle**: wide establishing / medium / close-up / aerial / first-person
- **Framing**: portrait (9:16), leave room at top/bottom for text

**Template:**
```
[KnavishMantis skin, nametag ON/OFF] [action] in [location]. [camera angle] shot. [any specific timing or action detail].
```

**Examples:**
- "KnavishMantis skin, nametag ON. Walking toward camera in a plains village. Medium shot."
- "KnavishMantis skin, nametag OFF. Opening an enchanting table. Close-up on the table. Show the enchantments appearing."
- "KnavishMantis skin, nametag ON. Standing in front of a netherite sword item frame. Wide shot, character facing camera."

---

### 3. Studio World Scene
Built in a superflat creative world for abstract visuals — numbers, comparisons, labeled builds.

**When to use**: Explaining abstract mechanics, showing comparisons between two things, displaying stats/numbers as block builds, item frame displays.

**Template:**
```
Studio world. [What is built/displayed]. [Any labels or signs]. [Camera angle].
```

**Examples:**
- "Studio world. Two identical houses side by side — one labeled 'Plains' in block letters, one labeled 'Snowy'. Wide aerial shot."
- "Studio world. Item frame showing a diamond sword on a wall. Close-up shot."
- "Studio world. Block text reading '2.5 BILLION'. Medium shot with KM standing next to it."

---

### 4. Bart Simpson Scene
The recurring foil character. Always: **Bart Simpson Minecraft skin, NO nametag**.

**Common uses**:
- At a lectern giving the "wrong take"
- Standing confused or surprised
- Doing something the audience might do wrong
- Reacting to a reveal

**Template:**
```
Bart Simpson skin, NO nametag. [action/position]. [location]. [camera angle].
```

---

### 5. Editor-Only Scene (external media)
No Flashback recording needed. The clipper doesn't touch this.

```
clipper_notes: "N/A — editor handles. [description of what to source]"
editor_notes: "[Where to find it, what it is, how to use it]"
```

Use for: Sora AI clips, YouTube clips, memes, real-world footage references, text overlays.

---

## Splitting Rules

1. **Split at breath/phrase boundaries** — not sentence boundaries. One scene = one thought unit the viewer sees as a single clip.
2. **Target 3–8 words per `script_line`**. A 15-word sentence = 2–3 scenes.
3. **A 200-word script → ~20–35 scenes.**
4. **Parentheticals** like `(pause)`, `(Vsauce music)`, `<show Bart>` = their own scenes with `script_line` matching the cue.
5. **Sub-clips** — if a scene needs multiple quick cuts, use sub-clips noted in `clipper_notes`: "Sub-clip A: ..., Sub-clip B: ..."

---

## Scene Rhythm Pattern

Follow this rhythm to ensure visual variety:

```
Scene 1:        PRESET (opening — establish KM as narrator)
Scenes 2–4:     GAMEPLAY (topic content, show what's being described)
Scene 5:        PRESET or TALKING-TO-CAMERA (reaction / transition beat)
Scenes 6–9:     GAMEPLAY or STUDIO WORLD (next topic section)
Scene 10:       PRESET (mid-video energy reset)
Scenes 11–14:   GAMEPLAY (deeper content)
Scene 15+:      GAMEPLAY leading to dramatic payoff
Final scene:    PRESET (punching or shaking head — land the punchline)
```

---

## Worked Example

**Script fragment**: *"What time period is Minecraft based on? Abandoned Mineshafts, shipwrecks, and trial chambers show the existence of a collapsed society. All that's left are small villages surrounded by barbarians."*

| # | script_line | direction | clipper_notes | editor_notes | preset_clip_id |
|---|-------------|-----------|---------------|--------------|----------------|
| 1 | What time period is Minecraft based on? | KM shifting in room | — | — | 26 (Room Shifting Nametag) |
| 2 | Abandoned Mineshafts, shipwrecks, | quick cuts of structures | Sub-clip A: interior of abandoned mineshaft, aerial angle. Sub-clip B: shipwreck underwater, medium shot. | Fast cut between A and B | — |
| 3 | and trial chambers | trial chamber | KnavishMantis skin, nametag OFF. Standing at the entrance of a trial chamber. Wide shot from outside looking in. | — | — |
| 4 | show the existence of a collapsed society | wide ruined landscape | Wide aerial shot of an ancient city or overgrown ruins. No character visible. | Could add dramatic music sting | — |
| 5 | All that's left are small villages | village wide shot | Wide establishing shot of a plains village from a distance. KnavishMantis skin, nametag ON, standing in foreground looking toward village. | — | — |
| 6 | surrounded by barbarians | pillagers outside village | KnavishMantis skin, nametag OFF. Pillagers visible at the edge of a village. Medium shot showing both village and pillagers. | — | — |

---

## Quality Checklist Before Submitting

- [ ] Every scene has a specific, actionable `clipper_notes` (not vague like "show Minecraft")
- [ ] Preset clips are used at the opening and after every 3–5 content scenes
- [ ] `script_line` matches the actual script word-for-word (no paraphrasing)
- [ ] Sub-clips noted inline in `clipper_notes` where multiple angles needed
- [ ] Bart Simpson scenes always say "NO nametag"
- [ ] Final scene has a preset (punching or shaking head) to land the punchline
- [ ] Total scene count is proportional: ~1 scene per 6–8 words of script
