# DISCIPLINE — @dexli/family operating procedures

This document is the human-facing companion to the URL handoff infra. It
covers the four things bar item 8 calls out:

1. How to add a new sibling.
2. The slug-stability promise.
3. The recipient-parser-as-contract rule.
4. The three non-negotiable sender preconditions.

These are operational rules, not implementation detail. A new engineer
onboarding to family-tools infra reads this BEFORE touching
`family.config.ts`.

---

## 1. Adding a new sibling

A sibling joins the family registry only when ALL of:

1. The sibling has shipped to production (its `.dexli.dev` subdomain is
   live, serving real users) **OR is the subject of an active
   sealed-bar cycle requiring registration as a submit oracle.**
   *(Carve-out added 2026-05-29 from D4 cycle escalation —
   anti-speculation purpose preserved by the sealed-bar requirement.
   See "Cycle-N carve-out rationale" below.)*
2. Its URL-state contract is published in its repo at
   `src/lib/url-state.ts` (or the equivalent canonical location for
   that repo).
3. CTO approves the registration commit.

### Cycle-N carve-out rationale (added 2026-05-29)

The "shipped to production" precondition was V1-written as an
anti-speculation guard — preventing dead API surface from speculative
slug pre-allocation (e.g. registering `markdown` for a tool nobody's
built). The spirit is "don't register tools that don't exist."

But that letter creates a circular dependency for any cycle that uses
cycle-2's family-handoff as an in-cycle bar item: a venture-N venture
can't ship without bar-mandated registration, and the registration
needs the venture shipped. D4 (diff.dexli.dev) hit this directly when
item 7 required registration as a submit oracle. Every future venture
that uses family-handoff at v1 would re-litigate the same trap.

The "sealed-bar cycle" qualifier in clause 1 preserves the
anti-speculation purpose by structural means: registration during a
cycle is intentional (a sealed bar mandates it as a verifiable
submit oracle) rather than speculative (random pre-allocation
unbacked by any concrete plan). A sealed bar is itself the
non-speculative anchor.

Slug-stability (§2) still applies unchanged: once registered, the
slug is part of the family API forever, regardless of whether the
sibling ultimately ships. If a cycle that registered a sibling is
abandoned before deploy, the entry stays in the registry and the
sibling-record's `baseUrl` continues to be the canonical landing for
any future handoff URLs minted against the slug. Operators reading
the registry should treat any entry as a public commitment to that
slug-name and base-URL, irrespective of deploy state at any moment.

Precondition 2 (URL-state contract published) remains in force during
the carve-out: registration can happen mid-cycle once the recipient's
`readUrlState()` is in-tree, even if the sibling isn't yet live.

Add procedure:

1. Open a branch against `@dexli/family` master.
2. Add an entry to `FAMILY` in `src/family.config.ts`:
   - `slug` — a stable, short, lowercase identifier. See §2.
   - `baseUrl` — canonical origin including scheme. No trailing slash.
   - `path` — V1 ships flat `"/"`-rooted siblings only. Path-tokenized
     recipients are a future-cycle concern.
   - `inputs` — logical field name → URL param name. MUST EXACTLY mirror
     the sibling's `readUrlState()` accepted param keys. Empty `{}`
     when the sibling has no URL-state inputs (e.g. webhook's
     identity-based path).
3. Extend the `FamilySlug` union with the new slug.
4. Add a round-trip test in `src/handoff-round-trip.test.ts` importing
   the sibling's actual `readUrlState()` by reference (not mocked).
5. Extend the special-character round-trip suite with the new sibling
   so every registered recipient survives the full char-class matrix.

Anything beyond config + builder — envelope helpers, `?from=`,
inverse parse — is out of v1 scope and stays out unless a future
cycle's bar explicitly re-opens that surface.

## 2. Slug-stability promise

**Once a slug is registered for a shipped sibling, it is part of the
family's API forever.**

Consequences:

- A live handoff URL minted against the slug `cron` must continue to
  resolve indefinitely. Renaming `cron` → `schedule` is a breaking
  change even if the underlying tool is rebranded; the old slug stays
  in the registry.
- Slugs are NOT pre-allocated for unshipped siblings. A name like
  `markdown` doesn't enter the registry until markdown.dexli.dev is
  actually live. Speculative reservation creates dead API surface and
  inverts the "earned by user story" discipline V1 chose
  (`url-handoff-protocol-v1.md` §8).
- If a tool is sunset: deliberately remove the entry so callers
  fail-fast with `unknown-recipient` rather than mint URLs to a dead
  host.

## 3. Recipient parser is the contract

The shared infra produces URLs targeting each sibling's existing
`readUrlState()` parser. That parser is the ONLY source of truth for
what shape the URL must take. Practical consequences:

- The `inputs` map of each sibling in `family.config.ts` mirrors that
  parser's accepted param names. If a sibling renames `?t=` to
  `?text=`, the family.config entry MUST update in the same change.
  Failing to update creates silent param-name drift, the class of bug
  flagged in §12-risk-1 of the protocol memo.
- The shared infra does NOT define a separate "handoff input shape"
  for any sibling. There is no second URL-state surface. That's a
  v2 envelope-protocol concern explicitly rejected for v1.
- A CI drift-detection check (comparing each sibling's family.config
  inputs against its actual `readUrlState()` source) is the
  recommended next-cycle add. Out of cycle 2 scope.

## 4. Three non-negotiable sender preconditions

These preconditions are enforced inside `buildHandoffUrl` so a caller
using the builder cannot violate them. Stated here so a future
maintainer understands WHY the builder has the shape it has.

**A. Parser-is-the-contract.** A sender must not depend on
undocumented recipient parser behavior. The recipient's
`readUrlState()` source is the entire wire surface. If the recipient
changes its parser, the sibling registration MUST update in the same
change.

**B. Encode through the URL primitives.** Every input value passes
through `URLSearchParams.set()` before joining into the URL. This
guarantees correct percent-encoding for the character classes the bar
item 5 lists (newlines, %, &, +, =, [], (), /, \, #, ?, spaces,
non-ASCII Unicode, emoji). The builder rejects non-string inputs with
`non-text-value` because URLSearchParams.set's value typing is
`string` — Uint8Array, numbers, booleans, and other non-text data
cannot be encoded as a UTF-8 string and must use a copy-fallback path
chosen by the caller.

**C. Length-check the FINAL encoded URL, not the raw source.** The
builder measures `origin + path + '?' + queryString` byte length AFTER
encoding. A 3.8 KB body of `&` characters inflates to ~11.4 KB after
URLSearchParams encoding; a raw-length check on input would
spuriously pass. The current cap is 4096 bytes (`MAX_HANDOFF_URL_BYTES`).
Over-cap returns the `over-cap` failure signal carrying the measured
length so the caller can offer a fallback (e.g. "copy text + open
recipient blank").

---

Cross-references:

- Protocol memo: `url-handoff-protocol-v1.md` (§7 family.config shape;
  §11.5 sender preconditions; §12 risks).
- Commit convention + worker attribution: `CONTRIBUTING.md`.
