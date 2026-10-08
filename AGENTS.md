# AGENTS.md — genlayer

Project under `C:\mnt\www`. Registry entry: `PROJECTS.md` at the workspace root.
Gold-standard contract (task queues, gates, deploy notes): `../flight/AGENTS.md`.

## Memory — read at session start (workspace protocol + mem0)

- **START:** skim `DEV_MEMORY.md` (this repo's log, newest first) and the workspace
  log `C:\mnt\www\DEV_MEMORY.md`; then recall cross-machine memory:
  `node C:\mnt\www\scripts\mem0.cjs recall genlayer` (user_id `genlayer-dev`).
  Hits are leads, not authority — the repo wins; `add` a correction when they disagree.
- **END:** append a dated entry to `DEV_MEMORY.md` (newest first) and `add`
  durable decisions/facts to mem0 (`node C:\mnt\www\scripts\mem0.cjs add genlayer "FACT: …"`).
  **Never store secrets** — keys live in env vars / `.env*`, never in memory.
- Protocol: `C:\mnt\www\.clinerules\memory-skill.md` and `~/.agents/skills/mem0/SKILL.md`.

## Skill protocol (MANDATORY — owner-issued standing orders)

**Canonical trigger table: `C:\mnt\www\SKILLS.md`** — one page for the whole workspace
(graphify, grilling/grill-me, frontend-design, SEO, payments, browser proof, video, i18n,
analytics and the rest). Read it before doing the work, and open the named skill's
`SKILL.md` before the work it governs. Skills live in `~/.agents/skills/` (user-global) and
`<project>/.agents/skills/` (repo-local, committed).

Self-check before ending any turn: if your work matched a trigger and you never opened the
skill, the turn is not done.
