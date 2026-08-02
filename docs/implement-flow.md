# Leon's custom implementation flow

Leon contains downstream variants of Matt Pocock's engineering-flow skills.
The original idea-to-ship flow remains intact:

```text
grill → to-spec → to-tickets → implement → code-review → merge
```

The local variants add an explicit delivery layer for GitHub repositories. The
product specification and issue dependency graph stay separate from branch
topology.

## What differs from Matt's upstream flow

The upstream flow is the source of the product and engineering disciplines:

- `/to-spec` turns the conversation into a product specification.
- `/to-tickets` creates vertical tickets with real `Blocked by` edges.
- `/implement` uses TDD, regular typechecks, a full test run, and `/code-review`.

Leon's downstream `/implement` adds three delivery modes:

| Mode | Use when | Pull request base | Final merge |
| --- | --- | --- | --- |
| `standalone` | An independent ticket or a project without a shared integration branch | Trunk or the explicitly requested parent | The ticket PR goes to trunk |
| `stacked` | Changes form one strictly linear dependency chain | The previous stack branch | `gh stack merge --yes` |
| `integration` | A PRD has parallel tickets, joins, and one final merge into trunk | A shared PRD integration branch | The integration PR goes to trunk |

Do not choose `stacked` just because a feature has several tickets. GitHub
stacks are linear: one branch has one parent and at most one child. A ticket
graph with forks and joins needs integration delivery or ordinary dependent
PRs.

## PRD integration delivery

Use this mode when the goal is parallel worktrees plus one final PRD merge.
Create a durable integration branch from the updated trunk and open a draft
PR for it:

```text
main
 └── integration/prd-177-adaptador
      ├── feat/implement-adaptador-docx  → PR #179
      ├── feat/implement-adaptador-pdf   → PR #180
      └── feat/implement-adaptador-layouts → PR #181
```

Each child PR targets `integration/prd-177-adaptador`, not `main`. After a
child is merged, dependent branches are created or rebased from the updated
integration branch. For a fork, multiple worktrees can proceed in parallel.

For a join, wait until every real blocker is merged into the integration
branch before starting the ticket:

```text
#181 merged into integration
 ├── #182 → integration
 └── #183 → integration

#179, #180, #182, and #183 merged into integration
 └── #184 → integration
```

The final integration PR is the only PR that targets `main`. Its body should
contain `Closes #<spec-number>` and can close any child tickets that remain
open. Child PRs should use `Refs #<ticket-number>` so the umbrella issue is
not closed before the complete feature is integrated.

This gives one final merge into trunk, although child PRs still merge into the
integration branch as they are reviewed. That intermediate merging is what
keeps the parallel branches buildable and lets later blockers see earlier
work.

## Invoking `/implement`

Use an explicit delivery mode when the repository has not declared a default:

```text
/$implement #42 --standalone
/$implement #43 --stack
/$implement #44 --integration integration/prd-177-adaptador
```

The skill still starts each ticket in a fresh context. The context must read
the ticket, verify its blockers, inspect the branch state, and then implement
only that ticket.

For parallel integration work, use one worktree per ticket. Every worktree
must start from the current integration branch, and no child PR may target
the trunk directly:

```bash
git worktree add ../project-42 -b feat/implement-ticket-42 integration/prd-example
git worktree add ../project-43 -b feat/implement-ticket-43 integration/prd-example
```

The exact branch names are project policy; the important invariant is that
parallel child branches share the integration branch as their PR base.

## How `/ask-matt` routes the flow

After `/to-tickets` approves the issue graph:

- linear chain → `implement --stack`;
- fork/join plus one final PRD merge → `implement --integration`;
- independent work without a final integration branch → `implement --standalone`.

The issue graph remains authoritative. A delivery choice must not add fake
blockers merely to make a linear stack possible.

## How to keep the downstream skill current

The local variants are tracked in [`downstream.json`](../downstream.json).
They are intentionally excluded from `upstream.json`, because the automatic
sync would overwrite local changes. When Matt's upstream skills change,
compare the upstream commit recorded there, port relevant improvements into
the local variants, and update the recorded SHA manually.
