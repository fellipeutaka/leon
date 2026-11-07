---
name: docs-lookup
description: Look up current docs for a library, framework, SDK, CLI, or cloud API before writing or fixing code that uses it. Use when code touches a library API or config option, a version migration, a library-specific bug, or the user asks how something works in a library.
---

# Docs lookup

Training data is a stale cache of library APIs. Verify against a **primary source** pinned to the version the project uses, climbing the ladder in order. Context7 is metered on a shared monthly quota; it sits near the top.

## 1. Pin the version

Read it from the manifest + lockfile (`package.json` + lockfile, `pyproject.toml`/`uv.lock`, `Cargo.lock`, `go.mod`). Outside a project, use latest. Done when you hold `name@version` (or "latest").

## 2. Climb the ladder

Stop at the first rung that answers the question for that version.

1. **Source repo.** `opensrc path <pkg>` returns the repo cloned at the lockfile version (`pypi:`, `crates:`, `owner/repo` for other registries; `@version` to pin). Search its docs folder (`docs/`, `website/`, `apps/docs/`), README, CHANGELOG / migration guides, type definitions, tests and examples:
   ```bash
   P=$(opensrc path zod)
   rg -l "superRefine" "$P" --glob '*.{md,mdx}'
   rg -n "superRefine" "$P" --glob '*.d.ts'
   ```
   Types and tests are ground truth for signatures; docs folders for usage. When opensrc cannot resolve the package (private, no repo URL), go straight to rung 6.
2. **Docs repo.** When the source repo has no docs folder, the docs often live in a sibling repo (`nestjs/nest` → `nestjs/docs.nestjs.com`). Find it, then open it with `opensrc path <owner>/<docs-repo>`:
   - List the owner's repos and match docs names:
     ```bash
     gh repo list <owner> --limit 200 --no-archived --json name,description \
       -q '.[] | select((.name|test("doc";"i")) or ((.description//"")|test("documentation|docs";"i"))) | .name'
     ```
     Several hits: pick the one named after the docs host or the current major version.
   - No hit (docs under another owner, e.g. `facebook/react` → `reactjs/react.dev`): fetch any page of the docs site and follow its "Edit this page on GitHub" link.

   A docs repo tracks its default branch, so look for versioned folders when the pinned version is not the latest.
3. **Docs site as markdown.** Find the official host (registry `homepage`, repo README). Fetch `<host>/llms.txt`: it indexes the markdown pages and shows the URL format the site uses. Without `llms.txt`, try the page URL with `.md`, `.mdx`, then `/index.md` appended, then plain HTML. `llms-full.txt` is the whole site in one file; fetch it only through a tool that indexes it.
4. **WebSearch.** Use when the host, page or docs repo is unknown, or the topic is newer than the cloned source (release posts, breaking changes). Restrict `allowed_domains` to official domains, then fetch the hit as in rung 3.
5. **Context7.** One `resolve-library-id` + one `query-docs` per question (MCP, or `npx ctx7@latest library` / `docs`). On a quota error, tell the user and move on.
6. **Installed package.** The published artifact at the exact installed version: `node_modules/<pkg>` (README, `.d.ts`, `dist`), the virtualenv `site-packages/<pkg>`, `~/.cargo/registry/src/*/<crate>-<ver>`, `$(go env GOMODCACHE)/<module>@<ver>`.

Fetch through the route the environment prescribes (`ctx_fetch_and_index` under context-mode, `WebFetch` in Claude Code).

## 3. Answer with evidence

Done when every library API you use or recommend traces to a source read this session, cited as a path at the pinned version (`zod@3.23.8: src/types.ts`) or a URL. When sources disagree, the version-pinned source wins: docs sites and docs repos often track latest. Label anything unverified.
