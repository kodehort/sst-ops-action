# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `kodehort/sst-ops-action`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone. Note the remote is `sst-ops-action`, not `sst-operations-action`; some documentation in this repo uses the longer name.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

How `/wayfinder` expresses its shared map on GitHub.

- **The map** — a GitHub issue labelled `wayfinder:map`. Its body holds the low-resolution map (Destination, Notes, Decisions so far, Not yet specified, Out of scope).
- **Tickets** — child issues of the map, using GitHub's **native sub-issue** relationship (`gh issue edit <map> --add-sub-issue <ticket>` or the sub-issues UI). Each carries a `wayfinder:<type>` label (`research` / `prototype` / `grilling` / `task`).
- **Blocking** — GitHub's **native issue dependencies** ("Blocked by"). A ticket is unblocked when every issue blocking it is closed.
- **Frontier query** — open sub-issues of the map that are unassigned and have no open blockers: `gh issue list --label wayfinder:<type> --state open --assignee "" --json number,title`, then drop any with an open "Blocked by".
- **Claim** — assign the ticket to the driving dev (`gh issue edit <number> --add-assignee @me`); the assignee is the claim.
- **Resolve** — post the answer as a comment, `gh issue close <number>`, then append a one-line context pointer to the map issue's "Decisions so far".
