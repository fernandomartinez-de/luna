#!/usr/bin/env python3
"""
build_overload.py

Pulls the latest WHOOP recovery snapshot from Supabase and renders the
Overload gym app (overload/index.html) from overload/template.html by
injecting a small JSON payload into the __WHOOP_DATA__ token.

Matches the vital-signal-reports pipeline conventions:
  - SUPABASE_DB_URL env var (postgres connection string via the pooler)
  - psycopg2
  - __TOKEN__ placeholder replaced with a compact json.dumps

Usage:
    python overload/build_overload.py
    python overload/build_overload.py --days 14

Environment:
    SUPABASE_DB_URL   Required. The same secret the dashboards use.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATE = SCRIPT_DIR / "template.html"
OUTPUT = SCRIPT_DIR / "index.html"
TOKEN = "__WHOOP_DATA__"

# Live schema (verified against the current whoop_* tables, Sep 2026):
#   whoop_recovery(recovery_date date, recovery_score, resting_heart_rate,
#                  hrv_rmssd_milli, cycle_id)
#   whoop_sleep(cycle_id, performance_percentage, duration_minutes)
# One recovery row per day; sleep is joined on cycle_id, longest sleep wins
# so naps do not shadow the main night.
SQL = """
select
    r.recovery_date,
    r.recovery_score,
    r.resting_heart_rate,
    r.hrv_rmssd_milli,
    s.performance_percentage as sleep_perf,
    s.duration_minutes       as sleep_min
from whoop_recovery r
left join lateral (
    select performance_percentage, duration_minutes
    from whoop_sleep
    where cycle_id = r.cycle_id
    order by duration_minutes desc nulls last
    limit 1
) s on true
where r.recovery_date is not null
  and r.recovery_score is not null
order by r.recovery_date desc
limit %s;
"""


def n(x, default=0):
    """Coerce a numeric/decimal/None value to a rounded int."""
    try:
        return int(round(float(x)))
    except (TypeError, ValueError):
        return default


def get_conn():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("ERROR: SUPABASE_DB_URL environment variable not set")
    return psycopg2.connect(url)


def main():
    ap = argparse.ArgumentParser(description="Render Overload readiness from Supabase")
    ap.add_argument("--days", type=int, default=14,
                    help="Recovery trend length (default: 14)")
    args = ap.parse_args()
    days = max(args.days, 7)

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(SQL, (days,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    if not rows:
        sys.exit("ERROR: no WHOOP recovery rows returned")

    latest = rows[0]
    trend = [n(r["recovery_score"]) for r in reversed(rows[:days])]

    payload = {
        "date": latest["recovery_date"].isoformat(),
        "recovery": n(latest["recovery_score"]),
        "rhr": n(latest["resting_heart_rate"]),
        "hrv": n(latest["hrv_rmssd_milli"]),
        "sleepPerf": n(latest["sleep_perf"]),
        "sleepMin": n(latest["sleep_min"]),
        "trend": trend,
    }

    if not TEMPLATE.exists():
        sys.exit(f"ERROR: template not found: {TEMPLATE}")
    tpl = TEMPLATE.read_text()
    if TOKEN not in tpl:
        sys.exit(f"ERROR: {TOKEN} token missing in {TEMPLATE.name}")

    rendered = tpl.replace(TOKEN, json.dumps(payload, separators=(",", ":")))
    OUTPUT.write_text(rendered)
    print(f"Wrote {OUTPUT.name}: recovery {payload['recovery']}% on "
          f"{payload['date']} ({len(rendered):,} bytes, {len(trend)}-day trend)")


if __name__ == "__main__":
    main()
