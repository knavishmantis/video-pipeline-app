# KnavishMantis Script Writing Guide

Claude assists with writing scripts and breaking them into scenes for the KnavishMantis Minecraft YouTube Shorts channel. Below is a detailed guide derived from analyzing 28+ produced scripts and 5 fully broken-down scene sheets.

## Channel Identity & Voice

- **Persona**: KnavishMantis — comedic, opinionated, slightly unhinged Minecraft commentary
- **Recurring character**: "Bart Simpson" (a Bart Simpson MC skin, no nametag) used as a stand-in for "the audience", "your friend", "a commenter", or a comedic foil
- **Tone**: Conversational, uses rhetorical questions, builds tension then subverts expectations. Mixes real Minecraft mechanics/code analysis with absurd humor and historical/pop-culture analogies
- **Target**: Minecraft players who enjoy both game knowledge and comedy

## Script Structure (The Formula)

Every script follows a consistent pattern:

1. **Hook (1-2 sentences)**: Open with a provocative question or surprising claim. Almost always starts with the title rephrased as a question or statement.
   - "Why did Notch sell Minecraft?"
   - "Iron golem farms are the best way to get iron, right? There's a problem here..."
   - "Camman18 doesn't make much money from Youtube right?"
   - "The best way to trade with villagers is to first kill them..."

2. **Setup / Conventional Wisdom (2-4 sentences)**: Present what most people think or the obvious answer, then challenge it.
   - "You might think..." / "You're probably saying..."
   - Often uses the Bart character to voice the "wrong" take

3. **Core Content (3-6 paragraphs)**: The actual explanation — mechanics, history, code analysis, or argument. Structured as a chain of reveals, each building on the last. Uses specific numbers, game code references, and comparisons.

4. **Twist/Punchline Ending (1-2 sentences)**: Almost every script ends with either:
   - A comedic callback or absurd escalation
   - A cliffhanger ("So did all that pressure cause Notch to sell for too little?")
   - An unexpected final fact
   - A dramatic visual moment (throne room, fireworks, war scene)

## Script Content Patterns

**Length**: 150-350 words for the narration. Scripts are meant to be read aloud in 45-90 seconds.

**Parenthetical directions** appear inline in the script for the editor:
- `(Boos)`, `(Vsauce music)`, `(awkward pause, crickets)`, `(remove this part depending on short length)`
- `<show the dexter morgan shrug>`, `<Bart Simpson> "What's wrong with the sniffer?"`
- These indicate sound effects, visual gags, or non-narration moments

**Topic categories** (in order of frequency):
1. **Game mechanics deep dives**: How specific MC systems actually work in the code (luck potions, villager spawning, silverfish behavior, witch AI)
2. **Opinionated takes**: "I hate the elytra", "Sniffers are useless", "Iron golem Valhalla"
3. **Minecraft history/business**: Notch selling, Hytale development, single-threading mistake, Camman18 earnings
4. **Hypothetical/creative**: "What if the community united to break the game", "Would Plains or Snowy village win a war", "What time period is Minecraft set in"
5. **Practical guides**: Best way to get diamonds, music disks, dog breeds, village protection

**Recurring rhetorical devices**:
- "You might think X but actually Y" (used in nearly every script)
- Escalating absurdity — starts grounded, goes off the rails (iron golem Valhalla, CIA proxy wars)
- Real-world analogies for game mechanics (Ottoman raiders = pillagers, Henry Ford = work week)
- Addressing the audience directly: "And you might think that's probably because the devs did this for some good reason right? But actually no!!"
- Callbacks to channel lore: references to previous shorts, the Sniffer, Bart character

## Scene Breakdown Guide

When breaking a script into scenes, each scene = one visual clip the clipper needs to record. Scenes are granular — typically one sentence or even half a sentence per scene.

**Scene fields**:
- `script_line`: The exact narration text this clip accompanies
- `clipper_notes`: Detailed instructions for what to record in Flashback/OBS. This is the primary instruction field.
- `editor_notes`: Post-production instructions (SFX, transitions, overlays, timing)

**Scene patterns from produced shorts**:

1. **"Talking to camera" scenes**: ~25% of scenes. KnavishMantis character walking toward camera or standing close to camera, usually in front of the previous scene's set.
   - "Show my character walking towards the camera"
   - "Show my character close up on the camera"
   - "Show my player infront of [previous scene] looking at the camera"

2. **Studio world scenes**: ~20%. Built on a superflat "studio" world for isolated visual gags.
   - "In a studio world, show..." — chess boards, item frame displays, number/word builds in blocks, timelapse builds

3. **Gameplay demonstration scenes**: ~25%. Showing actual mechanics being performed.
   - "Show my character riding a horse", "Show opening a loot chest", "Show a skeleton killing a creeper"

4. **Timelapse/build scenes**: ~15%. Time-compressed building or world changes.
   - "Show timelapse of building a dirt bridge", "timelapse of burning the outpost"

5. **Bart character scenes**: ~10%. The recurring "other person" character.
   - "Show the Bart Simpson character (no nametag, just the skin)..."
   - Used for: audience reactions, the "friend", someone giving wrong takes at a lectern

6. **Pop culture reference scenes**: ~5%. References to external media for editor to incorporate.
   - Sora AI-generated clips, Rick and Morty scenes, Attack on Titan clips
   - These have no clipper work, just editor notes with links

**Scene granularity**: One clip per phrase, not per sentence. A single sentence like "When a skeleton kills a creeper, they are guaranteed to drop a music disk" becomes 2 scenes: one for the killing, one for the drop. Longer explanatory sentences can be one scene.

**Sub-clips**: Complex scenes use suffixed clips: `4a`, `4b`, `4c` for multiple angles or sequential shots within one scene.

**Cross-references**: Scenes frequently reference other scene numbers: "Show my character infront of the scene from #8", "Same flashback clip from #27 but slow mo". The clipper should read ahead and group related shots.

**Editor notes patterns**:
- Timing: "Try to have this clip end right as the tnt explodes"
- Overlays: "Could have an anger emoji over the creeper", "have Iraq map image pop up quickly"
- Transitions: "Could have a vertical transition"
- Sound: "Jet noise or bird noise could be funny here", "war noises, sword slashing, yells"
- Reuse: "Can reuse the same scene from #8 and have like an X crossing it out"

## How to Help Write Scripts

When asked to write or help with a script:

1. **Match the voice**: Conversational, uses "you", rhetorical questions, specific numbers/mechanics, comedic escalation
2. **Start with the hook**: Rephrase the title as a provocative question or surprising claim
3. **Use "Let me explain." after provocative hooks**: This 3-word bridge buys viewer trust (learned from DashPum4)
4. **Include inline directions**: Use parentheticals for SFX/visual gags, angle brackets for character dialogue
5. **Target 150-250 words**: Shorter is better. If it can be said in 150 words, don't use 300. (camman18 averages 126 words)
6. **Include 2-3 specific numbers/stats**: Every script needs quantified facts, not vague claims ("1 in 300 chance", "144 kills", not "really rare")
7. **Use 2-3 "But" pivots**: Each one redirects the viewer's expectation and adds a new layer
8. **Add anticipated objections**: At least once per script, voice what the viewer is thinking: "You're probably thinking..." then refute it
9. **Mix authority with hedging**: Mostly authoritative, but sprinkle occasional "I think", "honestly", "I don't know" to stay conversational
10. **End on the strongest beat**: Either a dramatic payoff, comedic punchline, or abrupt mid-sentence cutoff. Never a soft landing.
11. **Don't be generic**: Reference specific Minecraft versions, mob stats, code behavior, update numbers

### Structural Templates (from competitor analysis)

**Template A: Claim-Complicate-Escalate** (camman18 style, 100-150 words)
> Bold claim → Initial explanation with numbers → "But" complication → "But" deeper layer → Trailing punchline or cutoff

**Template B: Escalating "But" Chain** (DashPum4 style, 150-220 words)
> Provocative hook → "Let me explain." → "First..." → "But even better..." → "But best of all..." → End on strongest beat

**Template C: Problem-Solver with Absurd Escalation** (KnavishMantis signature, 200-300 words)
> Provocative question → Conventional wisdom challenged → Core explanation with reveals → Comedic/dramatic twist ending

**Template D: Rabbit Hole** (MogSwamp style, 200-300 words)
> Mundane starting point → Unexpected depth/connection → Real-world analogy → Philosophical or comedic payoff

## How to Help Break Scripts into Scenes

When asked to create a scene breakdown:

1. **Split at phrase boundaries**, not sentence boundaries. Each clip should be 2-5 seconds of narration.
2. **Write detailed clipper notes**: Describe exactly what to build, where, what skins/armor to wear, what angle. Reference the flashback formula guide's shot types.
3. **Include editor notes sparingly**: Only when there's a specific SFX, transition, overlay, timing requirement, or external media reference.
4. **Use studio world for abstract concepts**: Numbers, equations, item displays, visual metaphors.
5. **Add "talking to camera" scenes** at transitions between topics (every 3-5 content scenes).
6. **Reference scene numbers for continuity**: "Same scene as #8 but different angle", "Show my character infront of the scene from #12".
7. **Specify sub-clips** (a, b, c) when a scene needs multiple angles or sequential shots.
8. **Include links** to builds, reference videos, or external media when relevant.
