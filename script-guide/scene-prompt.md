# Scene Breakdown Reference — KnavishMantis

*Last refreshed 2026-04-19 from the 339 scenes across the 10 most recently uploaded shorts. Revisit every ~20 new shorts to keep style current.*

Use this file every time you are asked to break a script into scenes. Read it fully before calling `bulk_create_scenes`.

---

## What a Scene Is

Each scene = **one visual clip** the clipper records in Flashback (Minecraft replay mod) or the editor sources externally. Scenes are granular — one phrase of narration per scene, not one sentence.

### Fields

| Field | Usage | Notes |
|-------|-------|-------|
| `script_line` | 100% | 3-6 words is typical (63% of scenes). Copy narration verbatim — never paraphrase. Split at natural breath/phrase boundaries. Occasionally 7+ words if the phrase must land together (27% of the time). Rarely 1-2 words for punctuation beats. |
| `clipper_notes` | 98% | **The main field.** Detailed instructions the clipper reads while recording in Flashback. Specifics > brevity. Median ~93 chars. For preset-reaction scenes, write `No clip`. |
| `editor_notes` | 19% | Only when there's something specific for post: preset overlays, SFX, slow-mo timing, attached external media, compositing cues. Leave blank otherwise. |
| `preset_clip_id` | ~10% | A pre-recorded KM reaction clip (see table below). Use sparingly as reaction punctuation. |
| `link_group` | 36% | **Heavily used.** Groups scenes that share a filming location/setup so the clipper films them in one session. Name it descriptively (see examples below). |
| `direction` | **0% (dead)** | The `direction` field is no longer used. Don't fill it. Everything that would have gone there goes in `clipper_notes` instead. |

---

## Scene Density

- Median scenes per short: **36** (range 23-46)
- Average script_line: **5.2 words**, median 5
- Target: **one phrase per cut** — if a sentence has two beats, it gets two scenes
- Most shorts have ~30-40 scenes. A 25-scene short is on the low end; 40+ means a content-heavy one

---

## Preset Clips (reaction cutaways)

Presets are pre-recorded KnavishMantis reactions. Current conventions:

- **All recent presets used are "No Nametag" variants.** Nametag-on variants exist but aren't being used in current shorts.
- Only ~10% of scenes use a preset — don't force them into every gap.
- **No strict opening/closing rule.** 0/10 recent shorts open with a preset; only 3/10 close with one. Use presets only when the script has a clear reaction beat (affirmation, disapproval, revelation, direct-to-camera aside).
- When a scene uses a preset: set `preset_clip_id`, write `clipper_notes: "No clip"` (the clipper skips it), and optionally write `editor_notes: "linked preset"` or specify compositing cues.

### Preset catalog (real DB IDs)

| ID | Label | When to use |
|----|-------|-------------|
| **12** | Room Close Angle No Nametag | **Most used.** Direct-to-camera reaction beats, asides, "let me tell you" moments. Default pick when you want a reaction. |
| 13 | Room Nodding No Nametag | Affirmation, "yes exactly", emphasizing a point the narration just made |
| 15 | Room Punching No Nametag | Revelation, excitement, "boom" / "gotcha" moments |
| 17 | Room Shaking Head No Nametag | Disapproval, "this is broken", ironic disagreement |
| 19 | Room Shifting No Nametag | Neutral transition, conversational, setup beat |
| 4 | Magenta Nodding No Nametag | Affirmation with chromakey for compositing over another clip |
| 6 | Magenta Punching No Nametag | Excitement with chromakey for compositing |
| 8 | Magenta Shaking Head No Nametag | Disapproval with chromakey for compositing |
| 10 | Magenta Shifting No Nametag | Transition with chromakey for compositing |
| 22 | Magenta Talking No Nametag | Direct address with chromakey — used for "let me explain" popovers over another clip |
| 20 | "He's Toast" | Character-death/failure sting |
| 23 | Villagers Working At Computers | Specific meme/joke preset |

Nametag variants (IDs 2, 11, 14, 16, 18, 3, 5, 7, 9, 21) exist but are not in current use. Prefer No Nametag.

**Room vs Magenta**: Default to Room. Use Magenta when the editor will composite the reaction *over* another clip (picture-in-picture, corner pop-up, split-screen).

---

## Scene Types

### 1. Preset scene
```
preset_clip_id: <id>
clipper_notes: "No clip"
editor_notes: "linked preset" or specific compositing cue
```

### 2. Studio world scene (very common)

The user's primary visual workspace is a **superflat studio world** — a clean void backdrop for isolated demos, staged builds, and visual gags.

**Template:**
```
Show <subject> in a studio world<, optionally with NoAI / command block / TrackEntity note>
```

**Real examples from recent shorts:**
- `"Show iron golem walking around in a studio world using TrackEntity in flashback"`
- `"Show a bunch of blue sheep walking around in a studio world"`
- `"Show '63' built out of blocks in a studio world"`
- `"Show an evoker doing the wololo attack in a studio world (Put a blue sheep next to it and it turns it red, thats the attack)"`
- `"Show a grid of sheep spawned with NoAI in a studio world (about 30-40) and some of them are blue"`

### 3. Overworld/biome gameplay scene
```
Show <action> in <biome/location>
```

**Real examples:**
- `"Show my character dying in the overworld with a bunch of items (you'll need to duplicate these items later so probably easier to pick them up after you die)"`
- `"Show flying around in a world and seeing the chunks load in (you'll need to remove the distant horizons mod for this)"`

### 4. "Walking toward camera" scene (recurring opener/transition)

**Template:**
```
Show my character walking towards the camera [in <location> / infront of <previous build>]
```

Used as opening scenes, transitions, and sign-offs. Variations reference earlier scenes by number (`infront of scene from #11`).

### 5. Bart Simpson character scene (recurring "the audience/the generic player")

Bart Simpson skin = stand-in for "you" or "the average player." **Always no nametag.** Just the skin.

**Real examples:**
- `"Show character with Bart Simpson skin spawning in (no nametag) from a couple blocks in the air like they are popping into existence"`
- `"Show the bart simpson character (no nametag) just the skin doing some common minecraft stuff like farming crops or mining sand"`
- `"Show the Bart Simpson skin character on the player's side of the board (no nametag) (representing You/audience) then a bunch of anvils fall on them killing them"`

### 6. Multi-part scene (same setup, different export)

When one Flashback recording supports multiple narration beats or needs both normal + slow-mo:

```
7a and 7b. Its the same clip but exported differently. It'll show <action>. 7a is <first variant>, 7b is <second variant, e.g. slow-mo>
```

Real example:
- `"4a and 4b. Show an iron golem standing in a studio world NoAI, And above them have first 4 red blocks 1 block apart above them representing 4 hearts. Then 4b show now its 11 hearts. Have the camera in the same spot between the two frames"`

### 7. Editor-only / external-clip scene

When the scene needs stock footage, a pop-culture reference, or another creator's clip:

```
clipper_notes: [source-external — see editor_notes for options]
editor_notes: <OPTION A/B/C with specific links or search terms>
```

---

## Flashback-specific terminology the clipper knows

Use these terms directly in `clipper_notes` when applicable:

- **TrackEntity** — Flashback feature that locks the camera to follow an entity (mob or player). Used when the subject is moving.
- **NoAI** — Spawn mobs with `{NoAI:1b}` so they stand still for staged shots.
- **Command blocks / repeating command blocks** — used to mass-spawn mobs for visual density ("a bunch of bees" = ~50-100, "a grid of sheep" = 30-40)
- **First person / third person** — explicit in notes when it matters
- **Nametag ON/OFF** — only specify when the default (OFF for Bart, character-only) isn't clear

---

## Link Groups

Groups scenes that share a filming location/setup so the clipper can shoot them in one session without moving or rebuilding. **36% of scenes use a link_group.**

**Naming convention:** `<location/setup>_<descriptor>` — lowercase, underscores.

**Real examples from recent shorts:**
- `studio_chess_world` (23 scenes) — the recurring chess-piece-grid studio
- `tik_tak_toe_arena` (13) — a custom tic-tac-toe studio build
- `overworld_dupe_glitch` (11) — scenes tied to a specific overworld death/dupe setup
- `enderman_studio_setup` (10)
- `iron_golem_studio` (7)
- `nether_ghast_fight` (4)
- `warden_fight`, `village_death_scene`, `furniture_mod_pc_setup`

**When to use a link_group:**
- Any time 2+ scenes happen at the same built location or studio setup
- Any time a specific mob/entity needs to be spawned with specific config that would be painful to reproduce
- Any time scenes cross-reference each other via `infront of scene #X`, `same as #X`, `different angle of #X`

---

## Editor notes conventions

Use `editor_notes` only when there's something specific. Common patterns:

- **Preset reference:** `Show preset #2 room close no nametag`, `show preset #6 nodding`, `show shaking head preset like shaking their head "no not this one though"`
- **Compositing cue:** `show my character nodding from bottom like they're nodding in approval`, `pop up like my character talking to the camera over the clip`, `on the bottom half of the screen`
- **Boilerplate for preset scenes:** `linked preset`
- **SFX / visual effect:** `use slow mo for 'throws you in the air'`, `Could have like the pokemon confusion bird effect`, `When I say cool, could have cool sunglasses animate onto them`
- **External media:** `I've attached an mp4 of <thing>, use for the parts where...`
- **Close-up cue:** `Close up zoom on my character's face if needed`

Speak to the editor casually but specifically. If you're uncertain, err on concrete visual direction.

---

## Rules that still hold

- **Never paraphrase `script_line`** — copy the exact words from the script
- **Bart Simpson = always NO nametag.** The skin alone. Never with a nametag.
- **One phrase per scene.** If the narration has a comma or natural pause, that's probably a scene boundary.
- **Number-reference earlier scenes** when camera or setup should match — e.g. `infront of the scene from #11`, `different angle of the loot from #13`.
- **Multi-part naming:** `4a and 4b`, `7a and 7b` for same-take clips that will be used as separate beats.
- When uncertain about a clipper scene, prefix `clipper_notes` with `[NEEDS REVIEW]` so the user knows to check it in the app.

---

## Worked example — three consecutive scenes

From short #97 (*"One of the Oldest Bugs is Still Active"*):

**Scene 3:**
- `script_line`: `"Bug #63 was"`
- `link_group`: `studio_number_63_build`
- `clipper_notes`: `Show '63' built out of blocks in a studio world`

**Scene 4:**
- `script_line`: `"literally submitted on the first day"`
- `preset_clip_id`: `12` (Room Close Angle No Nametag)
- `clipper_notes`: `No clip`
- `editor_notes`: `linked preset`

**Scene 6:**
- `script_line`: `"Which is before"`
- `link_group`: `studio_number_63_build` (same setup as #3)
- `clipper_notes`: `Show my character walking towards the camera in a studio world infront of the blocks making #63 (back in the normal version now)`

That's the pattern: tight 3-6 word script_lines, studio-world demos as the backbone, sparse preset reactions, link_group ties related-setup scenes together, scene-number cross-references for camera continuity.
