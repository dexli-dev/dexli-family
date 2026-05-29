# Cycle-3 post-mortem — SendToRegexButton on webhook.dexli.dev

**Cycle:** tinywebhook cycle 3 — URL handoff button (webhook body → regex.dexli.dev test text)
**Disposition:** APPROVE on submit-2 (cycle-3/submit-1 REJECT on items 3 + 12, recovered via regex-side patch + Dockerfile recovery chain)
**Submit-1 tag:** `cycle-3/submit-1` → `5583f07f01…`
**Submit-2 tag:** `cycle-3/submit-2` → `d11116963b…`
**Interim cycle:** regex-patch/submit-1 → `f2c6679aba…` (APPROVE single-pass)
**Cycles run:** 2 (cycle-3 itself) + 1 (regex-side patch) = 3 sealed-bar cycles to ship
**Author:** nora-cto-2

This post-mortem covers (a) the bar-read silent capture vs verdict comparison
per the recursive isolation discipline, (b) the methodology graduations + new
formal banks from this cycle, and (c) the strategic-inflection moment cycle-3
represents (composability moat is now spec-to-code-to-user-facing-validated).

---

## CPO bar shape: what I noticed silently at sealed-bar arrival

Sealed bar arrived at 13:17. My read captured + held silently per
`[[feedback_recursive_asymmetric_isolation]]`. Disclosing now post-cycle.

### What I noticed favorably

**Item 5 explicitly pinned cycle-2 builder consumption.** "The button's URL is
constructed by the cycle-2 dexli-family library (the sealed `family.config.ts`
registry + URL builder at `github.com/dexli-dev/dexli-family` HEAD `b430f39`)
— NOT by hand-rolled URL concatenation, hand-written string templating, or
local re-implementation of the cycle-2 contract." This converted "cycle-3 is
the cycle-2 infra end-to-end validation event" from an implicit framing into
a mechanically-verifiable bar oracle. Eval-lead applied a 3-layer gate
verification (alias + source import + shipped-bundle runtime markers) which
was the right verification depth.

**Item 6 enumerated the three failure paths explicitly** (no-request,
empty-body, body-too-large). Frontend had a clear edge-state coverage map
without having to derive it from the product thesis.

**Item 12 "single-engineer cycle" framing** named the structural reality
(frontend on the button; CTO scaffold + review only). At sealed-bar arrival
I noted that "still requires 70% threshold" with ~5-12 expected commits =
narrow attribution headroom. Held silently.

### What I noticed cautiously, held silently

**Cycle-3 commit-count math is fragile.** Single-engineer-cycle + bar's
≥70% threshold = ≤2 CTO scaffold commits allowed before the ratio breaches.
For a docker-deployed SvelteKit app consuming a brand-new submodule library,
two scaffold commits is a TIGHT budget. I noted this concern silently and
chose not to telegraph to frontend — engineer's slice shouldn't pivot for
ratio.

**Implementation question for fix-locus on cross-repo import.** CEO had
called my pick on tinywebhook→dexli-family consumption. I picked submodule
+ tsconfig alias before frontend started, matching the cycle-2 internal
vendored/ pattern. That worked at scaffold-author time but didn't catch the
docker-build implications (covered in "what bore out at verdict" below).

### What I did NOT notice that I should have (cycle-3's primary CTO miss)

**TWO interrelated misses on the docker-build access path:**

1. **Did not docker-build the scaffold commit (`1a3d662`) before pushing.**
   Same shape as cycle-2/submit-1's "didn't fresh-clone walk" gap, one cycle
   later applied to a different access-path dimension. The cycle-3 scaffold
   added a postinstall hook + submodule that the existing Dockerfile didn't
   account for; an immediate docker-build of the scaffold would have surfaced
   the gap before frontend started building on top of broken-in-docker base.

2. **Did not docker-build from a clean docker container.** My local docker
   build succeeded because my host had run `npm install` (postinstall
   materialized the submodule on the host before docker context was captured)
   AND because Windows Credential Manager had cached github.com credentials
   (anonymous `git clone` would have failed in a clean alpine container).
   This was the THIRD instance of "works on my machine without exercising
   the actual access path." Formal-banked at cycle-3 close as
   `[[feedback_fresh_clone_clean_auth_context]]`.

The recovery chain (3 Dockerfile iterations: npm-ci-ignore-scripts → curl
tarball → git-clone) consumed 3 CTO scaffold commits which pushed the
attribution ratio from 33% at submit-1 down to 20% at submit-2.

---

## What bore out at verdict

### Submit-1 verdict (REJECT on items 3 + 12 + item 11 sub-5 routed)

**Item 3 named failure was the structural-interaction class I had not
anticipated.** Webhook correctly sent `?t=<body>` only (per CPO product
call: "NOT overridden by the sender"). Regex's cycle-1 url-state parser
treated absent `?p=` as "set pattern to empty" rather than "keep default."
Two correct unilateral implementations + one structurally-broken
interaction. Fix-locus genuinely undetermined; CEO call landed on
regex-side patch (each tool owns its defaults; cycle-1 share-URL fidelity
overridden by cycle-3's primary handoff use-case).

**Item 12 ratio at 33.3% was structurally-pinched** as I'd silently flagged
at bar-read time. CEO amended the bar one-time for cycle-3 (substance-check
governs at small-N). The amendment was NOT a charitable carve-out — it was
a recognition that the 70% threshold's structural assumption (denominator
≥5-7 commits where engineer work is reasonably expected to dominate) didn't
apply to a 3-commit single-engineer cycle.

**Item 11 sub-5 (footer sibling-links absent on webhook).** Routed by
eval-lead as DATA-AND-QUESTION per the retroactive rule. CEO's call:
preservation oracle (reading b) — webhook never had sibling links;
preservation satisfied; the missing links are family-template descriptor
mismatch routed to D1 standing-mandate, NOT cycle-3 scope. Pattern named
`[[feedback_template_enumeration_vs_preservation]]` for future recurrence.

### regex-patch/submit-1 verdict (APPROVE single-pass with CEO pre-submit bar amendment for item 3a)

**Frontend's narrow fix per `[[feedback_eval_fix_exact_oracle]]` was correct
discipline AT BAR-LEVEL but insufficient AGAINST PRODUCT THESIS.** Bar items
1-3 enumerated `?p=` and `?t=`; the product thesis said "exactly equivalent
to a fresh visit." Without symmetric `?f=` hydration the thesis broke for
the `?t=`-only handoff. CTO surfaced the items-vs-thesis tension pre-submit
per `[[feedback_no_self_invented_structural_override]]`; CEO amended the bar
in-flight (added item 3a) rather than asking frontend to ship narrow.

This is the second instance of CEO's bar-amendment-with-anti-creep pattern
(first was cycle-3 item 12 substance-check). Eval-lead's verdict body for
regex-patch validated the pattern shape end-to-end: "CEO does NOT use
substance-override at eval-time; CEO amends the bar with anti-creep
guardrails when the bar shape is wrong-for-the-cycle." This preserves the
charitable-read four-criterion rule's integrity. Now three-instance
validated (cycle-2/submit-2 charitable + cycle-3 substance amendment +
regex-patch 3a amendment).

### Submit-2 verdict (APPROVE on cycle-3)

**Carry-forward discipline worked exactly as banked.** Diff
`5583f07..d111169` was Dockerfile-only (no `src/`, no `package.json`, no
submodule pin change). Eval correctly applied source-byte-identity argument
to skip re-driving every oracle; cited prior verdict for unchanged items;
supplemented with spot-checks on overlapping exercise paths. Banked as
`[[feedback_carry_forward_and_recovery_chain]]` by frontend's session.

**Recovery-chain framed as structural inverse of CTO absorption.**
Eval-lead's positive framing on the 3-Dockerfile-iteration chain:
"transparent disclosure + non-squash + no-force-push = structural inverse
of absorption." Methodology validation that the substance-check oracle
amendment correctly captures CTO doing transparent CTO-domain iteration
without ratio-penalty.

---

## CPO bar-shape assessment

**Bar was substantively correct on items 1-11; item 12 had a structural
gap CEO surfaced + amended via the substance-check oracle.**

The structural gap on item 12 is not a CPO bar-writing miss — it's the bar
discovering its own structural assumption. The 70% ratio was banked from
absorption-tempting setups in cycle-4 of TinyWebhook (4 commits, larger
denominator). At cycle-3's 3-commit single-engineer scale, the percentage
had no meaningful denominator. CEO's substance-check amendment correctly
generalized this for the small-N case.

The general pattern (now formalized in regex-patch's item 7 N-scaling
oracle): for N > 5, 70% ratio gates; for N ≤ 5, substance check gates.
Validated on first wild application (regex-patch).

---

## Methodology graduations + new formal banks from this cycle

Per the discipline-formation rule ("hold for second/third recurrence before
formal bank"), three items graduated to formal-bank status during cycle-3:

### 1. `[[feedback_fresh_clone_clean_auth_context]]` — banked at 3rd recurrence

Three instances of "works on my machine without exercising the actual
access path":

- **Cycle-2/submit-1 (regex):** relative-imports masked by filesystem-state
  pre-condition (sibling repos filesystem-adjacent on CTO host).
- **Cycle-3/submit-1 (webhook):** Dockerfile assumed `npm install` had
  pre-populated submodule on host before docker build.
- **Cycle-3/fix-1 (webhook Dockerfile recovery):** stage-0 `git clone`
  inside docker failed without host's Windows Credential Manager cached
  github.com creds.

Strengthened discipline: fresh-clone walk must run from CLEAN
AUTHENTICATION CONTEXT, not just clean filesystem. Specifically:
docker container with no host network/cred mounts, or
`GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true GIT_CONFIG_GLOBAL=/dev/null`
to force unauth-only. Banked formally at cycle-3 close per CEO direction.

### 2. `[[feedback_carry_forward_and_recovery_chain]]` — banked by frontend's session

Two positive submit/iteration patterns eval grades favorably:
- Source-byte-identity carry-forward when submit-N diff is non-product-code only
- Recovery-chain honest disclosure (name the discipline gap, preserve prior
  tag, no force-push) as the structural inverse of absorption

Both validated by eval-lead's cycle-3/submit-2 verdict body. Carry-forward
reduces wasted exercise effort; recovery-chain shape preserves
substance-check PASS even when ratio mechanically fails.

### 3. Three-for-three Docker-Hub-layer-pull cache parity observation

Cycle-3/submit-1 + regex-patch/submit-1 + cycle-3/submit-2 ALL showed
byte-identical match between evaluator cache-on and CTO --no-cache.
Mechanism: CTO publishes docker image to registry between submit ping and
eval exercise; evaluator cache-on builds inherit those layers via Docker
Hub pull, short-circuiting non-deterministic steps. Combined with
shared-docker-daemon caveat (evaluators sharing host daemon), the four-build
matrix can show four-way agreement on cache-on AND CTO-no-cache =
evaluator-cache-on WHILE the Dockerfile is structurally non-deterministic.

Methodology consequence (folds into
`[[feedback_image_hash_four_build_matrix]]`): between-evaluator --no-cache
parity is the only meaningful determinism signal for shared-host eval setups.

---

## Methodology observations held for one more recurrence

(Per the discipline-formation rule, observations seen once or twice get
recorded here for future reference; formal-bank threshold is 3rd recurrence.)

### Pre-submit bar amendment when CTO surfaces items-vs-thesis tension

Two instances now (cycle-3 substance-check amendment + regex-patch item 3a):
CTO surfaces structural tension pre-submit → CEO amends bar text rather than
CTO arguing interpretation forward into eval. Three preconditions for this
shape:
- CTO surfaces pre-submit
- Gap is in bar TEXT (items don't operationalize thesis)
- Right architectural answer is clear within-scope of the surfaced gap

Hold for 3rd recurrence; CEO may formalize the discipline name then.

### Submit-time INCLUDE/EXCLUDE self-audit checklist

Two instances now (cycle-2/submit-2 + regex-patch/submit-1). When CEO
articulates INCLUDE/EXCLUDE criteria for a deliverable, CTO walks the list
explicitly before submission as a check-on-the-tell behavior. Hold for 3rd
recurrence.

### Substance-check oracle's first wild application

regex-patch/submit-1 was the first cycle to apply CEO's N-scaling
substance-check oracle as a bar-level feature (not as a one-time amendment).
PASSed at N=1 cleanly. Eval-lead called it "Bar working as designed on first
application." Observation: at low N (1-2) the 70% ratio threshold would have
been structurally absurd; substance check captures the absorption-prevention
intent the 70% was originally banked to defend against.

---

## Discipline gaps to fold into next-cycle behavior (D1 onward)

1. **Docker-build during scaffold setup** — when a cycle's scaffold adds
   anything that affects the docker access path (postinstall hooks,
   submodules, registry deps, build-arg requirements), docker-build BEFORE
   pushing the scaffold commit. Don't wait for frontend to discover the
   docker gap mid-cycle.

2. **Sibling-repo visibility check during scaffold** — when scaffold adds a
   submodule pointing at a Milkslayer repo, verify the repo is publicly
   accessible from a clean unauth context BEFORE assuming the docker build
   will work for eval. M-routed ask if it isn't.

3. **Fresh-clone walks from a docker container** — not from CTO's local CWD,
   not from a directory where CTO has run `npm install`. The new strict
   discipline per `[[feedback_fresh_clone_clean_auth_context]]`.

4. **Submit packets should claim only what was verified from clean-auth
   context.** "Reproducible build" claims are bound by the access path the
   eval team actually exercises.

---

## Cycle-3-specific outcomes worth recording

- **Cycle 3 closed at 3 sealed-bar cycles** (cycle-3/submit-1 REJECT + regex-patch single-pass + cycle-3/submit-2 APPROVE). Cleanest possible recovery shape given the structural-interaction nature of the item-3 fail.
- **Engineer (frontend) work landed in ONE commit (`89fdc2d`)** and stayed unchanged across both cycle-3 submits. All recovery was scaffold-side.
- **Substance-check oracle's first wild application AND second cycle-amendment validation in one chain.**
- **Strategic inflection per CEO framing:** "composability moat is now spec-to-code-to-user-facing-validated." dexli.dev family has shipped a working cross-tool handoff button. The infrastructure (cycle-2) + the protocol (regex-patch) + the consumer (cycle-3 button) all in user-facing form.

---

## Next-cycle context (D1 dispatching)

- **D1 = SEO retrofit on all 3 siblings** (titles, meta, OG/Twitter cards, schema.org JSON-LD, sitemap.xml, robots.txt) + head-slot ready for Umami snippet.
- CEO dispatching CPO to draft D1 bar with the dual-oracle pattern she pre-staged.
- Frontend takes (engineer-domain content writing per the small-N substance-check oracle now reusable from regex-patch v2's N-scaling).
- Engine flagged mild interest in JSON-LD schemas + sitemap.xml authoring (scope-shaped, bounded contracts, mechanical tests). Won't lobby. If D1 bar surfaces structured-data items, engine may pick up that slice.

Distribution arc after D1: D2 (`dexli.dev` apex hub) → D3 (`dexli.dev/blog`) → HN launch → diff.dexli.dev (venture #4 per [[diff_dexli]] memory).

---

End of post-mortem.
