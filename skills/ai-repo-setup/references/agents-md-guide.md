# AGENTS.md Best Practices

## The Instruction Budget

LLMs can follow ~300-500 instructions at once. AGENTS.md is loaded on **every
session**, regardless of task. Every line has a compounding cost.

## What belongs in AGENTS.md

Only what is **undiscoverable AND globally relevant**:

| Content | Include? | Why |
|---------|----------|-----|
| One-sentence project description | Yes | Anchors every decision |
| Package manager (if not npm) | Yes | Agent can't reliably guess |
| Non-standard commands | Yes | Not discoverable from source |
| Pointers to docs/ | Yes | Enables progressive disclosure |
| Architecture descriptions | No | Discoverable from imports/configs |
| File listings | No | Discoverable from file system |
| Command dumps from package.json | No | Agent reads package.json directly |
| Framework explanations | No | Discoverable from dependencies |
| Implementation patterns | No | Only relevant to subset of sessions |
| File path references | No | Paths change; misleads agent |

## The Globality Problem

AGENTS.md is global — every instruction applies to every session. A React
convention rule wastes tokens during backend work. A testing pattern wastes
tokens during docs work.

**Solution**: Move domain-specific guidance to separate files or skills.
AGENTS.md points to them; agent loads them only when relevant.

## Progressive Disclosure

Instead of one massive file, create a documentation tree:

```
AGENTS.md (minimal — pointers only)
docs/
├── REQUIREMENTS.md
├── BUSINESS-RULES.md
├── TYPESCRIPT.md (if needed)
├── TESTING.md (if needed)
└── API.md (if needed)
```

Agents navigate hierarchies efficiently. Each file loads only when relevant.

## Monorepo Strategy

Place AGENTS.md at each level. They merge automatically.

| Level | Content |
|-------|---------|
| Root | Monorepo purpose, navigation, shared tools |
| Package | Package purpose, specific stack, package conventions |

Keep each level focused. The agent sees all merged files in context.

## Stale Documentation

Documentation rots fast. For humans, stale docs are annoying. For AI agents,
stale docs **poison context** — the agent trusts what it reads.

- Never document file paths (they change)
- Describe capabilities, not structure
- Domain concepts are safer than implementation details
- When in doubt, leave it out — the agent will explore

## CLAUDE.md

Claude Code uses `CLAUDE.md` instead of `AGENTS.md`. Symlink them:

```bash
ln -s AGENTS.md CLAUDE.md
```

Same content, both tools work.

## Example: Ideal AGENTS.md

```markdown
# MyApp

SaaS platform for team retrospectives with real-time collaboration.

## Stack
- pnpm
- `pnpm typecheck` — type check all packages
- `pnpm test` — run all tests

## Docs
- `docs/REQUIREMENTS.md` — functional and non-functional requirements
- `docs/BUSINESS-RULES.md` — domain rules and constraints
```

That's it. Everything else is discoverable or belongs in progressive disclosure
files.
