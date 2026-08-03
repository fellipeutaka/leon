---
name: creating-a-changeset
description: "Create and validate Changeset files for user-facing changes in repositories that use Changesets. Use when a feature, bug fix, breaking change, performance improvement, or user-facing documentation change needs a release note and semver bump."
---

# Create a Changeset

Use this skill after implementation is complete and before committing a release-worthy change.

## Workflow

### 1. Discover the repository's release rules

- Read the nearest `AGENTS.md`, `CONTEXT.md`, contributor guide, and release workflow that govern the work.
- Read `git status --short`, `git diff HEAD --stat`, and every relevant staged, unstaged, and untracked change.
- Locate `.changeset/config.json`, workspace manifests, package manifests, lockfiles, and the local Changesets CLI.
- Confirm that the repository uses Changesets. If its configuration or CLI is absent, report the blocker instead of creating a file.
- Resolve the repository's package manager from `package.json` and its lockfile. Use that manager for validation.
- Identify publishable package names and the repository's private-package rules. Use exact names from `package.json`.

Completion criterion: the Changesets setup, package manager, publishable packages, private-package policy, and complete change scope are known.

### 2. Classify impact and package ownership

- Treat changed user behavior, public API, configuration, CLI, generated output, performance, or user-facing documentation as release-worthy.
- Treat internal refactoring, tests, CI/CD, and development-only tooling as internal.
- Map every release-worthy change to each affected publishable package.
- Include a private package only when the repository's Changesets configuration explicitly versions private packages.
- If package ownership or user impact is ambiguous, ask for clarification before writing.

If no release-worthy change remains, stop and report that no Changeset is needed. Completion criterion: every changed file is classified and every release-worthy change has an unambiguous package owner.

### 3. Select the semver bump

Choose a bump for each affected package:

- `patch` — bug fixes, performance improvements, and user-facing documentation changes.
- `minor` — backward-compatible features, options, or commands.
- `major` — breaking API, configuration, CLI, or runtime changes that require migration.

When a change contains multiple impacts, choose the highest required bump for each package. Completion criterion: every affected package has one bump tied to an observable user impact.

### 4. Write the Changeset

- Check `.changeset/` for existing filenames and choose a unique, descriptive kebab-case slug.
- Create `.changeset/<slug>.md` manually so the workflow remains non-interactive.
- Use one quoted frontmatter entry per affected package:

```markdown
---
"package-name": <patch|minor|major>
---
```

- Follow the frontmatter with an imperative, user-facing one-line summary.
- Explain the observable result in plain language. Add an example when the change affects configuration or API usage.
- For a `major` change, start the summary with `BREAKING:` and include old usage, new usage, and migration steps.
- Include `Fixes #123` or `Closes #123` only when an issue number is known.

Completion criterion: the new file contains valid entries for every affected package, the selected bumps, a concise summary, and enough context for users to understand the change.

### 5. Validate the result

- Run the repository's package-manager equivalent of `changeset status` against the local CLI, such as `bun changeset status`, `pnpm exec changeset status`, `npm exec -- changeset status`, or `yarn changeset status`.
- Run `git diff --check`.
- Re-read the new file and confirm that it describes user impact rather than implementation mechanics.
- Confirm with `git status --short` that only the intended Changeset file was added.

Completion criterion: Changesets status succeeds, formatting is clean, package entries are correct, and the new file passes the repository's release-note rules.

Keep release automation out of the Changeset. Do not run `changeset version` or `changeset publish`; follow the repository's documented release workflow instead.
