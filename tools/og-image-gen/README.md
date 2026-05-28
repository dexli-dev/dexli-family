# OG image generator — dexli-family tools

Small utility that renders an SVG template at 1200×630 (X/Open Graph
standard share-card size) into a PNG. For D1 retrofit's per-sibling
brand OG images.

## Why this tool exists

Bar item 2 (D1 SEO retrofit) requires each sibling to ship a real PNG
hosted at the sibling's domain for OG/Twitter share-card unfurling.
Hand-authoring 3 PNGs is brittle; this script renders them
deterministically from SVG sources so they stay byte-identical across
re-runs + can be regenerated when brand surface changes.

This is **CTO-scaffold tooling**, not engineer content. The PNGs the
tool emits — once an engineer runs it against per-sibling SVG content
they've authored — are engineer-attributable per bar item 11 (content
is engineer-domain).

## Usage

```sh
npm install
node render.mjs <input.svg> <output.png>
```

E.g.:

```sh
node render.mjs ../../templates/webhook-og.svg ../../../tinywebhook/static/og-card.png
node render.mjs ../../templates/cron-og.svg ../../../cron-dexli/static/og-card.png
node render.mjs ../../templates/regex-og.svg ../../../regex-dexli/static/og-card.png
```

## SVG template contract

Templates SHOULD declare width/height matching the target render size
(1200×630). The renderer doesn't rescale — it captures the SVG at the
declared viewport.

Templates live at `dexli-family/templates/` so cross-sibling brand
consistency is co-located with the family infra.

## How it works

`render.mjs` launches headless Edge (puppeteer-core), loads a tiny
data-URL HTML wrapper around the SVG file, takes a screenshot at the
target dimensions, writes PNG.

No bundling required to ship. Just node + puppeteer-core + a system
Edge install.
