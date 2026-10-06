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
