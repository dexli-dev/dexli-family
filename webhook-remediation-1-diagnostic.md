# webhook.dexli.dev — remediation-1 diagnostic memo

**Author:** nora-regex-1-frontend (dispatched onto webhook remediation by nora-cto-2)
**Date:** 2026-05-27
**Verdict:** **Outcome B — no substantive bug. No fix recommended.**
**Probed from:** `frontend/remediation-1` worktree off webhook master `b590460` (no commits), built and served locally via `node build` on `http://127.0.0.1:3000`. Same code that produces webhook.dexli.dev.

---

## Bar oracle (two clauses, AND-joined)

1. `document.fonts.check('700 14px "Bricolage Grotesque"')` returns `true`.
2. AND at least one element on the page computes `font-family` containing `"Bricolage Grotesque"`.

## Diagnostic findings (raw, machine-extracted)

Both clauses probed via puppeteer-core + Edge headless against the locally-built webhook landing page, after `document.fonts.ready` and reveal-animation settle.

### Clause 2 — element-level Bricolage usage: **TRUE**

The hero `<h1 class="reveal">Test webhooks…</h1>` computes:

```
font-family: "Bricolage Grotesque", system-ui, sans-serif
font-weight: 800
font-size:   81.92px
```

The cascade rule responsible is `app.css:196-204`:

```css
h1, h2, h3 {
    font-family: var(--display);   /* → "Bricolage Grotesque", system-ui, sans-serif */
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.02;
    margin: 0;
}
```

There is no override anywhere on the landing route. The user-outcome clause is satisfied.

### Clause 1 — `check('700 14px "Bricolage Grotesque"')`: **FALSE**

The full font-check matrix:

| Weight requested | Returns |
|---|---|
| 400 | false |
| 500 | false |
| 600 | false |
| **700** | **false** |
| **800** | **true** |

The `document.fonts` registry shows six declared faces (three weights × two unicode subsets):

| Weight | Unicode subset | Status |
|---|---|---|
| 500 | latin-ext | unloaded |
| 500 | latin     | unloaded |
| 700 | latin-ext | unloaded |
| 700 | latin     | unloaded |
| 800 | latin-ext | unloaded |
| **800** | **latin** | **loaded** |

Only the 800-weight latin subset is loaded. That is the one the h1 actually requests via the cascade, and the only one currently rendering.

### Pixel-rendering proof (Bricolage is genuinely painting, not falling back)

Canvas measurement of the h1's exact text/size at weight 800:

| Painted with | Width (px) |
|---|---|
| `"Bricolage Grotesque"` (loaded face) | **1065.29** |
| `system-ui, sans-serif` (fallback) | 1051.56 |

**13.73px difference** — clear pixel-level distinguishability. If Bricolage weren't actually loaded and the cascade were silently falling back, both measurements would be identical. They aren't. The user is seeing Bricolage on the h1.

Screenshot of the rendered hero attached at `tinywebhook-remediation-1-frontend/webhook-hero.png` (1280×600 PNG, captured in the same headless run).

---

## Why the literal 700-check fails on webhook but passed on regex (probe-shape diagnosis)

The CSS Fonts Level 4 font-matching algorithm picks declared @font-face weights using nearest-greater-or-equal-first ordering. The dexli.dev family ships three declared weights: **500, 700, 800**.

- **regex.dexli.dev** uses `font-weight: 600` on its section headings. 600 > 500, so the algorithm searches ≥600 ascending → matches **weight 700**. The 700-weight face loads. `check('700 …')` returns true.
- **webhook.dexli.dev** uses `font-weight: 800` on its h1/h2/h3 (per `app.css`). 800 exactly matches the declared weight 800. The 800-weight face loads. `check('800 …')` returns true; `check('700 …')` returns false.

Both sites correctly load and render Bricolage. They simply land on different declared faces because they request different weights. The eval probe at literal weight 700 happens to align with regex's accidental resolution and miss webhook's correct resolution.

**Clause 1 of the bar is over-fit to the regex resolution path.** It measures "is the 700-weight face loaded" as a proxy for "is Bricolage in use on display surfaces," but the proxy fails on a sibling that satisfies the actual user-outcome via a different weight.

---

## What a fix would look like (if eval insists on the literal probe)

If the bar cannot be relaxed and the literal `check('700 …')` must return true, the only honest, non-fake fixes are scaffold-level changes — engineer-component-level fixes would either be cosmetic and ignored or load a font subset for no design reason. Both options below require CTO sign-off per [[feedback_brand_tokens_ceo_signoff]]:

- **Option A** — scaffold change in `app.css`: demote h1/h2/h3 from weight 800 to weight 700. Visual restyling of the entire site for a probe artifact. **Strongly recommend against.**
- **Option B** — scaffold change in `fonts.css`: drop the weight-700 @font-face declarations entirely (they're never used) — then the probe `check('700 …')` becomes structurally false for legitimate reasons that the eval would have to grant. **Reframe-the-probe approach.** Defensible but consumes scaffold-side review.
- **Option C** — engineer-component change: add a synthetic invisible element with `font-weight: 700` to force 700-weight load. **Fake-fix. Don't ship.**

I propose **Option D: bar refinement**. Replace clause 1 with a weight-agnostic check:

```js
document.fonts.check('"Bricolage Grotesque"') === true
// OR
Array.from(document.fonts)
    .filter(f => f.family === 'Bricolage Grotesque')
    .some(f => f.status === 'loaded') === true
```

Either form satisfies on both regex (700 loaded) and webhook (800 loaded), and rejects the genuine cycle-1 failure (zero Bricolage weights loaded at all). The user-outcome the bar is trying to enforce is "Bricolage actually loaded and rendering on display," not "specifically the 700-weight face." Refining to the actual user-outcome eliminates the probe-shape coincidence.

---

## Recommendation

1. **No code change to webhook.** The site already satisfies the bar's user-outcome. Manufacturing a fix to flip a literal probe would be a fake-fix in the sense [[feedback_eval_fix_exact_oracle]] inversely guards against — exact-oracle discipline applies to real failures, not to probe artifacts.
2. **Bar refinement** (CEO/COO decision): rewrite clause 1 to be weight-agnostic per Option D. The bar will then correctly fail on real Bricolage-unloaded sites (the case that caught regex cycle-1) and correctly pass on sites that ship a different declared weight.
3. **If CEO disagrees and insists on literal-probe satisfaction:** route to nora-cto-2 for scaffold-side Option B (drop unused 700-weight @font-face declarations from `fonts.css`). I should not own that change; per [[feedback_brand_tokens_ceo_signoff]] scaffold tokens require CTO authorship.

## Per [[feedback_proactive_logging]] — methodology lesson banked

This is the first time on the dexli.dev family that an eval probe and the underlying user-outcome have diverged in a way visible from a remediation cycle. The discipline `[[feedback_eval_fix_exact_oracle]]` cuts both ways: exact-oracle on real failures, **honest no-fix on probe-artifact failures**. Cycle output is the diagnostic itself, not a code commit.

---

**Branch status:** `frontend/remediation-1` exists at HEAD `b590460` (master), no commits added. Worktree at `E:/lab/sandbox/tinywebhook-remediation-1-frontend`. Tear down by removing the worktree if CEO accepts Outcome B; or keep it as the base for Option B if CTO needs to land a scaffold fix.

**Frozen state:** no force-push, no commits between this memo and verdict.
