# Deterministic Enforcement

Prose rules in AGENTS.md waste instruction budget and can be ignored. Both
Claude Code and OpenCode support deterministic interception of tool calls —
commands get blocked before execution, with an error message fed back to the
agent.

## When to use enforcement vs prose

| Situation | Use |
|-----------|-----|
| "Use pnpm instead of npm" | Enforcement (deterministic) |
| "Don't run git push --force" | Enforcement (deterministic) |
| "Don't read .env files" | Enforcement (deterministic) |
| "Prefer reducers for complex state" | AGENTS.md/skill (heuristic) |
| "Follow this testing pattern" | Skill (domain-specific) |

**Rule of thumb**: if the instruction maps to "block X, suggest Y instead" —
use enforcement.

## Common patterns to enforce

- Correct package manager (block `npm` if using `pnpm`)
- Dangerous git commands (`git push --force`, `git reset --hard`, `git clean -f`)
- Reading sensitive files (`.env`, credentials)
- Direct `npx` when project has wrapper scripts

---

## Claude Code Hooks

Hooks live in `.claude/settings.json` and run bash scripts. Exit code `0`
allows, exit code `2` blocks (error message sent to agent).

### Configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/enforce-pkg-manager.sh"
          }
        ]
      }
    ]
  }
}
```

### Script template

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "^npm "; then
  echo "Blocked: use pnpm instead of npm" >&2
  exit 2
fi

exit 0
```

### Setup

1. Create `.claude/hooks/` directory
2. Write hook scripts
3. `chmod +x .claude/hooks/*.sh`
4. Add hooks to `.claude/settings.json`
5. Restart Claude Code

### Example: block dangerous git commands

```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'." >&2
    exit 2
  fi
done

exit 0
```

---

## OpenCode Plugins

Plugins are JavaScript/TypeScript modules placed in `.opencode/plugins/` or
registered via `opencode.json`. They use the `tool.execute.before` event to
intercept tool calls. Throw an error to block execution.

### Configuration

Local plugins are auto-loaded from `.opencode/plugins/`. For npm plugins:

```json title="opencode.json"
{
  "plugin": ["my-enforcement-plugin"]
}
```

### Plugin template

```ts title=".opencode/plugins/enforce-pkg-manager.ts"
export const EnforcePkgManager = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash" && /^npm /.test(output.args.command)) {
        throw new Error("Blocked: use pnpm instead of npm")
      }
    },
  }
}
```

### Setup

1. Create `.opencode/plugins/` directory
2. Write plugin files (`.ts` or `.js`)
3. Restart OpenCode

### Example: block dangerous git commands

```ts title=".opencode/plugins/git-guardrails.ts"
const DANGEROUS_PATTERNS = [
  /git push/,
  /git reset --hard/,
  /git clean -f/,
  /git branch -D/,
  /git checkout \./,
  /git restore \./,
  /push --force/,
  /reset --hard/,
]

export const GitGuardrails = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const cmd = output.args.command
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(cmd)) {
          throw new Error(
            `BLOCKED: '${cmd}' matches dangerous pattern '${pattern}'.`
          )
        }
      }
    },
  }
}
```

### Example: protect .env files

```ts title=".opencode/plugins/env-protection.ts"
export const EnvProtection = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Blocked: do not read .env files")
      }
    },
  }
}
```

---

## Converting AGENTS.md rules to enforcement

Scan AGENTS.md for instructions matching these patterns:

- "Use X instead of Y" → enforce package manager / CLI
- "Don't run Z" → block dangerous commands
- "Never read/modify F" → protect sensitive files

Move them out of AGENTS.md into hooks/plugins. This saves instruction budget
and makes the rules impossible to bypass.
