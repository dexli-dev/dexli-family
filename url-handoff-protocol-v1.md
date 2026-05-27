# URL Handoff Protocol — v1 scoping memo

**Author:** nora-regex-1-engine (between-cycle dispatch)
**Date:** 2026-05-27
**Status:** scoping draft for CTO + CEO review — no code yet
**Repo home for protocol artifacts:** `E:\lab\sandbox\dexli-family\`

---

## TL;DR

Build the cross-tool handoff using **direct URL synthesis against each recipient's existing URL state contract**, not an envelope. Sender constructs a URL using the recipient's native query params, optionally adding a single shared breadcrumb param (`?from=<sender>`) that recipients ignore unless they want telemetry.

V1 ships exactly one handoff pair: **webhook → regex** (test captured body against a regex). That single pair earns its keep; the others are either semantically weak (regex → cron) or have no natural data mapping (everything else). The protocol gets exercised end-to-end on the real case before we commit to abstractions for hypothetical pairs.

Cost-per-sender to wire up V1: ~50 LoC (one component + one URL builder). Cost-per-recipient: **zero** — the URL is just a normal share URL in the recipient's existing shape.

Detailed rationale below.

---

## Context: the three sibling URL contracts as they stand

| Tool                 | Path                       | Query params                                             | State complexity |
| -------------------- | -------------------------- | -------------------------------------------------------- | ---------------- |
| webhook.dexli.dev    | `/inbox/{id}`              | none — inbox state comes from server, key from localStorage | high — captured requests, per-inbox auth key, SSE |
| cron.dexli.dev       | `/`                        | `?e=<expr>&tz=<tz>`                                      | pure — URL is the entire app state |
| regex.dexli.dev      | `/`                        | `?p=<pattern>&t=<text>&f=<gims subset>`                  | pure — URL is the entire app state |

Two of the three (cron, regex) are pure URL functions — every visitor with the same URL sees the same screen. webhook is the outlier: its URL points at a persistent server-side inbox, and the only "shareable state" is the inbox identity, not the request data inside it.

This asymmetry shapes everything below: **webhook has data to send out, but it cannot receive structured data via URL** because its URL doesn't encode app state — it encodes inbox identity. cron and regex can both send AND receive structured data. So the protocol naturally has a sender/recipient distinction, not just a symmetric "share."

---

## Three approaches considered

### Approach A — Universal envelope (`?from=...&payload=<base64-json>`)

Sender wraps its outgoing state in a structured payload; recipient decodes and maps to native state.

- **Pros:** uniform parsing surface across all tools; sender doesn't need recipient-specific URL knowledge.
- **Cons:** every recipient must implement an envelope decoder *plus* a mapping layer from envelope to native state. Double the URL-state surface to test. The envelope itself becomes a fourth contract beyond the three native ones, with its own versioning headache. base64 payloads inflate URL length 33%.

### Approach B — Namespaced handoff params (`?_handoff_p=<pattern>&_handoff_t=<text>`)

Recipient declares "handoff-input" params alongside its native ones. Sender writes those. Recipient prefers handoff params over native ones when present.

- **Pros:** explicit handoff signal; recipient can apply different validation to handed-off data than direct-URL data.
- **Cons:** doubles each recipient's query surface (native + handoff for the same fields). Forks the URL-state code path. Requires versioning if handoff semantics diverge from native semantics.

### Approach C — Direct URL synthesis (RECOMMENDED)

Sender constructs a URL using the recipient's **existing native** params. A webhook-→-regex button reads the captured body, builds `https://regex.dexli.dev/?t=<encodeURIComponent(body)>`, and that's the entire protocol.

- **Pros:**
    - Zero new code on recipient side. The URL is indistinguishable from any other share URL — same parser, same validation, same test coverage.
    - No new contracts to version. The recipient's URL-state file *is* the protocol.
    - The recipient cannot tell handoff from "user pasted this URL," which is the right indistinguishability: a handoff URL has no trust privileges a direct URL doesn't already have.
    - URL-length budget is spent only on real data, not envelope overhead.
- **Cons:**
    - Sender needs build-time knowledge of recipient's URL shape — i.e. coupling on the recipient's *param names*. Mitigated by a tiny shared family config (see §7).
    - No structured provenance. (Optional `?from=<sender>` breadcrumb is a soft hint, not a contract.)
    - Adding a new "sendable" field on the recipient requires no protocol change, but adding a new sender that wants to write it does need to know the param name.

The coupling concern is the only honest tradeoff. Mitigation: a 30-line shared `family.config.ts` that each sender imports listing each sibling tool's base URL and its writable param names. One source of truth; changes when siblings change their contracts; no behavioral coupling, just naming.

**Recommendation: Approach C, with one optional breadcrumb param.**

---

## Answers to the six brief questions

### 1. Cross-tool URL handoff schema

Minimum contract:

```
https://<recipient>.dexli.dev/<recipient-path>?<recipient-native-params>[&from=<sender-tool-slug>]
```

- `<recipient-native-params>` are the recipient's existing URL state params, exactly as documented in each tool's `url-state.ts`. No new params on the recipient side.
- `from=<sender-tool-slug>` is an OPTIONAL single param (slug = `webhook` | `cron` | `regex` | ...). Recipients SHOULD ignore it unless they want telemetry. If included, it's a breadcrumb only — no behavior change.

**Slug allocation:** maintained in the shared `family.config.ts` (§7). Slugs are stable; renaming a tool's slug breaks downstream senders.

**Reserved param namespace:** `from` is reserved at the family level. No tool may use `from` for its own state. Future cross-tool params (if any) reserved under a `_family_` prefix.

### 2. Recipient ingestion semantics

- The recipient does NOT distinguish handoff URLs from direct/share URLs. Same parser, same validation, same render path. This is intentional — a handoff URL must have no trust privileges a direct URL doesn't already have.
- No sender whitelist. The recipient has no way to forge sender identity anyway (the `?from=` param is user-controllable), so a whitelist would be theater.
- **CSP / cross-origin implications:** none for V1. "Send to X" is a regular `<a href="...">` opening in a new tab (or same tab). No iframe embed, no `postMessage`, no `fetch` across origins. Each tool stays in its own origin sandbox.

If V2 ever wants iframe-embedded handoff (e.g. preview a regex match inline on webhook), THAT introduces CSP work — `frame-src` on the embedder, `frame-ancestors` on the recipient, possible `postMessage` channel. V1 deliberately skips this. Iframe embedding would add ~150-300 LoC across both ends and a new protocol layer; the new-tab handoff covers the actual user need at zero CSP cost.

### 3. UI affordances

- Send-to-X buttons live in the **sender's** existing share/export cluster (next to "Copy share link" / "Copy as cURL" etc.). They are the same affordance class.
- Only buttons for semantically-meaningful pairs render. We do not show "send to cron" on a regex page just because cron is a sibling; we show it only when the data actually composes.
- Per-target button (not a dropdown) in V1. We have one target. A dropdown becomes worth it at three+ targets per source.
- Buttons SHOULD NOT auto-trigger; they require an explicit click. URL with the handoff data appears in the new tab's address bar — visible to the user before any state mutation. (This is also how the security model stays sound: no surprise navigation.)
- Buttons MUST disable / hide when the source data is missing or too large (see §5).

### 4. Backward compatibility

- Existing share URLs are untouched. The recipient's URL parser already ignores unknown params — adding `?from=<sender>` to any historical URL is a no-op.
- New senders can be added without coordinating with recipients, because recipients don't change.
- A recipient that decides to break or rename a native param is making a versioned URL-contract change that already affects its own historical share URLs — handoff inherits this risk, no extra surface.

### 5. Security model

The threat is **user-shareable URLs**: a malicious sender could craft a URL meant to deceive the recipient or its eventual viewer. Mitigations:

- **XSS:** recipients ALREADY sanitize all URL params on render (text content, not HTML). Handoff adds no new sanitization need. The bar must be: any value an attacker could put in a native param via a hand-crafted share URL today is the same value they could put via a handoff URL. (True under Approach C.)
- **URL length:** browsers vary; ~2KB is safe, ~8KB is usually fine, beyond ~32KB risk truncation/refusal. Sender MUST enforce a length cap before generating the handoff URL. Recommended cap: **4 KB total URL length** (origin + path + query). On overrun, sender SHOULD offer a copy-to-clipboard fallback ("Open in regex" → "Copy as test text and open regex in new tab") rather than silently truncating.
- **Phishing via crafted regex / cron expression:** the recipient renders user-supplied content (a regex source, a cron expression). These have no exploit surface against the recipient — they're just text rendered as text. The downstream risk is a user copy-pasting an evil-looking pattern into their own work; that's a social-engineering attack against the user, not the protocol.
- **No persistent state crossover:** handoff MUST NOT carry auth tokens or localStorage values across origins. Each tool's auth is scoped to its origin. webhook's per-inbox Bearer key never crosses into a regex URL even if the source data was a captured request from a private inbox. (Sender code MUST extract only the body / headers, never the inbox key.)
- **Receipt-of-private-data leakage:** if a webhook captures a request body, the user owns that body and may opt to hand it to regex. The handoff URL itself is shareable, so the user has the SAME share-something-private risk they already have with "Copy share link." Treat the handoff URL like a share link in the docs.

### 6. Implementation cost — per existing tool

Approach C costs, per tool, to add ONE send-to-target:

- New component (e.g. `<SendToRegexButton />`): ~40-60 LoC. Reads source state, calls family-config URL builder, length-checks, renders `<a target="_blank">` or copy-fallback.
- Wire-up site (place the button in the existing share cluster): ~5-10 LoC.
- Tests: ~30-50 LoC (URL shape, length cap, fallback path, encoding round-trip for special chars).
- **Total per send-to-target: ~80-120 LoC.**

Shared family infrastructure (one-time, lives in `dexli-family/`):

- `family.config.ts` listing each sibling — slug, baseUrl, "input fields" map: ~30-50 LoC.
- `family-handoff.ts` URL builder helpers: ~40-80 LoC.
- Tests for the builder: ~50-100 LoC.
- **Total shared cost: ~150-250 LoC, once.**

Recipient cost: **0 LoC**, by design — *conditional on the sender preconditions in §11.5*. The recipient's URL-state parser is the contract; if a sender encodes data in a shape the parser doesn't already accept, that's a sender bug, not a recipient extension.

V1 total (one send-to-target on webhook + shared infrastructure): roughly **250-400 LoC** ship-ready.

Approach A (envelope) for comparison: ~200-300 LoC per tool, paid by EVERY tool that wants to receive handoffs, plus the shared envelope spec and tests. V1 same scope would cost ~600-900 LoC and adds a second URL-state code path to every recipient. Not justified for current scale.

---

## §7 — Shared family config (proposed shape)

`E:\lab\sandbox\dexli-family\family.config.ts` — single source of truth, imported by sender tools at build time. Sketch only:

```ts
export interface FamilySibling {
    slug: 'webhook' | 'cron' | 'regex';
    baseUrl: string;                  // canonical origin, no trailing slash
    path: string;                     // e.g. '/' or '/inbox/{id}'
    inputs: Record<string, string>;   // logical field name -> URL param name
}

export const FAMILY: Record<string, FamilySibling> = {
    webhook: { slug: 'webhook', baseUrl: 'https://webhook.dexli.dev', path: '/', inputs: {} },
    cron:    { slug: 'cron',    baseUrl: 'https://cron.dexli.dev',    path: '/', inputs: { expression: 'e', tz: 'tz' } },
    regex:   { slug: 'regex',   baseUrl: 'https://regex.dexli.dev',   path: '/', inputs: { pattern: 'p', text: 't', flags: 'f' } }
};
```

Senders read `FAMILY.<target>.inputs` to find param names; no hard-coded `'p'` or `'t'` in sender code. Adding a new sibling = one new entry. Renaming a recipient's URL param = update its `inputs` map + everything in the family adapts.

Distribution: keep it in `dexli-family/` and either (a) symlink / copy into each tool repo at build, or (b) publish as a small private npm package once the family grows past 4 tools. V1 = copy in. Discipline + a simple `diff` against the source-of-truth in CI catches drift.

---

## §8 — V1 handoff matrix (concrete)

| From → To           | Data carried                                   | Verdict for V1 |
| ------------------- | ---------------------------------------------- | -------------- |
| webhook → regex     | request body (or selected header value) → `t=` | **SHIP**       |
| webhook → cron      | none plausible                                 | skip           |
| cron → regex        | expression as test text (`?t=<expr>`)          | skip — niche; revisit if user feedback |
| cron → webhook      | none plausible                                 | skip           |
| regex → cron        | none plausible                                 | skip           |
| regex → webhook     | none plausible                                 | skip           |

webhook → regex is the only pair that's earned by an obvious user story: *"this request looks weird, is it injecting something?"*. Test the body or a header against a regex.

Sub-decisions for webhook → regex:

- Which "send to regex" buttons appear? At least: **body** ("Open body in regex"). Possibly: per-header value ("Open header value in regex"). V1 = body only; headers in V1.1 if asked.
- The button lives in the `RequestDetail` panel where the user is already inspecting the body.
- Length cap: 4 KB. webhook bodies often exceed this; over-cap path = "Copy body, then click to open regex with empty test text" (copy-then-open fallback).
- Encoding: `encodeURIComponent` on the body. URLSearchParams already handles this end-to-end on regex's side (verified via the existing regex URL state contract — see `regex-dexli/src/lib/url-state.ts`).

---

## §9 — Open decisions for CEO + CTO

Flagging deliberately, with my lean — but these are calls for you:

1. **Single send-to-target in V1 or none?** My lean: ship the webhook → regex pair, prove the protocol works on one real pair, then expand. CEO might prefer to scope the V1 strictly to *protocol-and-config* without any send button, so the protocol is in place before any tool ships against it.
2. **Family config distribution: copy-in vs. private npm pkg.** My lean: copy-in for now, npm pkg if we hit 4+ tools. CTO call.
3. **Slug stability promise.** Once we ship `from=webhook`, is that slug part of the family's API forever? My lean: yes, slugs are forever (renaming a tool keeps its slug for inbound handoff URLs). Worth being explicit.
4. **Should `?from=` be added in V1 at all?** It costs nothing but adds noise to URLs. My lean: add it — costs ~5 chars, gives us optional telemetry hook for "do users actually hand off?" if we add analytics later.
5. **headers handoff on webhook → regex.** My lean: V1 ships body only. Per-header buttons add UI density without proven demand. V1.1 if asked.
6. **Mobile UX.** "Open in new tab" is fine on desktop; mobile sometimes opens same-tab. We should match each tool's existing share-button UX rather than introduce a new pattern. Defer to frontend engineers per tool.

---

## §10 — Out of scope for V1 (deliberately)

- **Iframe embedding** of one tool inside another. CSP cost + a separate `postMessage` protocol. Not justified at current scale.
- **Bi-directional sync** (live updates from one tool reflected in another). Implies WebSocket / SSE channels across origins. Out.
- **Envelope-format payloads.** Approach A is rejected for V1; not in V2 either unless we discover a recipient that genuinely needs structured provenance.
- **Programmatic API** for handoffs (e.g. a tool exposing `POST /api/handoff` for other tools to push to). URLs only.
- **Authentication crossover.** Each tool's auth stays scoped to its origin. A webhook inbox's Bearer key never leaves webhook's origin.
- **Trace tokens / handoff IDs.** No analytics infrastructure for "did this handoff actually get used." The `?from=` breadcrumb is the cheapest possible read of this; anything more is V2.

---

## §11 — Done definition for V1 protocol

- `family.config.ts` (and tests) committed under `dexli-family/`, with discipline doc on how to update it.
- ONE send-to-X button shipped on one tool (recommended: webhook → regex on `RequestDetail`).
- Recipient (regex) requires NO code changes — already accepts `?t=` from any source. Confirms the protocol's recipient-zero-cost claim. (See §11.5 for the sender-side preconditions this claim rests on.)
- Brand-shell / footer family-links remain canonical; handoff buttons are additional, not replacing existing family links.

That's the bar. Two-cycle work if it touches both webhook and shared infra: cycle one = family config + builder + tests; cycle two = button + wire-up + e2e walk.

## §11.5 — Normative preconditions (sender obligations)

The "recipient = zero LoC" claim above holds IF AND ONLY IF senders satisfy three preconditions. Stating them explicitly so they're requirements, not assumptions:

- **The recipient's URL-state parser is the contract.** Whatever `readUrlState()` in the recipient's `url-state.ts` accepts is the entire wire surface. Senders MUST NOT depend on undocumented parser behavior; if a recipient's parser changes, senders MUST update — that's a versioned URL-contract change, not a sender bug.
- **Senders MUST encode to whatever the recipient's parser accepts.** All values pass through `encodeURIComponent` / `URLSearchParams.set()` before joining into the URL. Raw bytes that aren't valid UTF-8 are NOT in scope for V1 — sender MUST detect non-text data (e.g. webhook body with binary content-type) and offer the copy-fallback path instead of attempting handoff.
- **Senders MUST length-check on the FINAL encoded URL, not the raw source.** A 3.8 KB body of pure `&` characters expands to ~11.4 KB after `encodeURIComponent`. The 4 KB cap applies to `origin + path + '?' + queryString`, measured after encoding. Anything that overruns falls through to the copy-fallback.

These three are non-negotiable for any new sender added to the family. They go in the discipline doc that ships next to `family.config.ts`.

---

## §12 — Risks I'd flag pre-build

- **Quiet param-name drift.** A recipient renames `?t=` to `?text=` someday. Family config catches it if updated; CI diff against source-of-truth is the only defense. If we forget to wire that CI check, drift bites silently.
- **URL-length sneak.** Webhook bodies that are 4.01 KB. Sender's cap check has to be on the FINAL URL length after encoding, not on the raw body length. Easy to get this wrong.
- **Encoding quirks for newlines / control chars.** webhook bodies contain raw `\n` etc. URLSearchParams handles these but the resulting URL is uglier than users expect ("why is my URL 30% percent-signs?"). Probably fine; flag in case a designer wants to push back.
- **"Send to X" as a phishing vector.** A bad actor publishes a URL of shape `regex.dexli.dev/?from=webhook&t=<malicious-looking-text>` to make it look "official." Recipients should NOT render `from` in a way that implies sender authentication. Recommend: don't surface `from` in UI at all in V1, keep it analytics-only.

End of memo.
