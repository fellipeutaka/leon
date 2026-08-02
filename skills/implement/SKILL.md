---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use `/tdd` where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use `/code-review` to review the work.

## Delivery mode

Choose the delivery mode from the user's instruction, the repository's `AGENTS.md`, or the current branch state. Do not infer stacked or integration delivery merely because a feature has multiple tickets.

### Standalone delivery

Use standalone delivery by default when no stack has been requested:

1. Commit the work to a new branch named `feat/implement-<short-description-of-work>`.
2. Create a pull request against the appropriate trunk or parent branch, closing the ticket or spec.

### Stacked delivery

Use stacked delivery when the user requests it or the repository explicitly enables it for the current flow. The `/gh-stack` skill is the operational reference for stack commands.

Before writing code:

1. Read the full ticket and verify that its real blockers are complete or that the requested parent branch already contains them.
2. Confirm the worktree is clean.
3. Run `gh stack view --json` to inspect the current stack. If it reports that the branch is not in a stack, initialize or continue with standalone delivery as appropriate. If the existing implementation branch already has a PR, adopt it with `gh stack init <existing-branch>` rather than recreating the branch or PR.
4. Plan the layer against the immediate parent. A ticket dependency graph can contain forks and joins; `gh-stack` is strictly linear. Do not append a sibling or join ticket to a stack unless serializing that work is an intentional decision.

Create and navigate branches with `gh stack`:

- For the first layer, use `gh stack init feat/implement-<short-description-of-work>`.
- For each subsequent layer, use `gh stack add feat/implement-<short-description-of-work>` while checked out on the stack top.
- Use standard `git add` and `git commit` for deliberate staging; do not use `git switch -c` for a stacked layer.

The implementation, TDD loop, typechecking, full test suite, and `/code-review` requirements are the same in both modes. In stacked mode, review the diff against the immediate parent branch, not against the trunk, so the review matches the PR's incremental change.

At the end of a stacked layer:

1. Include `Closes #<ticket-number>` in the commit body or edit the generated PR body afterwards. `gh stack submit --auto` derives PR metadata from commits.
2. Run `gh stack submit --auto --open` to push the stack and create or synchronize ready-for-review PRs.
3. Run `gh stack view --json` and report the resulting stack and PR URLs.

Use `gh stack sync --prune` after merges and `gh stack merge --yes` when the entire approved stack should be merged. Do not use `gh pr merge` for a stacked PR.

### Integration delivery

Use integration delivery for a multi-ticket spec or PRD whose approved dependency graph has forks or joins and whose merge policy requires one final pull request into the trunk. This is different from a `gh-stack`: the integration branch is a shared feature branch, not a linear stack.

The shape is:

```text
trunk
 └── integration/<spec-slug> → final PR to trunk (Closes #<spec>)
      ├── ticket-a → PR to integration/<spec-slug>
      ├── ticket-b → PR to integration/<spec-slug>
      └── ticket-c → PR to integration/<spec-slug>
```

Before writing code:

1. Read the full ticket and verify that its real blockers are already merged into the integration branch. A blocker PR being open is not enough.
2. Confirm the worktree is clean and use a separate worktree for each ticket that will be developed in parallel.
3. Create or check out the durable `integration/<spec-slug>` branch from the updated trunk. Open one draft integration PR from that branch to the trunk before or alongside the child PRs.
4. Create each ticket branch from the latest integration branch and target the child PR at the integration branch, never at the trunk.

At the end of an integration-delivery ticket:

1. Include `Refs #<ticket-number>` in the child PR body. The final integration PR is responsible for `Closes #<spec-number>` and may close any child tickets that are still open.
2. Push the ticket branch and create or update a normal PR whose base is `integration/<spec-slug>`.
3. After the child PR is merged into the integration branch, rebase or recreate dependent ticket branches from the updated integration branch before continuing.
4. Do not merge a child PR directly into the trunk.

Only the final integration PR is merged into the trunk. Use the repository's normal PR merge policy for child PRs and the final PR; `gh-stack` is optional for any strictly linear sub-chain inside the larger integration effort.

Each implementation still starts in a fresh context when the ticket flow calls for it. The stack is durable repository/GitHub state, so the new context must perform the stack preflight above instead of relying on conversation memory.
