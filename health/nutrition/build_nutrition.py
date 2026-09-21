#!/usr/bin/env python3
"""
build_nutrition.py

Renders health/nutrition/index.html from template.html by reading:

    public.nutrition_log     - calories and macros IN, by day + meal
    public.whoop_cycles      - calories OUT per day (WHOOP burn)
    public.body_composition  - latest weight for the protein target
                               and the trend overlay

...via the Supabase REST client (SUPABASE_URL + SUPABASE_KEY) and injecting three
JSON payloads into template tokens:

    __TODAY_DATA__   - Cronometer-style day view for the latest logged date
    __TRENDS_DATA__  - Multi-day series: cals in vs out, protein, body-comp overlay
    __META_DATA__    - generatedAt timestamp, tracked-day count

View only. This page never accepts input; food is logged elsewhere and the
nutrition_log table is updated for me. Same secrets and pattern as
health/fitness/build_overload.py and health/whoop/sync.py so no database key
ever ships to the browser.

Usage:
    python health/nutrition/build_nutrition.py
    python health/nutrition/build_nutrition.py --days 60
"""
import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from supabase import create_client, Client

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATE = SCRIPT_DIR / "template.html"
OUTPUT = SCRIPT_DIR / "index.html"

TOKEN_TODAY  = "__TODAY_DATA__"
TOKEN_TRENDS = "__TRENDS_DATA__"
TOKEN_META   = "__META_DATA__"

# Cronometer-style meal ordering. Anything the log surfaces that we do not
# recognise falls into "Other" at the bottom so nothing gets dropped.
MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack", "Other"]
MEAL_ALIAS = {
    "breakfast": "Breakfast",
    "morning":   "Breakfast",
    "am":        "Breakfast",
    "lunch":     "Lunch",
    "midday":    "Lunch",
    "dinner":    "Dinner",
    "supper":    "Dinner",
    "evening":   "Dinner",
    "snack":     "Snack",
    "snacks":    "Snack",
    "":          "Other",
}

# Protein target = round(PROTEIN_G_PER_KG * latest weight_kg). 2.0 g/kg is the
# upper end of Helms 2014's recommended range for cut retention.
PROTEIN_G_PER_KG = 2.0


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
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    dt = parse_ts(v)
    return dt.date() if dt else None


def f_num(v):
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def n0(v):
    return int(round(f_num(v)))


def n1(v):
    if v is None:
        return None
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return None


def canonical_meal(name):
    key = (name or "").strip().lower()
    if key in MEAL_ALIAS:
        return MEAL_ALIAS[key]
    # Capitalise anything else we do not know about so it renders nicely.
    return (name or "Other").strip().title() or "Other"


def out_kcal(row):
    """WHOOP calories out; use calories_kcal if present, else kilojoules / 4.184."""
    kcal = row.get("calories_kcal")
    if kcal is not None:
        try:
            return float(kcal)
        except (TypeError, ValueError):
            pass
    kj = row.get("kilojoules")
    if kj is not None:
        try:
            return float(kj) / 4.184
        except (TypeError, ValueError):
            pass
    return 0.0


def build_daily_in(log_rows):
    """Aggregate nutrition_log rows by logged_date. Returns {day: totals}."""
    daily = defaultdict(lambda: {
        "calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0,
        "fat_g": 0.0, "fiber_g": 0.0, "rows": 0,
    })
    for r in log_rows:
        d = parse_day(r.get("logged_date"))
        if not d:
            continue
        bucket = daily[d]
        bucket["calories_kcal"] += f_num(r.get("calories_kcal"))
        bucket["protein_g"]     += f_num(r.get("protein_g"))
        bucket["carbs_g"]       += f_num(r.get("carbs_g"))
        bucket["fat_g"]         += f_num(r.get("fat_g"))
        bucket["fiber_g"]       += f_num(r.get("fiber_g"))
        bucket["rows"]          += 1
    return daily


def build_daily_out(cycle_rows):
    """Aggregate whoop_cycles by start_time::date."""
    daily = defaultdict(float)
    for r in cycle_rows:
        d = parse_day(r.get("start_time"))
        if not d:
            continue
        daily[d] += out_kcal(r)
    return daily


def build_today(log_rows, daily_out, latest_weight_kg):
    """Cronometer-style single-day view for the most recent logged date."""
    if not log_rows:
        return {
            "date":            None,
            "caloriesIn":      0,
            "caloriesOut":     0,
            "net":             0,
            "deficit":         0,
            "isDeficit":       False,
            "protein_g":       0,
            "carbs_g":         0,
            "fat_g":           0,
            "fiber_g":         0,
            "proteinTarget_g": None,
            "proteinPct":      0,
            "carbsPct":        0,
            "fatPct":          0,
            "latestWeightKg":  n1(latest_weight_kg),
            "meals":           [],
        }

    # Pick the most recent logged_date that has any rows.
    day_rows = defaultdict(list)
    for r in log_rows:
        d = parse_day(r.get("logged_date"))
        if not d:
            continue
        day_rows[d].append(r)
    if not day_rows:
        latest_day = None
        rows = []
    else:
        latest_day = max(day_rows.keys())
        rows = day_rows[latest_day]

    # Group into meals in canonical order.
    by_meal = defaultdict(list)
    for r in rows:
        by_meal[canonical_meal(r.get("meal"))].append(r)

    meals = []
    for meal in MEAL_ORDER + [m for m in by_meal if m not in MEAL_ORDER]:
        items = by_meal.get(meal, [])
        if not items:
            continue
        item_out = []
        totals = {"calories_kcal": 0.0, "protein_g": 0.0, "carbs_g": 0.0,
                  "fat_g": 0.0, "fiber_g": 0.0}
        for r in items:
            row = {
                "item":          r.get("item") or "",
                "quantity":      r.get("quantity") or "",
                "calories_kcal": n0(r.get("calories_kcal")),
                "protein_g":     n1(r.get("protein_g")) or 0,
                "carbs_g":       n1(r.get("carbs_g")) or 0,
                "fat_g":         n1(r.get("fat_g")) or 0,
                "fiber_g":       n1(r.get("fiber_g")) or 0,
            }
            item_out.append(row)
            for k in totals:
                totals[k] += f_num(r.get(k))
        meals.append({
            "meal":  meal,
            "items": item_out,
            "total": {
                "calories_kcal": n0(totals["calories_kcal"]),
                "protein_g":     n1(totals["protein_g"]) or 0,
                "carbs_g":       n1(totals["carbs_g"]) or 0,
                "fat_g":         n1(totals["fat_g"]) or 0,
                "fiber_g":       n1(totals["fiber_g"]) or 0,
            },
        })

    cals_in = sum(f_num(r.get("calories_kcal")) for r in rows)
    protein = sum(f_num(r.get("protein_g")) for r in rows)
    carbs   = sum(f_num(r.get("carbs_g")) for r in rows)
    fat     = sum(f_num(r.get("fat_g")) for r in rows)
    fiber   = sum(f_num(r.get("fiber_g")) for r in rows)
    cals_from_macros = protein * 4 + carbs * 4 + fat * 9
    denom = cals_from_macros if cals_from_macros > 0 else max(cals_in, 1.0)
    cals_out = daily_out.get(latest_day, 0.0) if latest_day else 0.0
    net = cals_in - cals_out
    is_deficit = net < 0
    target_g = int(round(PROTEIN_G_PER_KG * latest_weight_kg)) if latest_weight_kg else None

    return {
        "date":            latest_day.isoformat() if latest_day else None,
        "caloriesIn":      n0(cals_in),
        "caloriesOut":     n0(cals_out),
        "net":             int(round(net)),
        "deficit":         int(round(abs(net))),
        "isDeficit":       bool(is_deficit),
        "protein_g":       n1(protein) or 0,
        "carbs_g":         n1(carbs) or 0,
        "fat_g":           n1(fat) or 0,
        "fiber_g":         n1(fiber) or 0,
        "proteinTarget_g": target_g,
        "proteinPct":      round((protein * 4) / denom * 100) if denom else 0,
        "carbsPct":        round((carbs   * 4) / denom * 100) if denom else 0,
        "fatPct":          round((fat     * 9) / denom * 100) if denom else 0,
        "latestWeightKg":  n1(latest_weight_kg),
        "meals":           meals,
    }


def build_trends(daily_in, daily_out, body_rows, latest_weight_kg, days):
    """Day-by-day series for the trends view + rolling summaries."""
    today = date.today()
    start = today - timedelta(days=days - 1)
    day_list = [start + timedelta(days=i) for i in range(days)]

    series = []
    protein_vals = []
    deficits = []
    days_on_target = 0
    days_tracked = 0
    target_g = round(PROTEIN_G_PER_KG * latest_weight_kg) if latest_weight_kg else None

    for d in day_list:
        rec = daily_in.get(d)
        cals_in = round(rec["calories_kcal"]) if rec else 0
        protein_g = round(rec["protein_g"], 1) if rec else 0
        cals_out = round(daily_out.get(d, 0.0))
        net = cals_in - cals_out
        tracked = rec is not None and rec["rows"] > 0
        if tracked:
            days_tracked += 1
            protein_vals.append(protein_g)
            if target_g and protein_g >= target_g:
                days_on_target += 1
            if cals_out > 0:
                deficits.append(net)  # negative when in a deficit
        series.append({
            "date":         d.isoformat(),
            "caloriesIn":   cals_in,
            "caloriesOut":  cals_out,
            "net":          net,
            "protein_g":    protein_g,
            "tracked":      tracked,
        })

    avg_deficit = round(sum(deficits) / len(deficits)) if deficits else 0
    avg_protein = round(sum(protein_vals) / len(protein_vals), 1) if protein_vals else 0

    body = []
    for r in body_rows:
        dt = parse_ts(r.get("measured_at"))
        if not dt:
            continue
        body.append({
            "measured_at":  dt.date().isoformat(),
            "weight_kg":    n1(r.get("weight_kg")),
            "body_fat_pct": n1(r.get("body_fat_pct")),
        })

    return {
        "days":            series,
        "avgDailyDeficit": avg_deficit,   # negative = deficit
        "avgDailyProtein": avg_protein,
        "proteinTargetG":  target_g,
        "daysOnTarget":    days_on_target,
        "daysTracked":     days_tracked,
        "daysTotal":       days,
        "body":            body,
    }


def render(today_payload, trends_payload, meta_payload):
    if not TEMPLATE.exists():
        sys.exit(f"ERROR: template not found: {TEMPLATE}")
    tpl = TEMPLATE.read_text(encoding="utf-8")
    tokens = {
        TOKEN_TODAY:  today_payload,
        TOKEN_TRENDS: trends_payload,
        TOKEN_META:   meta_payload,
    }
    for token in tokens:
        if token not in tpl:
            sys.exit(f"ERROR: {token} token missing in {TEMPLATE.name}")
    rendered = tpl
    for token, payload in tokens.items():
        rendered = rendered.replace(
            token, json.dumps(payload, separators=(",", ":"), default=str)
        )
    OUTPUT.write_text(rendered, encoding="utf-8")
    return rendered


def main():
    ap = argparse.ArgumentParser(description="Render nutrition dashboard from Supabase")
    ap.add_argument("--days", type=int, default=60,
                    help="Days of history for the Trends view (default 60)")
    ap.add_argument("--body-days", type=int, default=180,
                    help="Days of body-composition history for the overlay (default 180)")
    args = ap.parse_args()

    today = date.today()
    sb = get_client()

    log_cutoff  = (today - timedelta(days=args.days)).isoformat()
    body_cutoff = (today - timedelta(days=args.body_days)).isoformat()
    # WHOOP cycles land per calendar day; grab a few extra to be safe on TZ edges.
    cycle_cutoff_iso = (
        datetime.now(timezone.utc) - timedelta(days=args.days + 2)
    ).isoformat()

    log_rows = rest_query(sb, "nutrition_log", lambda s:
        s.table("nutrition_log")
         .select("logged_date,meal,item,quantity,calories_kcal,protein_g,carbs_g,fat_g,fiber_g")
         .gte("logged_date", log_cutoff)
         .order("logged_date", desc=False)
         .execute()
    )

    cycle_rows = rest_query(sb, "whoop_cycles", lambda s:
        s.table("whoop_cycles")
         .select("start_time,calories_kcal,kilojoules")
         .gte("start_time", cycle_cutoff_iso)
         .execute()
    )

    body_rows = rest_query(sb, "body_composition", lambda s:
        s.table("body_composition")
         .select("measured_at,weight_kg,body_fat_pct")
         .gte("measured_at", body_cutoff)
         .order("measured_at", desc=False)
         .execute()
    )

    latest_weight = None
    for r in reversed(body_rows):
        w = r.get("weight_kg")
        if w is not None:
            try:
                latest_weight = float(w)
                break
            except (TypeError, ValueError):
                continue

    daily_in  = build_daily_in(log_rows)
    daily_out = build_daily_out(cycle_rows)

    today_payload  = build_today(log_rows, daily_out, latest_weight)
    trends_payload = build_trends(daily_in, daily_out, body_rows, latest_weight, args.days)
    meta_payload   = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "days":        args.days,
        "logRows":     len(log_rows),
        "bodyRows":    len(body_rows),
    }

    out = render(today_payload, trends_payload, meta_payload)
    latest_date = today_payload.get("date")
    print(
        f"Wrote {OUTPUT.name}: latest={latest_date} "
        f"in={today_payload['caloriesIn']} out={today_payload['caloriesOut']} "
        f"net={today_payload['net']} protein={today_payload['protein_g']}g / "
        f"target={today_payload['proteinTarget_g']}g, "
        f"trends {trends_payload['daysTracked']}/{trends_payload['daysTotal']} days tracked, "
        f"avg deficit {trends_payload['avgDailyDeficit']} kcal, "
        f"body {len(body_rows)} readings. "
        f"{len(out):,} bytes."
    )


if __name__ == "__main__":
    main()
