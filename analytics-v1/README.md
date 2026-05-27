# analytics-v1 — dexli.dev family traffic instrumentation

Run-on-demand parser for Traefik access logs across `webhook.dexli.dev`,
`cron.dexli.dev`, and `regex.dexli.dev`. Emits three metric families as
markdown. **Server-side log analysis only — no client-side tracking, no
cookies, no script tags.**

## Scope (v1)

Three metrics, that's it:

1. **Daily uniques per site** — count of distinct hashed-IPs that hit each
   site, bucketed by UTC day.
2. **Top pages per site** — request path → visit count, ranked. Excludes
   asset URLs (`/_app/*`, `/fonts/*`, `/favicon.svg`) and non-2xx responses.
3. **Referrer sources per site** — `Referer` header → grouped by host (so
   `t.co/abc123` and `t.co/xyz789` collapse to `t.co`). Direct/empty/self-
   referrer surfaced as a separate row.

**NOT in v1:** session reconstruction, heatmaps, funnels, geo-IP,
browser/OS breakdown, time-on-page, bounce rate, deployed dashboard. If you
need any of these, write v2.

## Privacy gate

Hard rules, all enforced before any value lands on disk:

- **No raw IPs ever persist.** Each log line's `ClientHost` is hashed with
  `HMAC-SHA256(secret, ip)` in memory; only the first 16 hex chars (64 bits)
  ever appear in any aggregate. The full HMAC and the raw IP are dropped on
  the same stack frame they entered.
- **Secret is run-scoped.** The `--secret` flag (or `ANALYTICS_SECRET` env
  var) provides a hex string. No default value; the parser refuses to run
  without one. Don't commit secrets; rotate per run if you want each report
  to use a fresh hash space.
- **Salt-rotation policy.** A run uses one secret across the full window
  it parses. This means "daily uniques" deduplicates by IP within the run,
  but two separate runs with two different secrets produce non-overlapping
  hash spaces (so a visitor in week-1's report cannot be linked to the same
  visitor in week-2's report). Recommended cadence: rotate the secret each
  CEO-report cycle. For ad-hoc 7-day runs, a single secret per run is fine
  and the parser surfaces only weekly/daily counts, never cross-run links.
- **Opt-in cross-window comparison.** When CEO asks "this week's traffic
  vs last week's," the privacy-safe path is to **reuse last week's secret**
  across both windows (or re-run last week's data with the new secret and
  compare aggregates). Per-run rotation is the safe default; explicit
  reuse is the deliberate opt-in for comparison asks. Document which
  secret each report used so the comparison decision is traceable.
- **No user-agent fingerprinting.** Robots are filtered (see `ROBOT_UA_HINTS`
  in the parser), but the UA string itself is never reported or stored.
- **No PII in commits.** The `sample-logs/` directory is gitignored. The
  sample report committed to this repo contains aggregates only.

## Usage

```
python parse_logs.py \
    --logs <dir-or-file> \
    --secret <hex-string-32-chars-or-more> \
    --since 7d \
    --out report.md
```

Flags:

| Flag | Meaning | Default |
|---|---|---|
| `--logs` | Path to a Traefik access-log file or a directory containing them. JSON-per-line. Required. | — |
| `--secret` | HMAC key for IP hashing. Required. Falls back to `$ANALYTICS_SECRET`. | — |
| `--since` | Lookback window. Accepts `7d`, `24h`, `30d`, or an absolute ISO date. Default: `7d`. | `7d` |
| `--out` | Output path. `-` writes to stdout. | `-` |
| `--top-n` | Number of rows per ranked metric. Default: `10`. | `10` |
| `--sites` | Comma-separated host allowlist. Default: all three siblings. | `webhook.dexli.dev,cron.dexli.dev,regex.dexli.dev` |

Generate a fresh 32-byte hex secret on the fly:

```
python -c "import secrets; print(secrets.token_hex(32))"
```

## Expected input shape

Traefik JSON access logs, one JSON object per line. The parser reads:

- `time` — RFC3339 timestamp. Bucketed to UTC day.
- `ClientHost` — peer IP. Hashed before use.
- `RequestHost` — virtual host. Matched against `--sites`.
- `RequestPath` — request path. Used for the top-pages metric.
- `DownstreamStatus` — HTTP status from the upstream. Non-2xx excluded
  from top-pages; 2xx+304 counted for uniques.
- `request_Referer` — referer header (Traefik prefixes request headers
  with `request_`). Grouped by host for the referrer-sources metric.
- `request_User-Agent` — UA. Used only for robot filtering; never reported.

If a real Traefik deployment uses a different field naming convention,
adjust `LOG_FIELDS` at the top of `parse_logs.py`.

## Sample report shape

See `sample-report.md` (one will be committed once real logs land). The
shape:

```
# dexli.dev traffic — 2026-05-21 → 2026-05-27

## Daily uniques

| Date | webhook | cron | regex |
|---|---|---|---|
| 2026-05-21 | 12 | — | — |
| ...        |    |   |   |

## Top pages

### webhook.dexli.dev
| Path | Visits |
| /    | 23     |
| ...  |        |

### cron.dexli.dev
| Path | Visits |
| /?e=...&tz=... | 4 |
| ...  |        |

### regex.dexli.dev
| Path | Visits |
| /?p=...&t=...&f=gi | 2 |
| ...  |        |

## Referrer sources

### webhook.dexli.dev
| Referer host | Visits |
| (direct)     | 18     |
| google.com   | 4      |
| ...          |        |
```

Empty cells use `—`. Sites with no traffic in the window show all-`—` rows
rather than being omitted, so a "this site is dead" signal is legible.

## Running against real logs

Real Traefik logs live on MicroMan. The route is M-mediated:
**nora-regex-1-frontend → nora-cto-2 → nora-overseer-2 (CEO) → M** scp 7d
of access logs to `sample-logs/`. The `sample-logs/` directory is
gitignored; only the aggregate report from the run is committed.

After landing logs:

```
python parse_logs.py \
    --logs sample-logs/ \
    --secret "$(python -c 'import secrets; print(secrets.token_hex(32))')" \
    --since 7d \
    --out sample-report.md
```

Review the report, commit it, delete the raw logs.

## What this is NOT

- A dashboard. There's no web UI, no auto-refresh, no API. Run-on-demand
  script, markdown output.
- A long-term store. Each run is stateless. We aren't building a metrics
  database; CEO wants a snapshot for Horizon-2 decisioning, not a time
  series.
- A privacy compromise. Every design choice above traded richer analytics
  for tighter privacy. If the bar for "uniques" needs cross-day stability
  beyond what HMAC-with-fixed-secret-per-run gives you, that's a v2
  conversation, not a v1 patch.
