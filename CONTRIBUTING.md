# Contributing — @dexli/family

This document is the source of truth for commit attribution. Bar item 11
requires ≥70% of non-trivial commits be attributable to named engineers (not
the CTO), verifiable mechanically from `git log` alone. The convention below
makes that bucketing one-pass.

## Roles

- **engine** — the URL handoff builder, family config registry, encoding
  + length-cap logic, failure-signal types, round-trip + special-character +
  surface-only tests. Owns `src/**/*`.
- **frontend** — any UI-bearing surface contributing to a family-tools
  workstream that lands artifacts in this repo (e.g. between-cycle work
  like `analytics-v1/` parser + report scripts authored by the family's
  frontend engineer). Owns whatever non-`src/**/*` workstream they are
  dispatched to per cycle.
- **scaffold** — CTO-only. Repo tooling (`package.json`, `tsconfig.json`,
  `vitest.config.ts`, `.gitignore`, this file, `README.md`), CI configuration
  if any, npm scripts, dependency hygiene.

## Commit convention

**Subject prefix (primary signal):**

```
feat(engine): single-call handoff builder with failure-signal return
fix(engine): length-cap measures final encoded URL not raw input
test(engine): round-trip via real recipient parsers for cron + regex
feat(scaffold): tsconfig + vitest setup
chore(infra): npm scripts + dependency hygiene
```

**Body trailer (unambiguous backup; REQUIRED on every non-trivial commit):**

```
Engineer: engine
```

Allowed values: `engine`, `frontend`, `scaffold`. Engineer-attributable
values are `engine` and `frontend`; CTO-attributable is `scaffold`.

A commit's bucket is determined by:

1. Read the subject's parenthesised tag. If it's `engine`, `frontend`, or
   `scaffold`, that's the bucket.
2. If the subject lacks a recognised tag, read the body for an
   `Engineer:` line. The value is the bucket.
3. If both are missing, the commit is unattributable and counts against
   the eval ratio (assume CTO).

## Between-cycle commits (`wip(<workstream>):`)

Between-cycle work — engineers' standing-mandate work that lands in this
repo between formal cycle dispatches — uses the `wip(<workstream>):` subject
prefix (e.g. `wip(analytics-v1):`). These commits MUST still carry an
`Engineer:` body trailer naming the responsible role (`engine`, `frontend`,
or `scaffold`).

Between-cycle commits live on `master` between cycle frozen-tags. They are
NOT part of any cycle's bar-item-11 attribution accounting — each cycle's
ratio is computed against the commits between its scaffold-start sha and
its `cycle-N/submit-K` tag, which by construction excludes between-cycle
work landed after a prior tag. If a between-cycle commit needs to be
counted within a cycle (e.g. because it materially affects that cycle's
deliverable), promote it to a `feat(<role>):` / `fix(<role>):` /
`test(<role>):` subject + include it in the cycle's review trail.

When eval bucketing walks `git log <prior-cycle-tag>..<current-cycle-tag>`,
`wip(<workstream>):` commits within that range follow the same `Engineer:`
trailer bucketing rules as any other commit — but the cycle's scaffold-
start sha should be chosen to exclude them when they aren't this cycle's
work.

## Trivial-exclusion list

Excluded from the bar-item-11 ratio denominator. Use these subject prefixes
freely without an Engineer trailer:

- `chore(deps): …`  — dependency bumps from package manager
- `chore(lockfile): …`  — lockfile-only updates
- `style: …`  — whitespace / formatting / lint
- `chore(version): …`  — version stamps

## Workflow

1. Engineer works in a git worktree off of `master`.
2. Branch name: `engine/cycle-N` or `frontend/cycle-N`.
3. CTO scaffolds + reviews + merges. Engineer pushes branch; CTO ff-merges
   when bar oracles hold.
4. Frozen tag `cycle-N/submit-K` at submit; no force-push between submit
   and verdict.

## Forbidden patterns

- Do not paste literal forbidden-string grep commands into commit bodies.
  The pattern text becomes a tree-history hit on its own future scan.
  (Banked discipline across prior ventures.)
- Do not absorb engineer-domain code into scaffold commits to "make
  progress faster." The five absorption-rationalization phrases —
  *small / surgical / my-spec-bug / eval-window / structural-clarity* —
  all map to CTO traps that defeat the multi-actor org pattern.
