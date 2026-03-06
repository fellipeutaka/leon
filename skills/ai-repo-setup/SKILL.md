---
name: ai-repo-setup
description: |
  Set up and optimize repositories for AI coding agents. Creates minimal AGENTS.md,
  CLAUDE.md symlink, docs/REQUIREMENTS.md, docs/BUSINESS-RULES.md, feedback loops,
  and deterministic enforcement (Claude Code hooks, OpenCode plugins). Use when user
  wants to make a repo AI-friendly, set up AGENTS.md/CLAUDE.md, document
  requirements/business rules for AI, add pre-commit hooks for AI workflows, or
  optimize codebase structure for coding agents.
---

# AI Repo Setup

Prepare a repository so AI coding agents can navigate, implement, and verify
changes with minimal friction.

**Core philosophy**: AI agents are new starters with no memory. Every session
starts fresh. The codebase itself — not documentation — is the primary context.
Only document what is undiscoverable and globally relevant.

## Inputs to gather (if missing)

- One-sentence project description (what does this project do?)
- Package manager (npm/pnpm/bun/yarn)
- Non-standard build/type-check/test commands
- Functional requirements (what the system should do)
- Non-functional requirements (performance, security, scalability constraints)
- Business rules (domain logic, validation rules, constraints)

## Workflow

### 1. Analyze existing repo

- Read `package.json`, config files, directory structure
- Identify tech stack, package manager, existing scripts
- Check for existing AGENTS.md, CLAUDE.md, docs/
- Note what's already discoverable from source (don't re-document it)

### 2. Create `docs/REQUIREMENTS.md`

Interview user or extract from existing docs. Structure:

```markdown
# Requirements

## Functional Requirements

### [Feature Area]
- FR-001: [Requirement description]
- FR-002: [Requirement description]

## Non-Functional Requirements

### Performance
- NFR-001: [Constraint]

### Security
- NFR-002: [Constraint]

### Scalability
- NFR-003: [Constraint]
```

Keep requirements specific, testable, and numbered for traceability.

### 3. Create `docs/BUSINESS-RULES.md`

Interview user or extract from existing code. Structure:

```markdown
# Business Rules

## [Domain Area]

### BR-001: [Rule name]
- **When**: [Trigger condition]
- **Then**: [Expected behavior]
- **Rationale**: [Why this rule exists]

### BR-002: [Rule name]
- **When**: [Trigger condition]
- **Then**: [Expected behavior]
- **Rationale**: [Why this rule exists]
```

Focus on domain logic that isn't obvious from code. Number rules for
cross-referencing with tests.

### 4. Generate minimal `AGENTS.md`

See [references/agents-md-guide.md](references/agents-md-guide.md) for full
principles.

The file must be **as small as possible**. Only include:

1. One-sentence project description
2. Package manager (if not npm)
3. Non-standard build/type-check/test commands
4. Pointers to docs/ for progressive disclosure

Example:

```markdown
# Project Name

React component library for accessible data visualization.

## Stack
- pnpm workspaces

## Commands
- `pnpm type-check` — type check
- `pnpm test` — run tests

## Docs
- `docs/REQUIREMENTS.md` — functional and non-functional requirements
- `docs/BUSINESS-RULES.md` — domain rules and constraints
```

**Do NOT include**: architecture descriptions, file listings, command dumps from
package.json, framework/library explanations, implementation patterns. These are
all discoverable from source.

### 5. Create `CLAUDE.md` symlink

```bash
ln -s AGENTS.md CLAUDE.md
```

This keeps Claude Code and other tools reading the same instructions.

### 6. Set up feedback loops (optional)

See [references/feedback-loops.md](references/feedback-loops.md) for details.

Ask user which feedback loops to set up:

- [ ] TypeScript `typecheck` script in package.json
- [ ] Test runner (`vitest`, `jest`, `bun test`)
- [ ] E2E tests (`playwright`, `cypress`) — for frontend projects
- [ ] Pre-commit hooks: Lefthook (recommended) or Husky + lint-staged
- [ ] Code quality: Oxlint + Oxfmt (recommended), Biome, or ESLint + Prettier

Pre-commit hooks are the most powerful feedback loop for AI agents — they get
error messages on failed commits and retry automatically.

### 7. Set up deterministic enforcement (optional)

See [references/deterministic-enforcement.md](references/deterministic-enforcement.md)
for details.

Convert any deterministic rules into agent-level enforcement instead of prose in
AGENTS.md:

- **Claude Code**: `PreToolUse` hooks in `.claude/settings.json` (bash scripts)
- **OpenCode**: plugins in `.opencode/plugins/` (TypeScript/JavaScript modules)

Common enforcement rules:

- Enforce correct package manager (block `npm` if using `pnpm`)
- Block dangerous git commands (`git push --force`, `git reset --hard`)
- Block specific CLI patterns
- Protect sensitive files (`.env`, credentials)

Enforcement saves instruction budget and is deterministic — rules cannot be
ignored by the agent.

## Deliverables

- [ ] `docs/REQUIREMENTS.md` — numbered functional + non-functional requirements
- [ ] `docs/BUSINESS-RULES.md` — numbered business rules with triggers/behavior
- [ ] `AGENTS.md` — minimal, hand-crafted, globally relevant only
- [ ] `CLAUDE.md` — symlink to AGENTS.md
- [ ] Feedback loops configured (if opted in)
- [ ] Deterministic enforcement configured (if opted in)

## Anti-patterns to avoid

- **Bloated AGENTS.md** — every line costs tokens on every session
- **Documenting the discoverable** — agents read package.json, config files, imports
- **File path references** — paths change; describe capabilities instead
- **Auto-generated init files** — stale immediately, actively mislead agents
- **Global rules for local concerns** — use progressive disclosure or skills instead
