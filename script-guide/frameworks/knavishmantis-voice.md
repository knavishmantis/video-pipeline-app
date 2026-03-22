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

## Idea Evaluation Criteria (Gate Before Writing)

Before writing a script, every idea must pass these checks. If it fails 2+, don't make the short.

| Criteria | Pass | Fail |
|----------|------|------|
| **In-game content?** | Mechanics, mobs, items, builds, game code | YouTube drama, dev history, outside-game concepts |
| **Genuinely interesting to you?** | You'd watch this short yourself | You're making it because it "should" be viral |
| **Enough substance?** | 3+ genuinely surprising facts or a full narrative arc | One fact stretched, or padding needed to hit 60s |
| **Strong visual potential?** | Can be shown with in-game builds, mobs, items | Needs abstract visualizations, external footage, or talking head |
| **Clear viewing need?** | Mystery ("what is it?"), useful ("how do I?"), controversy ("is this true?") | Just informational with no hook tension |
| **Has a payoff?** | A reveal, twist, or punchline that rewards watching to the end | Ends with a summary, caveat, or soft landing |

**Idea rating shortcut** — score 1-10 on: (1) how interesting is the hook alone, (2) how dense is the content, (3) how strong is the ending. Average below 7 = rethink the idea.

## Winning Script Template

Based on the highest-rated shorts (horse armor 9/10, best potion 10/10, time period 10/10, luck potion, dog breeds, dolphins, wandering trader):

```
[HOOK — 1-2 sentences, first 5 seconds]
Provocative question OR surprising claim that creates immediate curiosity.
"What is the lowest IQ mob in Minecraft?"
"Dolphins in Minecraft have a big problem: They drown themselves."

[BRIDGE — 1 sentence]
"Let me explain." / Challenge conventional wisdom / "You're probably thinking X..."

[CORE — 3-5 beats, connected by BUT/THEREFORE/SO]
Beat 1: First interesting fact with specific numbers from code/mechanics
  → BUT/THEREFORE →
Beat 2: Complication or deeper layer that reframes Beat 1
  → "But what's even crazier..." →
Beat 3: The real revelation or the step-by-step payoff
  → (optional) "But there's one more thing..." →
Beat 4: Final twist, callback, or escalation

[ENDING — 1-2 sentences, strongest beat of the short]
Dramatic payoff / comedic punchline / abrupt cutoff / energetic closer
"its The Squid!!!"
"Mojang what are you doinngggggg?!?!?!?!"
"adding a bonus of ZERO everytime FOR NO REASON!!!"
```

**Every transition between beats MUST be BUT, THEREFORE, or SO — never AND.**

**Personality checklist**: 2-3 brief (~2 second) personality moments spread throughout. Never tangents. Examples that work: "or just the stables is fine", "carrier strike group of dogs", "Wandy".

**Density check**: If you can remove a sentence and the short doesn't lose anything, remove it. The best shorts have overflow of content that's been simplified — if you're stretching to fill time, the idea isn't strong enough.

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

## Lessons From Past Shorts (Reflections)

Distilled from 21 post-upload reflections with retention data and ratings.

### Topic Selection Rules

- **In-game Minecraft content performs dramatically better** than outside-Minecraft topics. Comparing horse armor (700k+ views) to Hytale or code obfuscation (low thousands) — pure gameplay topics win because the visuals write themselves, the info is more consumable, and there's zero abstraction. Stick to mechanics, builds, items, mobs.
- **If the topic isn't genuinely interesting to you personally, don't make it.** Even technically "viral" topics fail if the creator doesn't care (Hytale, Sniffers).
- **Don't make a short if there isn't enough substance.** If the interesting part is only 30 seconds, either keep it at 30 seconds or pivot to a second topic with a BUT transition — don't pad with filler to reach 60.

### Structure Anti-Patterns (What Kills Shorts)

- **AND → AND → AND is death.** Listing facts sequentially with no connective tension loses viewers fast. Every transition should be BUT, THEREFORE, or SO — each point must challenge or build on the last.
- **Never use the listicle outline format** ("There are 3 categories...", "The 7 best..."). It tells the viewer they'll sit through filler before the payoff. If doing multiple points, make them a mystery: just start with the first one and connect them naturally.
- **Never preview/outline what you'll cover** ("We'll talk about X, then Y, then Z"). Just start talking about X. The preview is boring and causes immediate engagement drops.
- **Don't contradict the hook.** If the hook says "this mistake cost Minecraft millions", the ending must justify that claim. Be black and white — nuance and caveats at the end confuse the viewer and undermine the whole short. Embellish slightly if needed.
- **Don't give the payoff too early.** If the answer is revealed at 25 seconds, the remaining 30+ seconds feel like filler. Structure so the reveal happens late, with double hooks bridging sections.

### Structure Patterns (What Works)

- **"Follow along" narratives** — guide the viewer through steps while adding fun facts and personality. Horse armor, building blocks, and best potion all used this effectively.
- **BUT → THEREFORE → BUT → THEREFORE chains** create natural flow where each point connects to the next. Viewer always has a reason to keep watching.
- **Double hooks between sections** keep attention: "And saving the best for last...", "And this is my favorite one...", "But that's not even the craziest part..." — these prevent mid-video swipe-offs.
- **"I checked the code" / "I wrote some code"** adds instant credibility, especially for controversial claims. Lean into this more when making factual claims the audience might doubt.
- **Overflow of content, simplified** — the best shorts (horse armor, best potion) had MORE good info than could fit, and the best parts were selected. This produces density. Shorts where you're stretching thin content to fill time always feel worse.

### Pacing Rules

- **First 15 seconds are sacred.** No fluff, no anecdotes, no personality tangents before the content starts. Get to genuinely interesting info immediately.
- **Personality bits should be ~2 seconds, not tangents.** "Build an English country manor and stables — or just the stables is fine" works. A 10-second personal anecdote after the hook doesn't.
- **2-3 seconds of confusion = swipe away.** If the viewer can't follow what you're saying for even a few seconds, they leave. Fast pacing is good but clarity cannot be sacrificed — it's a tightrope.
- **Every line must earn its place.** If a fact isn't WOW-worthy or doesn't directly advance the narrative, cut it. Lines like "I don't know about you but..." or "If you're in a sticky situation..." are 3-4 wasted scenes.

### Endings

- **End on something memorable** — a dramatic payoff, comedic punchline, or abrupt cutoff. Never a soft landing or caveats.
- **Don't add nuance at the end.** "I guess the devs are just dumb" > a balanced 15-second caveat paragraph. Make them think, don't make them bored.

### Engagement & Retention Benchmarks

- **57% end retention** = not good enough for viral
- **74% end retention** = excellent (best potion achieved this)
- **66% retention at 25 seconds** = poor; horse armor video had 66% retention past a minute
- **Comment/engagement bait doesn't correlate with views or subs.** Discord notification sounds, "Jean/John" pronunciation bait — these generate comments but not virality. Don't sacrifice pacing for engagement bait.
- **Mid-video subscribe CTAs cause engagement drops.** One short got more subs but the retention cliff likely prevented it from going viral. Not worth it.

### Visual Production Notes

- **In-game builds and structures as visuals >>> abstract visualizations.** 15 boats full of cats to show a cat farm is infinitely better than "Notch holding a pig representing Minecraft."
- **Scenes don't need to match narration 100%.** A Christmas tree burning down during an explanation about updates doesn't "make sense" but it's a visual spectacle that keeps engagement.
- **Timelapse builds tied to narration are strong** — building walls, bridges, farms while explaining the topic.
- **Having your character visible frequently adds personality** — don't just do gameplay demos, show KnavishMantis reacting, walking, being present.
