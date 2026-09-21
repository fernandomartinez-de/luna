#!/usr/bin/env python3
"""
build_overload.py

Renders health/fitness/index.html from template.html by reading body-composition
history, WHOOP workout cadence (dates and sport only - no recovery, HRV, sleep,
or strain surfaced), and recent strength-training history from Supabase, then
injecting four JSON payloads into template tokens:

    __PLAN_DATA__     - mesocycle timeline: start, end, current week, target
    __BODY_DATA__     - body-composition trend + latest reading + deltas
    __WORKOUTS_DATA__ - weekly cadence (lifts, soccer, runs) - counts only
    __STRENGTH_DATA__ - last weight/reps per exercise for the primary lifts

Weights are kg throughout. Reads via the Supabase REST client (SUPABASE_URL +
SUPABASE_KEY) rather than direct Postgres, because the direct db host is
IPv6-only and GitHub Actions runners are IPv4-only. This matches how
health/whoop/sync.py already works. All programming logic lives client side
in app.js; this script only supplies data.

Usage:
    python health/fitness/build_overload.py
    python health/fitness/build_overload.py --body-days 180 --strength-days 60
"""
import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from supabase import create_client, Client

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
MESO_START = date(2026, 9, 21)
MESO_END   = date(2027, 2, 1)
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


def n1(x):
    if x is None:
        return None
    try:
        return round(float(x), 1)
    except (TypeError, ValueError):
        return None


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(url.strip(), key.strip())


def rest_query(sb: Client, label: str, fn):
    """Run a REST query, log and swallow errors so the app still renders."""
    try:
        resp = fn(sb)
        return resp.data or []
    except Exception as exc:
        print(f"WARN: {label} query failed: {str(exc).strip()[:200]}", file=sys.stderr)
        return []


def parse_ts(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day, tzinfo=timezone.utc)
    if isinstance(v, str):
        s = v.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(s)
        except ValueError:
            try:
                return datetime.fromisoformat(s[:19])
            except ValueError:
                return None
    return None


def parse_day(v):
    dt = parse_ts(v)
    return dt.date() if dt else None


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
        dt = parse_ts(r.get("measured_at"))
        series.append({
            "measured_at":     dt.isoformat() if dt else str(r.get("measured_at")),
            "weight_kg":       n1(r.get("weight_kg")),
            "body_fat_pct":    n1(r.get("body_fat_pct")),
            "muscle_mass_kg":  n1(r.get("muscle_mass_kg")),
            "bmi":             n1(r.get("bmi")),
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
        d = parse_day(r.get("start_time"))
        if not d:
            continue
        name = (r.get("sport_name") or "").strip()
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


def build_strength(sessions, sets_rows, exercises):
    ex_by_id = {e["exercise_id"]: e for e in exercises}
    session_by_id = {s["session_id"]: s for s in sessions}
    by_exercise = {}
    # Sort sets by session date desc so first insert wins for last*.
    def set_sort_key(s):
        sess = session_by_id.get(s.get("session_id"))
        d = parse_day(sess.get("session_date")) if sess else None
        return (d or date(1970, 1, 1), s.get("order_index") or 0, s.get("set_number") or 0)
    sets_sorted = sorted(sets_rows, key=set_sort_key, reverse=True)
    for s in sets_sorted:
        ex = ex_by_id.get(s.get("exercise_id"))
        if not ex:
            continue
        name = ex.get("name")
        sess = session_by_id.get(s.get("session_id"))
        d = parse_day(sess.get("session_date")) if sess else None
        kg = s.get("weight_kg")
        if kg is None:
            continue
        try:
            kg = float(kg)
        except (TypeError, ValueError):
            continue
        reps = s.get("reps")
        try:
            reps = int(reps) if reps is not None else None
        except (TypeError, ValueError):
            reps = None
        rec = by_exercise.setdefault(name, {
            "lastDate": d.isoformat() if d else None,
            "lastKg": kg,
            "lastReps": reps,
            "bestKg": kg,
        })
        if kg > rec["bestKg"]:
            rec["bestKg"] = kg
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
    ap.add_argument("--body-days",     type=int, default=180)
    ap.add_argument("--strength-days", type=int, default=60)
    args = ap.parse_args()

    today = date.today()
    sb = get_client()

    body_cutoff_iso = (today - timedelta(days=args.body_days)).isoformat()
    workout_cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()
    strength_cutoff_iso = (today - timedelta(days=args.strength_days)).isoformat()

    body_rows = rest_query(sb, "body_composition", lambda s:
        s.table("body_composition")
         .select("measured_at,weight_kg,body_fat_pct,muscle_mass_kg,bmi")
         .gte("measured_at", body_cutoff_iso)
         .order("measured_at", desc=False)
         .execute()
    )

    workout_rows = rest_query(sb, "whoop_workouts", lambda s:
        s.table("whoop_workouts")
         .select("start_time,sport_name")
         .gte("start_time", workout_cutoff_iso)
         .order("start_time", desc=True)
         .execute()
    )

    session_rows = rest_query(sb, "strength_sessions", lambda s:
        s.table("strength_sessions")
         .select("session_id,session_date")
         .gte("session_date", strength_cutoff_iso)
         .execute()
    )
    exercise_rows = rest_query(sb, "strength_exercises", lambda s:
        s.table("strength_exercises").select("exercise_id,name").execute()
    )
    session_ids = [s["session_id"] for s in session_rows if s.get("session_id") is not None]
    if session_ids:
        set_rows = rest_query(sb, "strength_sets", lambda s:
            s.table("strength_sets")
             .select("session_id,exercise_id,order_index,set_number,reps,weight_kg")
             .in_("session_id", session_ids)
             .execute()
        )
    else:
        set_rows = []

    plan     = build_plan(today)
    body     = build_body(body_rows)
    workouts = build_workouts(workout_rows, today)
    strength = build_strength(session_rows, set_rows, exercise_rows)

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
