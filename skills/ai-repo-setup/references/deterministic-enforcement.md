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

- **Package manager** — if using `pnpm`, block `npm`, `npx`, `yarn`, `bun`, `bunx`, `deno`, `vlt` (and vice-versa for other managers)
- **Dangerous git** — block force-push variants (`--force`, `-f`, `--force-with-lease`), `reset --hard`, `clean -f*`, `branch -D`, history rewriting
- **Sensitive files** — block reads of `.env`, `*.pem`, credential files
- **Wrapper scripts** — block direct `npx` / `bunx` when project has its own runner

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

### Script template — package manager enforcement

Customize `PREFERRED` and `BLOCKED` for your project. The pattern matches the
binary at the start of the command **or** after a shell metacharacter
(`; && || |`), so mid-pipeline invocations like `cd app && npm install` are
caught too.

```bash
#!/bin/bash
# .claude/hooks/enforce-pkg-manager.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

PREFERRED="pnpm"

# Every binary that is NOT the preferred package manager / runner.
# Adjust this list for your project (e.g. remove "bun" if you use it as a runtime).
declare -A BLOCKED=(
  [npm]="pnpm"
  [npx]="pnpm dlx"
  [yarn]="pnpm"
  [bun]="pnpm"
  [bunx]="pnpm dlx"
  [deno]="pnpm"
  [vlt]="pnpm"
  [aube]="pnpm"
)

for binary in "${!BLOCKED[@]}"; do
  preferred="${BLOCKED[$binary]}"
  # Match binary at start of string or after ;  &&  ||  |
  if echo "$COMMAND" | grep -qE "(^|;|&&|\|\||\|) *$binary( |\t|$)"; then
    echo "Blocked: use '$preferred' instead of '$binary'." >&2
    exit 2
  fi
done

exit 0
```

**Per-manager variants** — swap the `BLOCKED` map:

| Project uses | Remove from BLOCKED | Change preferred to |
|---|---|---|
| `bun` | `bunx` | `bun` / `bunx` |
| `npm` | — | `npm` / `npx` |
| `yarn` | — | `yarn` |

### Setup

1. Create `.claude/hooks/` directory
2. Write hook scripts
3. `chmod +x .claude/hooks/*.sh`
4. Add hooks to `.claude/settings.json`
5. Restart Claude Code

### Example: block dangerous git commands

The key precision rule: block **force** variants, not `git push` outright.
`git push origin feature/my-branch` is safe; `git push --force` is not.

```bash
#!/bin/bash
# .claude/hooks/enforce-git-safety.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

block() {
  echo "Blocked: $1. Ask user for confirmation first." >&2
  exit 2
}

# Force push (--force / -f / --force-with-lease)
echo "$COMMAND" | grep -qE "git push.*(--force|-f\b|--force-with-lease)" \
  && block "force push rewrites remote history"

# Hard reset
echo "$COMMAND" | grep -qE "git reset --hard" \
  && block "'git reset --hard' discards local commits irreversibly"

# Clean (any -f flag variant: -f, -fd, -fdx, -fX …)
echo "$COMMAND" | grep -qE "git clean.*-[a-zA-Z]*f" \
  && block "'git clean -f' permanently deletes untracked files"

# Force-delete branch
echo "$COMMAND" | grep -qE "git branch -D" \
  && block "'git branch -D' deletes without merge check"

# Discard working-tree changes (checkout -- . / restore . / restore *)
echo "$COMMAND" | grep -qE "git (checkout|restore) (--\s*)?(\.|\.\/|\*)" \
  && block "discarding working-tree changes is irreversible"

# History rewriting
echo "$COMMAND" | grep -qE "git (filter-branch|filter-repo)" \
  && block "history rewriting is irreversible"

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

### TypeScript setup

For type safety, install `@opencode-ai/plugin` in `.opencode/`:

```json title=".opencode/package.json"
{
  "dependencies": {
    "@opencode-ai/plugin": "^1.2.21"
  }
}
```

Then run your package manager in `.opencode/`:

```bash
npm install   # or bun/pnpm/yarn depending on project preference
```

Import the `Plugin` type in your plugin files:

```ts
import type { Plugin } from "@opencode-ai/plugin"
```

### Plugin template

`matchesBinary` handles mid-pipeline invocations (`cd app && npm install`).
Adjust `PREFERRED_PKG_MANAGER` and `WRONG_PKG_MANAGERS` for your project.

```ts title=".opencode/plugins/enforcement.ts"
import type { Plugin } from "@opencode-ai/plugin"

// ── Configuration ────────────────────────────────────────────────────────────

const PREFERRED_PKG_MANAGER = "pnpm" // change to "bun", "npm", "yarn", etc.

// Maps blocked binary → preferred alternative shown in error message
const WRONG_PKG_MANAGERS: Record<string, string> = {
  npm: PREFERRED_PKG_MANAGER,
  npx: `${PREFERRED_PKG_MANAGER} dlx`,
  yarn: PREFERRED_PKG_MANAGER,
  bun: PREFERRED_PKG_MANAGER,
  bunx: `${PREFERRED_PKG_MANAGER} dlx`,
  deno: PREFERRED_PKG_MANAGER,
  vlt: PREFERRED_PKG_MANAGER,
  aube: PREFERRED_PKG_MANAGER,
}

const DANGEROUS_GIT: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /git push.*(--force|-f\b|--force-with-lease)/, reason: "force push rewrites remote history" },
  { pattern: /git reset --hard/, reason: "irreversibly discards local commits" },
  { pattern: /git clean.*-[a-zA-Z]*f/, reason: "permanently deletes untracked files" },
  { pattern: /git branch -D/, reason: "force-deletes branch without merge check" },
  { pattern: /git (checkout|restore) (--\s*)?(\.|\.\/|\*)/, reason: "discards uncommitted working-tree changes" },
  { pattern: /git (filter-branch|filter-repo)/, reason: "rewrites commit history" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

// Matches binary at start of string or after shell metacharacters (;  &&  ||  |)
function matchesBinary(cmd: string, binary: string): boolean {
  return new RegExp(`(^|;|&&|\\|\\||\\|)\\s*${binary}(\\s|$)`).test(cmd)
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const Enforcement: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const cmd = output.args.command as string

      for (const [binary, preferred] of Object.entries(WRONG_PKG_MANAGERS)) {
        if (matchesBinary(cmd, binary)) {
          throw new Error(`BLOCKED: use '${preferred}' instead of '${binary}'.`)
        }
      }

      for (const { pattern, reason } of DANGEROUS_GIT) {
        if (pattern.test(cmd)) {
          throw new Error(
            `BLOCKED: '${cmd}' — ${reason}. Ask user for confirmation first.`
          )
        }
      }
    },
  }
}
```

### Setup

1. Create `.opencode/plugins/` directory
2. Create `.opencode/package.json` with `@opencode-ai/plugin` dev dependency
3. Run `bun install` (or preferred package manager) inside `.opencode/`
4. Write plugin files (`.ts` or `.js`)
5. Restart OpenCode

### Example: block dangerous git commands

```ts title=".opencode/plugins/git-guardrails.ts"
import type { Plugin } from "@opencode-ai/plugin"

const DANGEROUS_GIT: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /git push.*(--force|-f\b|--force-with-lease)/, reason: "force push rewrites remote history" },
  { pattern: /git reset --hard/, reason: "irreversibly discards local commits" },
  { pattern: /git clean.*-[a-zA-Z]*f/, reason: "permanently deletes untracked files" },
  { pattern: /git branch -D/, reason: "force-deletes branch without merge check" },
  { pattern: /git (checkout|restore) (--\s*)?(\.|\.\/|\*)/, reason: "discards uncommitted working-tree changes" },
  { pattern: /git (filter-branch|filter-repo)/, reason: "rewrites commit history" },
]

export const GitGuardrails: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const cmd = output.args.command as string
      for (const { pattern, reason } of DANGEROUS_GIT) {
        if (pattern.test(cmd)) {
          throw new Error(
            `BLOCKED: '${cmd}' — ${reason}. Ask user for confirmation first.`
          )
        }
      }
    },
  }
}
```

### Example: protect .env files

```ts title=".opencode/plugins/env-protection.ts"
import type { Plugin } from "@opencode-ai/plugin"

export const EnvProtection: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && (output.args.filePath as string).includes(".env")) {
        throw new Error("Blocked: do not read .env files")
      }
    },
  }
}
```

---

## Block node_modules reads — redirect to opensrc

Agents debugging a library bug often reach for `cat node_modules/zod/dist/index.js`
or `grep "parse" node_modules/zod/`. Those files are compiled/minified — slow
to process and the wrong thing to read. `opensrc` fetches the original source
from npm, PyPI, crates.io, or GitHub.

Install globally: `npm i -g opensrc` (or `pnpm add -g opensrc`).

### Why two layers

| Layer | What it blocks |
|---|---|
| `permissions.deny` | Claude Code's `Read` tool on any `node_modules/**` path |
| Bash hook | Shell commands (`cat`, `grep`, `rg`, `find`, `head`, `tail`) targeting `node_modules/` |

### Claude Code — settings.json

```json
{
  "permissions": {
    "deny": ["Read(**/node_modules/**)"]
  }
}
```

### Claude Code — bash hook

```bash
#!/bin/bash
# .claude/hooks/block-node-modules.sh
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0

if echo "$COMMAND" | grep -qE "(^|;|&&|\|\||\|) *(cat|bat|head|tail|less|more|grep|rg|find) .*node_modules/"; then
  PKG=$(echo "$COMMAND" | grep -oE "node_modules/(@[^/ ]+/[^/ ]+|[^/ ]+)" | head -1 | sed 's|node_modules/||')
  echo "Blocked: don't read node_modules/ directly — files are compiled/minified." >&2
  echo "Use opensrc to fetch and read the original source instead." >&2
  echo "opensrc resolves npm packages, PyPI, crates.io, and GitHub repos:" >&2
  echo "  opensrc path ${PKG:-<package>}              # npm package" >&2
  echo "  opensrc path pypi:${PKG:-<package>}         # PyPI package" >&2
  echo "  opensrc path crates:${PKG:-<package>}       # crates.io crate" >&2
  echo "  opensrc path owner/repo                     # GitHub repo" >&2
  echo "Then compose with any tool:" >&2
  echo "  rg \"pattern\" \$(opensrc path ${PKG:-<package>})" >&2
  echo "  cat \$(opensrc path ${PKG:-<package>})/src/index.ts" >&2
  exit 2
fi

exit 0
```

### OpenCode — plugin

```ts title=".opencode/plugins/block-node-modules.ts"
import type { Plugin } from "@opencode-ai/plugin"

const NODE_MODULES_RE = /\bnode_modules\//
const READ_CMDS_RE = /\b(cat|bat|head|tail|less|more|grep|rg|find)\b/

function extractPkg(cmd: string): string {
  const m = cmd.match(/node_modules\/(@[^/ ]+\/[^/ ]+|[^/ ]+)/)
  return m ? m[1] : "<package>"
}

const OPENSRC_HINT = (pkg: string) =>
  `Use opensrc to fetch and read the original source instead.\n` +
  `opensrc resolves npm packages, PyPI, crates.io, and GitHub repos:\n` +
  `  opensrc path ${pkg}           # npm package\n` +
  `  opensrc path pypi:${pkg}      # PyPI package\n` +
  `  opensrc path crates:${pkg}    # crates.io crate\n` +
  `  opensrc path owner/repo       # GitHub repo\n` +
  `Then compose:\n` +
  `  rg "pattern" $(opensrc path ${pkg})\n` +
  `  cat $(opensrc path ${pkg})/src/index.ts`

export const BlockNodeModules: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read") {
        const path = output.args.filePath as string
        if (path.includes("node_modules/")) {
          throw new Error(
            `BLOCKED: don't read '${path}' — files are compiled/minified.\n` +
            OPENSRC_HINT(extractPkg(path))
          )
        }
      }

      if (input.tool === "bash") {
        const cmd = output.args.command as string
        if (NODE_MODULES_RE.test(cmd) && READ_CMDS_RE.test(cmd)) {
          throw new Error(
            `BLOCKED: don't read node_modules/ directly — files are compiled/minified.\n` +
            OPENSRC_HINT(extractPkg(cmd))
          )
        }
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
