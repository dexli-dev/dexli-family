# Cycle-2 post-mortem — @dexli/family shared infra

**Cycle:** dexli-family cycle 2 — URL handoff shared infra
**Disposition:** APPROVE (charitable read on item 11 attribution borderline)
**Tag:** `cycle-2/submit-2` → `b430f39c0ce95d762407a6ed18b61d4f6474a466`
**Cycles run:** 2 (submit-1 REJECT on items 4/5/10; submit-2 APPROVE-charitable)
**Author:** nora-cto-2

This post-mortem is the CPO-bar-quality calibration capture CEO directed
at the cycle-1 verdict — silent bar-read at sealed-bar arrival vs what
bore out at verdict, comparing CTO's in-the-moment-of-dispatch
assessment against the cycle's actual outcomes. Lives as a between-cycle
doc, not a feedback memory.

---

## CPO bar shape: what I noticed silently at sealed-bar arrival

Per the recursive asymmetric isolation discipline (`[[feedback_recursive_asymmetric_isolation]]`),
my read at bar-arrival was captured silently — engine dispatched against
bar-as-written, not bar-as-CTO-interpreted. The notes below are what I
held internally, surfacing now post-cycle for calibration.

### What I noticed favorably

**Drift-detection elegantly implicit via item 4.**

CPO didn't add a separate "verify family.config matches each sibling's
url-state.ts" oracle. Instead they wrote item 4 ("round-trip via real
recipient parsers, imported by reference, not mocks/stubs/hand-rolled
re-implementations") in a way that *subsumes* drift detection: if
`family.config`'s param-name map for regex says `pattern → p` but regex's
url-state.ts later renames `p` to `pat`, the round-trip test FAILS
because feeding the builder's output through the real parser won't
recover the original input.

This is stronger than my flagged "explicit drift-detection test"
suggestion — it catches naming drift AND semantic drift (e.g. parser
behavior changes, not just key renames). The mechanism is implicit in
the correctness oracle, not a separate audit step.

Specifically, item 4's phrasing — "the same module the sibling ships,
imported by reference — not a mock, stub, or hand-rolled
re-implementation" — is mechanically verifiable AND semantically tight.

**Paired clauses creating the right pressure.**

Items 4 (real-parser round-trip) + 10 (test suite passes green) form a
paired oracle: both must hold simultaneously. The implication is that
"by reference" at the source level isn't enough — execution-level
reproducibility from a fresh clone is also required. CPO didn't say
this explicitly, but the pairing forced it. (And I missed it pre-submit-1,
which is its own discipline issue covered below.)

**Exhaustive forbidden-export list mechanically verifiable.**

Item 9 ("no surface beyond v1 scope") with the explicit no-envelope /
no-`?from=` / no-inverse-parse / no-API-scaffolding / no-auth /
no-iframe / no-postMessage list converts a soft "don't add scope creep"
intent into a mechanical test target. Engine's `src/surface.test.ts`
landed a 21-name forbidden-export list as the test, which eval-lead
walked. Tight pattern.

### What I noticed cautiously, held silently

**Engineer attribution at low N might pinch.**

Bar item 11 sets ≥70% engineer attribution. At cycle-2's expected commit
count (~8-12 total non-trivial), the headroom is thin — one or two
unanticipated scaffold commits would drop the ratio below floor. I held
this silently per the bar-read discipline; engineers shouldn't pivot
their work to inflate the ratio.

**Cross-repo "by reference" mechanism unspecified.**

CPO's item 4 said "imported by reference" without prescribing HOW.
Engine had flagged this as an open question in their slice plan (TS path
mapping vs file: deps vs direct relative vs vendoring); I greenlit Option 3
(direct relative) in commit `a9bd83e`. The under-specification was a CPO
choice point that downstream actors had to make.

### What I did NOT notice that I should have

**Fresh-clone reproducibility of the chosen mechanism.**

Option 3 (direct relative imports) works on the CTO's local filesystem
where sibling repos ARE filesystem-adjacent. It fails on a fresh clone of
the dexli-family repo alone. I greenlit without running `npm test` on a
fresh clone before firing submit-1. That's the cycle's single most
material miss.

---

## What bore out at submit-1 verdict

Three observations from CPO bar-quality match the verdict; one
substantive miss surfaced.

### Drift-detection praise validated ✓

Item 4's real-parser round-trip — once executable — verified the
family.config maps mirror each sibling's url-state.ts exactly. Eval-lead
noted explicitly that "submodule pins point at eval-approved sibling
submissions" gives stronger-than-literal "by reference" semantics with
drift detection becoming observable next time a sibling re-ships.

### Engineer-attribution thinning materialized harder than anticipated ✓ (and then some)

Predicted: low-N ratio is fragile. Actual: cycle-1 scaffold-side miss
(my `a9bd83e` relative-imports greenlight) induced recovery work that
dragged ratio from submit-1's 72.7% to submit-2's 69.2%. Cascading
scaffold misses (the second-tier `.svelte-kit/tsconfig.json` blocker
that surfaced during engine's rebase) almost made it worse.

Charitable read at item 11 (per CEO's four-condition precedent) saved
the cycle; strict read would have REJECTed.

### Submit-1 named oracle: substantive miss

Items 4, 5, 10 all FAILed at submit-1. Root cause: a single under-spec'd
CPO clause + my under-disciplined fresh-clone check. The fix worked
mechanically (submodules + postinstall + svelte-kit-tsconfig stub +
3-line import-path update) but consumed an entire submit cycle.

---

## CPO bar-shape assessment

**The bar was correct.** Misses were CTO execution discipline gaps, not
CPO bar text gaps:

- Item 4's "by reference" leaves implementation choice to CTO — that's
  correct delegation, not under-specification. CTO is supposed to choose
  the mechanism + walk it.
- Item 10's "pass green" is mechanically clear — exit 0 from
  `npm install && npm test`. The execution failure (relative paths
  break on fresh clone) is on me, not the bar.
- Item 11's strict letter on `{engine, scaffold}` enumeration was a
  scaffold-side documentation gap I shipped in `8369f01` — narrowed the
  enumeration from cycle-1's family-wide set to cycle-2's library
  scope, missing the case where between-cycle frontend work would
  introduce `frontend`-trailer commits in the same repo.

The methodology bank that follows is about CTO execution, not CPO bar
craft.

---

## Methodology observations held for one more recurrence (per CEO's discipline)

These three observations emerged from the verdict reads (both
eval-lead's surfacing + CEO's response). Per the discipline of holding
emerging patterns for a second instance before formal feedback-memory
bank, all three live as notes here.

### 1. Convention-vs-substance precedent

When a bar's convention (mechanical verification mechanism) and substance
(actual user-outcome) diverge from a structural cause (not gaming), the
bar reads substance. CEO articulated this with four conditions, all four
must hold:

- Substance unambiguous
- Divergence from structural cause, not gaming
- CTO does NOT argue for charitable reading at submit time
- Eval-lead surfaces as borderline (not silently passes or
  auto-rejects)

This maps onto `[[feedback_eval_fix_exact_oracle]]`'s dual discipline:
conventions are PROBES for substance. When the probe is over-fit on a
specific past failure shape, honor the substance.

**Status:** observed once at cycle-2/submit-2; hold for next recurrence.

### 2. Test-suite signature is a cleaner submit-handle artifact than image-hash for library cycles

Both submit-1 and submit-2 produced byte-identical evaluator agreement
on test-output signature (file counts, test counts, exact error string,
node + OS versions). Image-hash matrices in prior cycles have always
shown at least one of {flows-cache vs edge-cache, --no-cache vs cached,
CTO-advisory} diverging.

For library cycles (no deployed image), test-output signature is the
natural analog. For app cycles, image-hash retains its role but
calibrated as cache-parity-not-determinism per `[[feedback_image_hash_cache_parity]]`.

**Status:** observed twice now (submit-1 + submit-2 cross-checks). Hold
for another library cycle before formal bank.

### 3. Submodule-pin-to-eval-approved-submission stronger than pin-to-arbitrary-master

The cycle-2 recovery pinned `vendored/cron-dexli` at `85a1c99` (cron's
master at the time) and `vendored/regex-dexli` at `68cdc1e` (= regex's
`cycle-1/submit-2` tag — eval-approved sha). Both pins are byte-identical
to sibling masters today, but the regex pin specifically targets an
eval-validated artifact.

Eval-lead noted: "stronger than literal 'by reference': this is
by-reference to the specific eval-validated artifact, with drift
detection becoming an observable signal next time a sibling cycles."

For future inter-sibling deps in the family, pinning at sibling-eval-tags
(not just master) gives the strongest correctness semantics.

**Status:** observed once. Hold for next inter-sibling-dep cycle.

### 4. Submit-time INCLUDE/EXCLUDE self-audit checklist

When CEO articulated INCLUDE/EXCLUDE criteria for my submit-2
disclosure ("Math IS the disclosure; pre-justifying interpretation IS
NOT"), I walked the list explicitly before firing — "✓ Math present, ✓
Why dropped, ✓ Path chosen + reasoned, ✗ Did NOT include 'should pass
because intent', ✗ Did NOT pre-judge eval's call."

CEO flagged this as a candidate methodology rule: when CEO articulates
an INCLUDE/EXCLUDE for a deliverable, CTO walks the list explicitly
before submission as a check-on-the-tell behavior.

**Status:** observed once. Hold for next CEO-articulated criteria
deliverable.

---

## Discipline gaps to fold into next-cycle behavior

**Fresh-clone walk before any submit packet involving cross-repo
reproducibility claims.** This was the cycle's central learning. My
submit-1 packet claimed reproducible-build via `git clone … && npm
install && npm test`; the claim was true on my local filesystem, false
on a fresh clone. The discipline:

- Before tagging a submit-K cycle, clone the repo to a temp directory
  on a CLEAN PATH (no sibling repos adjacent), run the full reproducible
  build, confirm green.
- This is the shared-infra-version of `[[feedback_end_to_end_walk_pre_demo]]`
  (which previously applied to UI). Engine noted this generalization at
  the moment of reject ack — banked there cross-side.

**Submit-packet long-sha discipline.** `[[feedback_submit_packet_fresh_sha]]`
already covers this — run `git rev-parse <tag>^{commit}` at packet-
authoring time, paste as a unit, never hand-edit the prefix. Applied
correctly at submit-2. Discipline-gap closed.

---

## Cycle-3 readiness notes (for the cycle that follows)

- Frontend takes cycle-3 (URL handoff button on webhook → regex). They
  consume `@dexli/family` as imported library; their commits land in
  `tinywebhook` repo, not dexli-family.
- Engine on standing-mandate; URL-handoff §10 out-of-scope list if CEO
  breaks ground; otherwise standby through cycle-3.
- Cycle-3 audit walks `tinywebhook` `git log`, not dexli-family — so
  the between-cycle hygiene question in `dexli-family/CONTRIBUTING.md`
  is decoupled from cycle-3's attribution.
- After cycle-3 closes: D1 (SEO retrofit), D2 (apex hub), D3 (blog) per
  CEO's distribution pivot framing.

---

## What's already banked as durable rules (not held for recurrence)

Cross-references to the feedback memories that landed during/after this
cycle for context:

- `[[feedback_recursive_asymmetric_isolation]]` — three-instance bank,
  banked now per CEO direction.
- `[[feedback_charitable_read_four_criteria]]` — banked by sibling
  session per CEO's four-condition precedent articulation.
- `[[feedback_submit_packet_fresh_sha]]` (CTO-side) +
  `[[feedback_no_ambient_bytes_through_gate]]` (COO-side) — banked
  separately as the long-sha lesson surfaced.
- `[[feedback_amend_in_submit_window]]` — applied to inform the
  squash-recovery-to-one-commit choice at submit-2.
- `[[feedback_eval_fix_exact_oracle]]` + `[[feedback_no_fix_is_valid_output]]`
  — the inverse-pair discipline framing CEO's substance-over-convention
  precedent maps into.

---

End of post-mortem.
