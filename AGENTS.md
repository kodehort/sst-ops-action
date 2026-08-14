# AGENTS.md

Command-level notes for agents. Architecture and policy live in `CLAUDE.md`;
this file records only things that cost a wasted run to discover.

> Not the stock fallow template. `fallow hooks install --agent codex` would
> overwrite this with a block contradicting `CLAUDE.md` — do not run it here.

## git and jj

- `jj` signs commits through the 1Password SSH agent. When the vault is locked
  every `jj` command fails, not just writes: `jj` snapshots the working copy on
  each invocation, so even `jj st` errors with `Signing error / SSH sign failed`.
  `ssh-add -l` still lists the keys, so it is not a diagnostic. Unlock 1Password.
  Nothing is lost; the working copy is untouched.
- `jj commit` takes `--message`, not `-F`. Pass a file with
  `--message "$(cat <file>)"`.
- `jj git push --bookmark <name>` pushes a new bookmark as-is. This jj version
  rejects `--allow-new`; newer ones accept it, so check before assuming either.

## gh

- The repo disallows squash merges. Use `gh pr merge <n> --rebase --delete-branch`.
- Under `jj`, HEAD is detached, so `gh` prints
  `could not determine current branch: failed to run git: not on any branch`.
  **This appears after the merge has already succeeded** — it is the local-branch
  cleanup failing. Confirm with `gh pr view <n> --json state` before retrying;
  retrying reports "already merged".
- Set `GH_REPO=kodehort/sst-ops-action` rather than passing `--repo`.
- Write PR and issue bodies with `--body-file`. Heredocs mangle backticks and
  backslashes in markdown.

## Merging a stack

Every merge to `main` fires the release workflow, which commits a rebuilt
`dist/`. That conflicts with every other open PR, so merge one at a time and
rebase the rest:

```sh
jj git fetch
jj rebase -b <bookmark> -d main
jj new <conflicted-change-id>
bun install --frozen-lockfile && bun run build   # resolves the dist conflict
jj squash --into <conflicted-change-id>
```

A PR with conflicts runs **no CI at all** — checks appear absent rather than
failing. If `gh pr checks` shows only third-party checks, look at
`gh pr view <n> --json mergeable`.

## Tests

- Removing a dependency means deleting its `vi.mock` block in
  `__tests__/setup.ts`. Left behind, it breaks module resolution for the whole
  suite, not just the file that used the dependency.
- `vi.clearAllMocks()` in a `beforeEach` strips the implementation off a
  `vi.fn().mockImplementation(...)`. For a mocked **constructor**, use a real
  `class` in the `vi.mock` factory, or `new` yields `undefined`. Same trap for
  any stub that must call through.
- `vi.mock` factories are hoisted above `const` declarations; share constants
  with the assertions via `vi.hoisted()`.
- `createMockDeployResult` returns a deep-partial, which
  `exactOptionalPropertyTypes` rejects at a concrete parameter. Write an
  explicit fixture typed to the narrowest interface the code under test needs.

## fallow

- Run the audit with **no `coverage/` directory present**. fallow computes CRAP
  from real coverage when `coverage/` exists and from export references when it
  does not, and CI's audit step runs before its coverage step — so a local run
  after `test:coverage` sees different numbers than CI and can pass where CI fails.
- `audit` only sees changed files, so deleting an export can orphan a symbol in
  an untouched file and still pass. Releases run `fallow check --fail-on-issues`
  tree-wide; run that too before pushing anything that deletes code.
