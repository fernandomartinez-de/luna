#!/usr/bin/env python3
"""
build_overload.py

Renders health/fitness/index.html from template.html by reading body-composition
history (Renpho scale data), WHOOP workout cadence (dates and sport only - no
recovery, HRV, sleep, or strain surfaced), and recent strength-training history
from Supabase, then injecting four JSON payloads into template tokens:

    __PLAN_DATA__     - mesocycle timeline: start, end, current week, target
    __BODY_DATA__     - body-composition trend + latest reading + deltas
    __WORKOUTS_DATA__ - weekly cadence (lifts, soccer, runs) - counts only
    __STRENGTH_DATA__ - last weight/reps per exercise for the primary lifts

Weights are kg throughout. The secret SUPABASE_DB_URL is read from env and never
written to disk. All programming logic lives client side in app.js; this script
only supplies data.

Usage:
    python health/fitness/build_overload.py
    python health/fitness/build_overload.py --body-days 180 --strength-days 60
"""
import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg2
import psycopg2.extras

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATE = SCRIPT_DIR / "template.html"
OUTPUT = SCRIPT_DIR / "index.html"

TOKEN_PLAN     = "__PLAN_DATA__"
TOKEN_BODY     = "__BODY_DATA__"
TOKEN_WORKOUTS = "__WORKOUTS_DATA__"
TOKEN_STRENGTH = "__STRENGTH_DATA__"

# Mesocycle anchor. 19-week runway from a fixed Monday near the current build
# date toward early February. Keep as constants so week numbers do not drift
# with clock skew or accidental reruns.
MESO_START = date(2026, 9, 21)   # Monday of week 1
MESO_END   = date(2027, 2, 1)    # sharpen-week finish (about 19 weeks after start)
TOTAL_WEEKS = 19
TARGET_LABEL = "Early February"

# Primary lifts we surface recent history for on the Session view.
PRIMARY_EXERCISE_NAMES = [
    "Flat Barbell Bench Press",
    "Incline DB Press",
    "Close Grip Bench Press",
    "Weighted Pull-Up",
    "Barbell Row (Pendlay)",
    "Incline DB Curl",
    "Back Squat",
    "Romanian Deadlift",
    "Bulgarian Split Squat",
    "Power Clean",
    "Push Press",
    "Standing Overhead Press",
]

SQL_BODY = """
select
    measured_at,
    weight_kg,
    body_fat_pct,
    muscle_mass_kg,
    bmi
from public.body_composition
where measured_at >= (current_date - (%s || ' days')::interval)
order by measured_at asc;
"""

# WHOOP cadence only: dates and sport_name for the last 21 days, so we can count
# lifts, soccer, and runs this week. Strain is intentionally not selected.
SQL_WORKOUTS_CADENCE = """
select
    (start_time at time zone 'UTC')::date as day,
    sport_name
from whoop_workouts
where start_time >= (current_date - interval '21 days')
  and sport_name is not null
order by start_time desc;
"""

SQL_STRENGTH = """
select
    ss.session_date,
    ex.name          as exercise_name,
    sst.reps,
    sst.weight_kg
from strength_sessions ss
join strength_sets sst      on sst.session_id = ss.session_id
join strength_exercises ex  on ex.exercise_id = sst.exercise_id
where ss.session_date >= (current_date - (%s || ' days')::interval)
  and sst.weight_kg is not null
order by ss.session_date desc, sst.order_index, sst.set_number;
"""


def n1(x):
    if x is None:
        return None
    try:
        return round(float(x), 1)
    except (TypeError, ValueError):
        return None


def get_conn():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("ERROR: SUPABASE_DB_URL environment variable not set")
    return psycopg2.connect(url)


def query(cur, sql, params=None, label=""):
    try:
        cur.execute(sql, params or ())
        return cur.fetchall()
    except psycopg2.Error as exc:
        # Missing tables are non-fatal: the app still renders, just without that block.
        print(f"WARN: {label} query failed ({exc.pgcode}): {str(exc).strip()[:120]}", file=sys.stderr)
        return []


def build_plan(today):
    days_in = (today - MESO_START).days
    week = max(1, min(TOTAL_WEEKS, (days_in // 7) + 1))
    days_to_target = (MESO_END - today).days
    return {
        "startDate":      MESO_START.isoformat(),
        "endDate":        MESO_END.isoformat(),
        "totalWeeks":     TOTAL_WEEKS,
        "currentWeek":    week,
        "weeksRemaining": max(0, TOTAL_WEEKS - week + 1),
        "daysToTarget":   days_to_target,
        "targetLabel":    TARGET_LABEL,
    }


def build_body(rows):
    series = []
    for r in rows:
        d = r["measured_at"]
        if isinstance(d, datetime):
            d_iso = d.isoformat()
        elif isinstance(d, date):
            d_iso = d.isoformat()
        else:
            d_iso = str(d)
        series.append({
            "measured_at":     d_iso,
            "weight_kg":       n1(r["weight_kg"]),
            "body_fat_pct":    n1(r["body_fat_pct"]),
            "muscle_mass_kg":  n1(r["muscle_mass_kg"]),
            "bmi":             n1(r["bmi"]),
        })
    if not series:
        return {
            "series": [], "latest": None,
            "startWeight": None, "startBodyFat": None,
            "deltaWeight": None, "deltaBodyFat": None,
        }
    latest = series[-1]
    start = series[0]
    dw = None
    dbf = None
    if latest["weight_kg"] is not None and start["weight_kg"] is not None:
        dw = round(latest["weight_kg"] - start["weight_kg"], 1)
    if latest["body_fat_pct"] is not None and start["body_fat_pct"] is not None:
        dbf = round(latest["body_fat_pct"] - start["body_fat_pct"], 1)
    return {
        "series":       series,
        "latest":       latest,
        "startWeight":  start["weight_kg"],
        "startBodyFat": start["body_fat_pct"],
        "deltaWeight":  dw,
        "deltaBodyFat": dbf,
    }


def build_workouts(rows, today):
    monday = today - timedelta(days=today.weekday())
    lifts = 0
    soccer = 0
    runs = 0
    recent = []
    for r in rows:
        d = r["day"]
        if not isinstance(d, date):
            continue
        name = (r["sport_name"] or "").strip()
        recent.append({"day": d.isoformat(), "sport": name})
        if d < monday:
            continue
        low = name.lower()
        if "weight" in low or "strength" in low:
            lifts += 1
        elif "soccer" in low:
            soccer += 1
        elif "run" in low or "jog" in low:
            runs += 1
    return {
        "liftsThisWeek":  lifts,
        "soccerThisWeek": soccer,
        "runsThisWeek":   runs,
        "recent":         recent[:20],
    }


def build_strength(rows):
    by_exercise = {}
    for r in rows:
        name = r["exercise_name"]
        if not name:
            continue
        d = r["session_date"]
        d_iso = d.isoformat() if isinstance(d, date) else str(d)
        kg = float(r["weight_kg"]) if r["weight_kg"] is not None else None
        reps = int(r["reps"]) if r["reps"] is not None else None
        if kg is None:
            continue
        rec = by_exercise.setdefault(name, {"lastDate": d_iso, "lastKg": kg, "lastReps": reps, "bestKg": kg})
        # Rows arrive newest first; first insert wins for last*, but keep updating bestKg.
        if kg > rec["bestKg"]:
            rec["bestKg"] = kg
    # Restrict to the primary lifts so the payload stays small.
    out = {name: by_exercise[name] for name in PRIMARY_EXERCISE_NAMES if name in by_exercise}
    return {"byExercise": out}


def render(plan, body, workouts, strength):
    if not TEMPLATE.exists():
        sys.exit(f"ERROR: template not found: {TEMPLATE}")
    tpl = TEMPLATE.read_text(encoding="utf-8")
    tokens = {
        TOKEN_PLAN: plan,
        TOKEN_BODY: body,
        TOKEN_WORKOUTS: workouts,
        TOKEN_STRENGTH: strength,
    }
    for token in tokens:
        if token not in tpl:
            sys.exit(f"ERROR: {token} token missing in {TEMPLATE.name}")
    rendered = tpl
    for token, payload in tokens.items():
        rendered = rendered.replace(token, json.dumps(payload, separators=(",", ":"), default=str))
    OUTPUT.write_text(rendered, encoding="utf-8")
    return rendered


def main():
    ap = argparse.ArgumentParser(description="Render Overload cut-to-abs app from Supabase")
    ap.add_argument("--body-days",     type=int, default=180, help="Body-composition history window (default 180)")
    ap.add_argument("--strength-days", type=int, default=60,  help="Strength-history window (default 60)")
    args = ap.parse_args()

    today = date.today()

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    body_rows     = query(cur, SQL_BODY,             (str(args.body_days),),     label="body_composition")
    workout_rows  = query(cur, SQL_WORKOUTS_CADENCE, None,                        label="whoop_workouts")
    strength_rows = query(cur, SQL_STRENGTH,         (str(args.strength_days),), label="strength")
    cur.close()
    conn.close()

    plan     = build_plan(today)
    body     = build_body(body_rows)
    workouts = build_workouts(workout_rows, today)
    strength = build_strength(strength_rows)

    out = render(plan, body, workouts, strength)
    latest_bf = (body.get("latest") or {}).get("body_fat_pct") if body.get("latest") else None
    latest_wt = (body.get("latest") or {}).get("weight_kg") if body.get("latest") else None
    print(
        f"Wrote {OUTPUT.name}: week {plan['currentWeek']} of {plan['totalWeeks']} "
        f"(target {plan['endDate']}, {plan['daysToTarget']} days), "
        f"body {len(body['series'])} readings "
        f"(latest {latest_wt} kg / {latest_bf} % bf), "
        f"cadence {workouts['liftsThisWeek']} lifts + {workouts['soccerThisWeek']} soccer + {workouts['runsThisWeek']} runs this week, "
        f"{len(strength['byExercise'])} primary lifts with history. "
        f"{len(out):,} bytes."
    )


if __name__ == "__main__":
    main()
