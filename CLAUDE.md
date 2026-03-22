# Video Pipeline App

You are the development and production assistant for a YouTube Shorts production management platform.

## Project Overview

Fullstack app that coordinates YouTube Shorts production across distributed teams — managing the pipeline from script creation to final delivery, automating contractor coordination, quality control, and payments. 28+ shorts produced, 1.7M+ cumulative views.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS + MUI, React Router, dnd-kit, Framer Motion, Recharts
- **Backend**: Node.js + Express + TypeScript, PostgreSQL (prod) / SQLite (dev), Google Cloud Storage, JWT auth, GCP Vertex AI
- **Infrastructure**: GCP Cloud Run, Terraform, GitHub Actions, Google OAuth 2.0
- **MCP Server**: Model Context Protocol server for AI-powered shorts/scenes management

## Architecture

Monorepo: `/frontend`, `/backend`, `/mcp-server`, `/shared` (types)

Pipeline statuses: `idea` → `script` → `clipping` → `clips` → `clip_changes` → `editing` → `editing_changes` → `completed` → `uploaded`

Key entities: users (with roles), shorts, assignments, files (GCP Storage), payments, scenes

## Key Directories

```
frontend/src/pages/        — 14 route-level components
frontend/src/components/   — KanbanBoard, SceneEditor, ContentModal, etc.
frontend/src/contexts/     — AuthContext, ThemeContext
frontend/src/services/     — API client (axios)
backend/src/controllers/   — Business logic
backend/src/routes/        — API endpoints
backend/src/db/            — Schema, migrations
mcp-server/src/            — MCP server for AI integration
```

## Development

```bash
# Frontend (port 5173, proxies to :3001)
cd frontend && npm run dev

# Backend (port 3001)
cd backend && npm run dev
```

## How to assist

- When modifying features, check both frontend and backend — they share types via `/shared`
- Database changes need migrations in `backend/src/db/migrations/`
- File uploads go through GCP Cloud Storage with signed URLs
- Role-based access: admin, script_writer, clipper, editor
- The MCP server should stay in sync with any API changes to shorts/scenes

## YouTube Channel Context

This tool supports a Flashback-style YouTube Shorts channel (KnavishMantis). When making creative decisions about the platform, consider the production workflow: scripts are written → scenes are broken down → clips are gathered by clippers → editors assemble final shorts → uploaded to YouTube.

## Decompiled Minecraft Source Code

Decompiled Minecraft Java source is available at `/home/quinncaverly/Projects/DecompilerMC/src/1.21.1/client/net/minecraft/`. Use this when writing scripts that reference game mechanics, mob AI, enchantment behavior, or any code-level analysis. Search the decompiled source to find specific numbers, behaviors, and implementation details that make scripts more authoritative.

Key paths for common topics:
- Mob AI: `net/minecraft/world/entity/ai/`
- Enchantments: `net/minecraft/world/item/enchantment/`
- Villager trading: `net/minecraft/world/entity/npc/`
- Combat/weapons: `net/minecraft/world/item/`
- World generation: `net/minecraft/world/level/levelgen/`
- Block behavior: `net/minecraft/world/level/block/`

## Script Writing Guide

Detailed script writing frameworks, channel voice guide, and competitor analysis live in `/script-guide/`. When helping with scripts or scene breakdowns, read the files in `script-guide/frameworks/` for guidance.

```
script-guide/
  frameworks/
    knavishmantis-voice.md   — Channel identity, script formula, scene breakdown patterns
    kallaway-frameworks.md   — Hooks, story locks, curiosity loops, dopamine ladder
  competitor-data/           — Downloaded transcripts from competitor channels
  analysis/                  — AI-generated analysis of competitor patterns
```

## Research Reports

Research data and curated short ideas live in `research-reports/`. To generate new data:

1. `cd backend && npm run research` — collects YouTube competitor data, Reddit trends, and Minecraft updates
2. Ask Claude Code to read the raw data + `backend/src/research/RESEARCH_PROMPT.md` and generate ideas
3. View ideas on the frontend at `/research` (admin-only)
