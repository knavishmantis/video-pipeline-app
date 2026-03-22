# Research Report — Instructions for Claude Code

You are analyzing raw research data to generate short ideas for the KnavishMantis Minecraft YouTube Shorts channel.

## Your Task

1. Read the latest raw data file in `research-reports/` (e.g., `2026-03-20-raw.json`)
2. Read the style guides in `script-guide/frameworks/knavishmantis-voice.md` and `script-guide/analysis/competitor-analysis.md`
3. Generate a curated list of 5-10 short ideas
4. Write the output to `research-reports/YYYY-MM-DD-ideas.json` (matching the raw data date)

## What Makes a Good KnavishMantis Short

From the voice guide and competitor analysis:

- **Voice**: Comedic, opinionated, slightly unhinged Minecraft commentary
- **Best categories**: Mechanic deep dives, opinionated takes, Minecraft history/business, hypothetical/creative
- **Must sustain 60-90 seconds** with 2-3 "But" pivots (context → reveal cycles)
- **Needs a strong hook**: Question, Contrarian, Secret Reveal, or Problem format
- **Target 150-250 words** — tighter is better (camman18 averages 126 words)
- **2-3 specific numbers/stats per script** — not vague claims
- **Uses the Bart Simpson character** as audience stand-in for wrong takes
- **Ends on strongest beat** — dramatic payoff, punchline, or mid-sentence cutoff
- **Uses "Let me explain." bridge** after provocative hooks
- **Uses "You might think X but actually Y"** and anticipated objections

A fun fact that's one sentence is NOT a short. A news recap is NOT a short. It needs enough depth for Breakdown or Problem Solver structure.

## How to Evaluate Each Source

**Competitor standout videos (>1.5x their average):**
- What topic/angle drove outperformance?
- What DIFFERENT angle could KM take? Don't copy — find an adjacent or contrarian take.
- Would this support 60+ seconds of comedic mechanic analysis?

**Reddit trending posts:**
- High-upvote posts about mechanics, bugs, or game design = potential deep dives
- Misconceptions or "TIL" posts = perfect for "You might think X but actually Y"
- Community complaints = perfect for opinionated takes or "Mojang messed up" frame

**Minecraft updates:**
- New mechanics or changes = first-mover deep dive opportunity
- Bug fixes in snapshots/pre-releases mean the bug is being FIXED — frame it as "this existed for YEARS and Mojang is only now fixing it," NOT as a current exploitable mechanic. The story is how long the bug went unnoticed, not that you can still do it.
- Time-sensitive — snapshot content gets most views in first 48-72 hours

## Using the Decompiled Source Code

When an idea involves game mechanics, mob AI, enchantments, or any code behavior, look up the actual decompiled Java source at `/home/quinncaverly/Projects/DecompilerMC/src/1.21.1/client/net/minecraft/`. Extract specific numbers, constants, and conditions — these make scripts more authoritative and provide the "specific numbers" that the style guide requires.

Include findings in the `codeReference` field so the script writer has exact values to work with.

## Output Format

Write a JSON file with as many ideas as the data supports (aim for 10-15+):

```json
{
  "generatedAt": "ISO timestamp",
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "ideas": [
    {
      "title": "Hook-style title for the short",
      "hook": "Draft 1-2 sentence hook using the 3-step formula",
      "whyItFits": "Why this works for KnavishMantis — reference voice, style, or competitor analysis",
      "sourceSignal": "Data backing this — specific view counts, upvote numbers, or changelog entries",
      "sourceType": "youtube | reddit | minecraft | mixed",
      "category": "mechanic_deep_dive | opinionated_take | history | hypothetical | practical_guide",
      "timeliness": "evergreen | time_sensitive",
      "timeWindow": "e.g., '3-5 days' for snapshot content, null for evergreen",
      "contentPoints": ["3-5 bullet points of what the script would cover"],
      "codeReference": "Optional — key findings from decompiled source with file name and specific values",
      "sources": [
        { "label": "Descriptive label", "url": "https://... (optional, for competitor videos or reddit posts)" }
      ],
      "score": 8
    }
  ]
}
```

## Scoring (1-10)

- **9-10**: Strong signal + perfect style fit + enough depth + timely
- **7-8**: Good signal, fits style, has depth
- **5-6**: Decent idea but either thin on depth or weak signal
- **Below 5**: Don't include it

Only include ideas scoring 6+. Rank best first. Generate as many quality ideas as the data supports.
