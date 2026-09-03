# Leon — Agent Skills Collection

Curated collection of Agent Skills for AI coding agents.

## Project Structure

- `skills/` — all skills (original and synced from upstream)
- `scripts/sync-upstream.ts` — syncs skills from external repos via GitHub API
- `upstream.json` — manifest tracking which skills come from external repos, their source SHA and last sync timestamp

## Skills Format

Each skill is a directory inside `skills/` following the [Agent Skills](https://agentskills.io/) format:

- `SKILL.md` (required) — skill definition with YAML frontmatter (`name`, `description`)
- `README.md` — user-facing documentation
- `scripts/` — helper scripts (optional)
- `references/` — supporting docs (optional)

## Upstream Skills

Some skills are synced from external repos. Tracked in `upstream.json`.

- Sync all: `bun sync`
- Sync new only: `bun sync --new-only` (skips skills that already have a `lastSync`)
- Sync one repo: `bun sync --repo mattpocock/skills`
- Sync one skill: `bun sync --repo mattpocock/skills --skill tdd`
- Synced skills can be locally modified — just know re-syncing overwrites local changes
- Set `GITHUB_TOKEN` env var to avoid API rate limits

## Tech Stack

- Bun + TypeScript
- No external dependencies

## Conventions

- Skill directory names use kebab-case
- SKILL.md frontmatter must have `name` and `description` fields
- Keep standalone skills self-contained — no relative cross-skill dependencies.
  The Matt-derived flow variants listed in `downstream.json` may call their
  declared model-invoked dependencies through the Skill tool.
