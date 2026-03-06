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

## Status Reference

| Status | Meaning |
|--------|---------|
| `draft` | Written but not yet reviewed — may still be vague or incomplete |
| `refined` | Reviewed and clarified by user, ready to be implemented |
| `in-progress` | Actively being implemented by the agent |
| `implemented` | Code written by agent, awaiting user review |
| `verified` | User reviewed and approved — source of truth |
| `deferred` | Intentionally postponed, not abandoned |
| `cancelled` | No longer relevant, kept for historical context |

## Functional Requirements

### [Feature Area]

#### FR-001: [Requirement title]
- **Status**: `draft`
- **Description**: [What the system should do]

#### FR-002: [Requirement title]
- **Status**: `verified`
- **Description**: [What the system should do]

## Non-Functional Requirements

### Performance

#### NFR-001: [Constraint title]
- **Status**: `draft`
- **Description**: [Measurable constraint, e.g. "API responses must be < 200ms at p99"]

### Security

#### NFR-002: [Constraint title]
- **Status**: `draft`
- **Description**: [Constraint]

### Scalability

#### NFR-003: [Constraint title]
- **Status**: `draft`
- **Description**: [Constraint]
```

Keep requirements specific, testable, and numbered for traceability. The agent
sets status to `implemented` after completing work; the user sets it to
`verified` after review. Never skip `verified` — `implemented` means the agent
is done, not that the feature is correct.

### 3. Create `docs/BUSINESS-RULES.md`

Interview user or extract from existing code. Structure:

```markdown
# Business Rules

## Status Reference

| Status | Meaning |
|--------|---------|
| `draft` | Written but not yet reviewed — may still be vague or incomplete |
| `refined` | Reviewed and clarified by user, ready to be implemented |
| `in-progress` | Actively being implemented by the agent |
| `implemented` | Code written by agent, awaiting user review |
| `verified` | User reviewed and approved — source of truth |
| `deferred` | Intentionally postponed, not abandoned |
| `cancelled` | No longer relevant, kept for historical context |

## [Domain Area]

### BR-001: [Rule name]
- **Status**: `draft`
- **When**: [Trigger condition]
- **Then**: [Expected behavior]
- **Rationale**: [Why this rule exists]

### BR-002: [Rule name]
- **Status**: `verified`
- **When**: [Trigger condition]
- **Then**: [Expected behavior]
- **Rationale**: [Why this rule exists]
```

Focus on domain logic that isn't obvious from code. Number rules for
cross-referencing with tests. Business rules typically reach `verified` only
when both the rule is enforced in code **and** a test explicitly names the rule
ID (e.g. `it("BR-001: ...")`).

## Agent Workflow for Requirements & Business Rules

This is the intended lifecycle for keeping docs in sync with the codebase:

1. **Draft** — user or agent adds a new item with `status: draft`
2. **Refine** — agent clarifies the description until it is specific and
   testable; user confirms; status → `refined`
3. **Implement** — user asks agent to implement a specific ID; agent
   implements it; status → `implemented`
4. **Verify** — user reviews the implementation; if approved, status →
   `verified`; if rejected, status → `in-progress` with a note

The agent must never set status to `verified` — only the user does.
The agent must update status to `implemented` before closing a session.

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
