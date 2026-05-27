"""analytics-v1 — dexli.dev family traffic instrumentation.

Server-side parser for Traefik JSON access logs. Emits three metric
families (daily uniques, top pages, referrer sources by host) as
markdown. Privacy gate: raw IPs are hashed with HMAC-SHA256 before any
aggregation; the full hash and the raw IP never leave the per-line
stack frame. See README.md for the full privacy design.

Stdlib only. Designed to be readable end-to-end at one sitting.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import hmac
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Iterator
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Tunable knobs — adjust at the top of the file so they're easy to spot.
# ---------------------------------------------------------------------------

LOG_FIELDS = {
    "time": "time",
    "client_ip": "ClientHost",
    "host": "RequestHost",
    "path": "RequestPath",
    "status": "DownstreamStatus",
    "referer": "request_Referer",
    "user_agent": "request_User-Agent",
}

DEFAULT_SITES = ("webhook.dexli.dev", "cron.dexli.dev", "regex.dexli.dev")

# URL prefixes excluded from top-pages + referrer-source aggregation. These
# are subresource requests, not "visits" in any meaningful sense.
ASSET_PREFIXES = ("/_app/", "/fonts/", "/favicon", "/robots.txt", "/sitemap.xml")

# Substring matches on User-Agent that mark a request as automation. Match
# is case-insensitive. The UA string itself is NEVER reported or stored.
ROBOT_UA_HINTS = (
    "bot",
    "crawler",
    "spider",
    "preview",
    "monitor",
    "wget",
    "curl/",
    "python-requests",
    "httpie",
    "go-http-client",
    "okhttp",
    "scrapy",
    "headlesschrome",
)

# Status codes counted as a "successful visit" for uniques / top-pages.
# 304 is a cache revalidation hit — the user navigated, browser had a
# cached copy. Still a visit.
VISIT_STATUSES = {200, 203, 204, 206, 304}

# Length of the truncated IP hash kept in memory for aggregation. 16 hex
# chars = 64 bits. Aggregates at human scale; defeats rainbow tables
# against the truncated hash.
HASH_HEX_LEN = 16


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="parse_logs.py",
        description="dexli.dev family traffic parser (v1) — markdown report.",
    )
    p.add_argument(
        "--logs",
        required=True,
        type=Path,
        help="Path to a Traefik access-log file or a directory of them.",
    )
    p.add_argument(
        "--secret",
        default=os.environ.get("ANALYTICS_SECRET"),
        help="HMAC key for IP hashing. Falls back to $ANALYTICS_SECRET. "
        "No default — parser refuses to run without one.",
    )
    p.add_argument(
        "--since",
        default="7d",
        help='Lookback window: "7d", "24h", "30d", or absolute ISO date.',
    )
    p.add_argument(
        "--out",
        default="-",
        help='Output path. "-" writes to stdout.',
    )
    p.add_argument(
        "--top-n",
        type=int,
        default=10,
        help="Number of rows per ranked metric. Default 10.",
    )
    p.add_argument(
        "--sites",
        default=",".join(DEFAULT_SITES),
        help="Comma-separated host allowlist.",
    )
    args = p.parse_args(argv)
    if not args.secret:
        p.error(
            "no secret supplied. pass --secret <hex> or set $ANALYTICS_SECRET. "
            'generate one with `python -c "import secrets; print(secrets.token_hex(32))"`'
        )
    return args


def resolve_since(spec: str, now: datetime) -> datetime:
    """Return the inclusive lower bound for log entries.

    Accepts shorthand like "7d", "24h", "30m" or an ISO date / datetime.
    """
    m = re.fullmatch(r"(\d+)\s*([dhm])", spec.strip().lower())
    if m:
        n, unit = int(m.group(1)), m.group(2)
        delta = {"d": timedelta(days=n), "h": timedelta(hours=n), "m": timedelta(minutes=n)}[unit]
        return now - delta
    # Fall back to ISO parsing. datetime.fromisoformat accepts both date and
    # datetime forms; assume UTC if naive.
    parsed = datetime.fromisoformat(spec)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def iter_log_files(root: Path) -> Iterator[Path]:
    if root.is_file():
        yield root
        return
    if not root.is_dir():
        raise FileNotFoundError(root)
    seen = set()
    for pattern in ("*.log", "*.jsonl", "*.json", "access*"):
        for f in root.rglob(pattern):
            if f.is_file() and f not in seen:
                seen.add(f)
                yield f


# ---------------------------------------------------------------------------
# Privacy primitive — used per-line; never stores the raw IP.
# ---------------------------------------------------------------------------


def hash_ip(ip: str, secret_bytes: bytes) -> str:
    digest = hmac.new(secret_bytes, ip.encode("utf-8"), hashlib.sha256).hexdigest()
    return digest[:HASH_HEX_LEN]


# ---------------------------------------------------------------------------
# Classification helpers.
# ---------------------------------------------------------------------------


def is_robot(ua: str) -> bool:
    if not ua:
        return False
    low = ua.lower()
    return any(hint in low for hint in ROBOT_UA_HINTS)


def is_asset(path: str) -> bool:
    return any(path.startswith(p) for p in ASSET_PREFIXES)


def is_visit_status(status: int) -> bool:
    return status in VISIT_STATUSES


def referer_host(referer: str) -> str | None:
    if not referer:
        return None
    try:
        parsed = urlparse(referer)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if not host:
        return None
    if host.startswith("www."):
        host = host[4:]
    return host


# ---------------------------------------------------------------------------
# Streaming reader.
# ---------------------------------------------------------------------------


def parse_record(raw: str) -> dict | None:
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def parse_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        # RFC3339 with trailing Z accepted by fromisoformat in 3.11+.
        s = value
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def stream_records(files: Iterable[Path]) -> Iterator[tuple[Path, int, dict]]:
    for path in files:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for lineno, raw in enumerate(fh, start=1):
                record = parse_record(raw)
                if record is None:
                    continue
                yield path, lineno, record


# ---------------------------------------------------------------------------
# Aggregator.
# ---------------------------------------------------------------------------


class Aggregator:
    """Per-site accumulators for the three metric families.

    Holds nothing per-IP — only hashed-then-deduped sets-per-day, and
    per-path / per-referrer counters. The raw IP and the full HMAC are
    discarded inside `ingest`; nothing further down the pipeline can
    reach them.
    """

    def __init__(self, sites: list[str]) -> None:
        self.sites = sites
        # site -> day-iso -> set of hashed-IPs
        self.uniques: dict[str, dict[str, set[str]]] = {
            s: collections.defaultdict(set) for s in sites
        }
        # site -> path -> visit count
        self.pages: dict[str, collections.Counter[str]] = {
            s: collections.Counter() for s in sites
        }
        # site -> referer-host -> visit count
        self.referrers: dict[str, collections.Counter[str]] = {
            s: collections.Counter() for s in sites
        }
        # Bookkeeping for the report header.
        self.window_start: datetime | None = None
        self.window_end: datetime | None = None
        self.total_lines = 0
        self.kept_lines = 0
        self.dropped_bot = 0
        self.dropped_non_visit_status = 0
        self.dropped_off_site = 0
        self.dropped_out_of_window = 0
        self.dropped_malformed_time = 0
        self.dropped_missing_field = 0

    def ingest(
        self,
        record: dict,
        secret_bytes: bytes,
        since: datetime,
    ) -> None:
        self.total_lines += 1
        host = record.get(LOG_FIELDS["host"])
        if host not in self.uniques:
            self.dropped_off_site += 1
            return
        when = parse_time(record.get(LOG_FIELDS["time"]))
        if when is None:
            self.dropped_malformed_time += 1
            return
        if when < since:
            self.dropped_out_of_window += 1
            return
        status_raw = record.get(LOG_FIELDS["status"])
        try:
            status = int(status_raw)
        except (TypeError, ValueError):
            self.dropped_missing_field += 1
            return
        ua = record.get(LOG_FIELDS["user_agent"], "") or ""
        if is_robot(ua):
            self.dropped_bot += 1
            return
        if not is_visit_status(status):
            self.dropped_non_visit_status += 1
            return

        ip = record.get(LOG_FIELDS["client_ip"])
        if not ip or not isinstance(ip, str):
            self.dropped_missing_field += 1
            return
        # Hash on the same stack frame the IP enters; never persist `ip`.
        hashed = hash_ip(ip, secret_bytes)
        day = when.date().isoformat()
        self.uniques[host][day].add(hashed)

        path = record.get(LOG_FIELDS["path"]) or "/"
        if not is_asset(path):
            self.pages[host][path] += 1
            ref = record.get(LOG_FIELDS["referer"]) or ""
            ref_host = referer_host(ref)
            if ref_host == host:
                # Self-referrer — internal navigation. Skip from referrer-
                # sources so we report ONLY external inbound traffic.
                pass
            elif ref_host is None:
                self.referrers[host]["(direct)"] += 1
            else:
                self.referrers[host][ref_host] += 1

        self.kept_lines += 1
        if self.window_start is None or when < self.window_start:
            self.window_start = when
        if self.window_end is None or when > self.window_end:
            self.window_end = when


# ---------------------------------------------------------------------------
# Markdown renderer.
# ---------------------------------------------------------------------------


def render_markdown(agg: Aggregator, since: datetime, until: datetime, top_n: int) -> str:
    lines: list[str] = []
    win_lo = (agg.window_start or since).date().isoformat()
    win_hi = (agg.window_end or until).date().isoformat()
    lines.append(f"# dexli.dev traffic — {win_lo} → {win_hi}")
    lines.append("")
    lines.append(
        f"*Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} · "
        f"window = `{since.isoformat()} → {until.isoformat()}` · "
        f"lines parsed = {agg.total_lines} · kept = {agg.kept_lines} "
        f"(dropped: bot={agg.dropped_bot}, non-2xx={agg.dropped_non_visit_status}, "
        f"off-site={agg.dropped_off_site}, out-of-window={agg.dropped_out_of_window}, "
        f"malformed-time={agg.dropped_malformed_time}, missing-field={agg.dropped_missing_field})*"
    )
    lines.append("")

    # --- daily uniques ---
    lines.append("## Daily uniques")
    lines.append("")
    all_days = sorted({d for site in agg.sites for d in agg.uniques[site].keys()})
    if not all_days:
        lines.append("_No visits in window._")
        lines.append("")
    else:
        header = "| Date | " + " | ".join(agg.sites) + " |"
        sep = "|---|" + "|".join(["---"] * len(agg.sites)) + "|"
        lines.append(header)
        lines.append(sep)
        for day in all_days:
            row = [day]
            for site in agg.sites:
                count = len(agg.uniques[site].get(day, ()))
                row.append(str(count) if count else "—")
            lines.append("| " + " | ".join(row) + " |")
        totals = ["**total uniques**"]
        for site in agg.sites:
            combined = set().union(*agg.uniques[site].values()) if agg.uniques[site] else set()
            totals.append(str(len(combined)) if combined else "—")
        lines.append("| " + " | ".join(totals) + " |")
        lines.append("")
        lines.append(
            "_Note: per-day rows count distinct hashed-IPs within that day. "
            "The total-uniques row counts distinct hashed-IPs across the whole window; "
            "it is ≤ the sum of per-day counts because a returning visitor is one unique "
            "for the window but appears in each day they visited._"
        )
        lines.append("")

    # --- top pages ---
    lines.append("## Top pages")
    lines.append("")
    for site in agg.sites:
        lines.append(f"### {site}")
        lines.append("")
        pages = agg.pages[site].most_common(top_n)
        if not pages:
            lines.append("_No visits in window._")
            lines.append("")
            continue
        lines.append("| Path | Visits |")
        lines.append("|---|---:|")
        for path, count in pages:
            lines.append(f"| `{path}` | {count} |")
        lines.append("")

    # --- referrers ---
    lines.append("## Referrer sources (host-grouped, external only)")
    lines.append("")
    for site in agg.sites:
        lines.append(f"### {site}")
        lines.append("")
        refs = agg.referrers[site].most_common(top_n)
        if not refs:
            lines.append("_No visits in window._")
            lines.append("")
            continue
        lines.append("| Referer host | Visits |")
        lines.append("|---|---:|")
        for host, count in refs:
            lines.append(f"| {host} | {count} |")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry.
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    now = datetime.now(timezone.utc)
    since = resolve_since(args.since, now)
    sites = [s.strip() for s in args.sites.split(",") if s.strip()]
    secret_bytes = args.secret.encode("utf-8")

    agg = Aggregator(sites)
    for _path, _lineno, record in stream_records(iter_log_files(args.logs)):
        agg.ingest(record, secret_bytes, since)

    md = render_markdown(agg, since=since, until=now, top_n=args.top_n)

    if args.out == "-":
        sys.stdout.write(md + "\n")
    else:
        Path(args.out).write_text(md + "\n", encoding="utf-8")
        sys.stderr.write(f"→ wrote {args.out}\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
