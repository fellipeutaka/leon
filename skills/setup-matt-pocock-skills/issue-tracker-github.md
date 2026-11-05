# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: write the exact Markdown body to a temporary file, then use `gh issue create --repo <owner/repo> --title "..." --body-file <path> --assignee <developer>`. Apply the ownership policy below.
- **Read an issue**: `gh issue view <number> --json number,title,body,state,assignees,labels,comments,url`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Make an issue a sub-issue of a parent**: `gh issue create --parent <parent> ...`, or `gh issue edit <parent> --add-sub-issue <child>` afterwards (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>` (database id, as in **Blocking** below). Without sub-issues, put `Part of #<parent>` at the top of the child body.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh issue create --blocked-by <n>,<n> ...` or `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). Older `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Count open blockers**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (open blockers only; 0 means startable). `gh issue view <n> --json blockedBy` also lists closed blockers, so filter it: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: post the explanation with `gh issue comment <number> --body "..."`, then `gh issue close <number>`. On an already-closed issue, `gh issue close --comment` drops the comment and still exits 0.

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

File issues only into the user's own repo. Never file into `mattpocock/skills` (the repo these skills come from) unless the user owns it. In a fork, `gh` can default to the upstream parent, so before the first `gh issue create` of a session, check the target with `gh repo view --json nameWithOwner` and confirm it with the user if it is not their repo.

## Ownership and work tracking

The setup skill replaces the placeholders below with verified repository settings. When Project tracking is disabled, record `Project: disabled` and omit the Project-only settings, Status mapping, and Project commands. An access failure is pending setup, not disabled tracking.

- **Repository**: `<owner/repo>`
- **Final PR base**: `<branch>`
- **Completion**: the final delivery PR is verified merged into the intended base; deployment to production is tracked separately.
- **Project**: `<URL>`
- **Project owner**: `<organization-or-user>`
- **Project number**: `<number>`
- **Status field**: `<existing single-select field name>`
- **Native workflows**: `<verified configuration and any pending UI steps>`

### Ownership

New PRDs belong to the developer driving the session. Resolve the authenticated identity with `gh api user --jq .login` unless the user explicitly names another developer. New child issues inherit the parent's assignees; when the parent has none, use the driving developer. Preserve existing assignments on retries and resumes unless reassignment was requested.

An assignee reserves work; it does not mean implementation has started. Under `/implement-spec`, ownership of the PRD reserves the scope of that integration run. Child issues in that scope are not independently available just because their Status is Todo or their assignee is missing. For work performed per ticket, claim only the selected ticket unless the user assigns the whole feature.

Before claiming existing work, read its assignees, Status, parent reservation, and linked PRs. Another developer's reservation requires an explicit handover. Assigning an issue is not an atomic lock: read it back and surface conflicting ownership instead of silently proceeding. Inactivity alone never authorizes reassignment.

### Status mapping

Use the selected Project's Status field as the source of progress. Replace the option names with existing equivalents during setup; retain triage and scope labels for their separate meanings. Lifecycle labels are not a second source of Status.

| Flow state | Project option | Transition evidence |
| --- | --- | --- |
| `todo` | Todo | Newly published work, or work explicitly returned to the pool |
| `in-progress` | In progress | Implementation or repair has started |
| `waiting-validation` | Waiting validation | Final delivery PR is open and ready for review |
| `blocked` | Blocked | A concrete dependency or external impediment prevents progress |
| `paused` | Paused | The developer explicitly pauses work and retains ownership |
| `done` | Done | Final delivery PR is verified merged into its intended base |

Initialize Todo only for newly published work. On resume, reconstruct progress from remote issue/PR state and integration commits before updating Status. An integrated ticket remains non-terminal while the final integration PR is unmerged; its commit can release dependents inside that integration run even though native issue dependencies still show an open blocker.

When the final PR is ready, move its PRD and delivered tickets to Waiting validation. Unstarted or out-of-scope tickets retain their current state. If review requires more work, return the affected scope to In progress. The orchestrator owns these updates; implementer subagents return evidence and leave issue and Project completion to the final delivery.

Pausing or blocking includes a comment with the branch/PR, last integrated commit, remaining work, impediment, and next step. Explicitly releasing work includes that checkpoint, removal of the releasing developer's assignment, and Todo. Keep dependencies intact. A cancelled proposal uses an explicit not-planned closure rather than an inactivity label.

### Project operations

1. Read this configuration before publishing, claiming, resuming, or delivering work. Use the issue-only ownership policy when Project tracking is explicitly disabled. If an older tracker document has no Project configuration, retain issue-only operations and report that Project setup is missing instead of choosing a Project by guesswork.
2. Check access and live field options with `gh project view <number> --owner <owner> --format json` and `gh project field-list <number> --owner <owner> --format json`. Resolve the Project node ID, Status field ID, and target option ID from remote state. Reading requires `read:project`; updates require `project`. Missing scope: ask the developer to run `gh auth refresh --hostname <host> --scopes project` in their terminal. Organization authorization may still be required.
3. Find the existing item by its exact issue URL. Enumerate items with `gh project item-list <number> --owner <owner> --format json` using a sufficient limit or paginated GraphQL; the default first page is not proof of absence. Add only missing membership with `gh project item-add <number> --owner <owner> --url <issue-url> --format json` and retain the returned item node ID. Use real issues, not duplicate draft cards.
4. Set the single-select Status with `gh project item-edit --id <item-id> --project-id <project-id> --field-id <status-field-id> --single-select-option-id <option-id>`. Use `gh project item-edit --help` for version-specific alternatives. Only change the selected Project; preserve unrelated fields and membership in other Projects.
5. Read the issue and Project item back. Verify assignment, membership, and the intended Status. A retry reuses the same issue and item without resetting progressed work. Preserve published URLs and report tracking failures separately; a failed Project update does not justify duplicate issues, premature closure, or discarding authorized implementation work.

Prefer native Project workflows for auto-add and issue-closed-to-Done reflection. Auto-add handles newly created or updated matching issues, not a historical backfill. Configure views for progress by Status, work by assignee, paused/blocked work, and candidates with Todo and no assignee. Availability also requires satisfied dependencies and no parent reservation or active delivery PR. In a shared Project, scope these views and workflows to this repository.

### Final delivery and closure

Read the actual default branch with `gh repo view --json defaultBranchRef`. When the final PR targets that branch, include a separate `Closes #<number>` for every fully delivered issue, including the PRD only when its entire scope is accepted. Use `Refs` in intermediate commits and PRs. Opening a PR or integrating a child branch leaves issues open and Project states non-terminal.

For another base, use ordinary references and record closure as requiring a separately authorized operation after verifying the final PR's merge. Native closing keywords in a non-default-base PR do not provide automatic closure. A closed-but-unmerged PR is not completion. Repository default-branch changes and merges require their own authorization; setup records policy without silently changing either.

After merge, verify the closed issue states and the Project's Done reflection. Report remaining mismatches for reconciliation from remote merge evidence. The Project must not close issues merely because someone moves a card to Done. Configure issue completion to drive the Project, preserving the final-merge gate.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number>`, then `gh pr view <number> --comments` (off a TTY, `--comments` prints only the comments, not the body), and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (see **Make an issue a sub-issue of a parent**). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: see **Blocking** under Conventions.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (see **Count open blockers**, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
