#!/usr/bin/env python3
"""
Meal suggester for the Overload Nutrition dashboard.

build_suggestions() reads Supabase (WHOOP burn + strain, recovery, latest
weight, recent food log, the weekly training template, and any pinned meals),
sets the day's calorie / protein / water targets, then picks 2-3 options per
meal from meal_templates, tuned to the day and rotated so it does not repeat.

Pure rules, no API key. Returns a dict that build_overload.py injects into the
template as __SUGGESTIONS_DATA__. Everything is defensive: if a table is empty
it falls back to sane defaults so the build never breaks.
"""

import os
from datetime import datetime, timedelta, timezone

from supabase import create_client, Client

MEALS = ["breakfast", "lunch", "dinner", "snack"]
MEAL_PCT = {"breakfast": 0.25, "lunch": 0.30, "dinner": 0.30, "snack": 0.15}

# deficit (kcal below burn) by training load. A cut, eased on hard days.
DEFICIT_BY_LOAD = {"high": 250, "moderate": 400, "low": 500, "rest": 500}


def _sb() -> Client:
    return create_client(os.environ["SUPABASE_URL"].strip(),
                         os.environ["SUPABASE_KEY"].strip())


def _today_et():
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("America/New_York")).date()
    except Exception:
        return datetime.now(timezone.utc).date()


def _num(x, default=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def build_suggestions():
    sb = _sb()
    today = _today_et()
    dow = today.strftime("%a")   # Mon, Tue, ...

    # --- inputs -------------------------------------------------------------
    weight = 69.0
    try:
        r = (sb.table("body_composition").select("weight_kg")
             .order("measured_at", desc=True).limit(1).execute())
        if r.data and r.data[0].get("weight_kg"):
            weight = _num(r.data[0]["weight_kg"], 69.0)
    except Exception:
        pass

    burns, strain = [], 0.0
    try:
        r = (sb.table("whoop_cycles").select("calories_kcal,kilojoules,strain,start_time")
             .order("start_time", desc=True).limit(10).execute())
        for i, row in enumerate(r.data or []):
            kcal = row.get("calories_kcal")
            if kcal is None and row.get("kilojoules") is not None:
                kcal = _num(row["kilojoules"]) / 4.184
            if kcal:
                burns.append(_num(kcal))
            if i == 0:
                strain = _num(row.get("strain"))
    except Exception:
        pass
    avg_burn = round(sum(burns) / len(burns)) if burns else 2600

    recovery = None
    try:
        r = (sb.table("whoop_recovery").select("recovery_score")
             .order("recovery_date", desc=True).limit(1).execute())
        if r.data:
            recovery = _num(r.data[0].get("recovery_score"), None) or None
    except Exception:
        pass

    load, training_type = "moderate", "Training"
    try:
        r = sb.table("training_plan").select("training_type,load").eq("dow", dow).execute()
        if r.data:
            load = (r.data[0].get("load") or "moderate").lower()
            training_type = r.data[0].get("training_type") or "Training"
    except Exception:
        pass

    recent_items = set()
    try:
        since = (today - timedelta(days=2)).isoformat()
        r = (sb.table("nutrition_log").select("item")
             .gte("logged_date", since).execute())
        for row in (r.data or []):
            recent_items.add((row.get("item") or "").lower())
    except Exception:
        pass

    pins = {m: [] for m in MEALS}
    try:
        r = sb.table("meal_plan").select("meal,item,note").eq("plan_date", today.isoformat()).execute()
        for row in (r.data or []):
            m = (row.get("meal") or "").lower()
            if m in pins:
                pins[m].append(row)
    except Exception:
        pass

    templates = {m: [] for m in MEALS}
    try:
        r = sb.table("meal_templates").select("*").eq("active", True).execute()
        for t in (r.data or []):
            m = (t.get("meal") or "").lower()
            if m in templates:
                templates[m].append(t)
    except Exception:
        pass

    # --- targets ------------------------------------------------------------
    protein_target = round(2.0 * weight)
    deficit = DEFICIT_BY_LOAD.get(load, 400)
    if recovery is not None and recovery < 34:   # low recovery, ease the cut
        deficit = min(deficit, 300)
    calorie_target = max(1600, round(avg_burn - deficit))

    water_l = weight * 0.035
    if load in ("high", "moderate"):
        water_l += 0.5
    if strain and strain > 14:
        water_l += 0.5
    water_l = round(water_l * 4) / 4   # nearest 0.25 L

    # --- pick options per meal ---------------------------------------------
    day_seed = today.toordinal()

    def recently_eaten(t):
        blob = (t.get("name", "") + " " + t.get("items", "")).lower()
        return any(ri and ri in blob for ri in recent_items)

    out_meals = {}
    for m in MEALS:
        budget = calorie_target * MEAL_PCT[m]
        cands = list(templates.get(m, []))
        def score(t):
            fit = -abs(_num(t.get("calories")) - budget) / max(budget, 1)
            prot = _num(t.get("protein_g")) / 100.0
            pen = -0.6 if recently_eaten(t) else 0.0
            return fit + prot + pen
        cands.sort(key=score, reverse=True)

        top = cands[:5] if len(cands) >= 5 else cands
        options = []
        if top:
            n = min(3, len(top))
            start = day_seed % len(top)
            for k in range(n):
                t = top[(start + k) % len(top)]
                options.append({
                    "name": t.get("name"),
                    "items": t.get("items"),
                    "calories": round(_num(t.get("calories"))),
                    "protein_g": round(_num(t.get("protein_g"))),
                    "carbs_g": round(_num(t.get("carbs_g"))),
                    "fat_g": round(_num(t.get("fat_g"))),
                    "planned": False,
                })

        for p in pins.get(m, []):
            options.insert(0, {
                "name": p.get("item"),
                "items": p.get("note") or "planned",
                "calories": None, "protein_g": None, "carbs_g": None, "fat_g": None,
                "planned": True,
            })

        out_meals[m] = options

    return {
        "date": today.isoformat(),
        "day_type": training_type,
        "load": load,
        "recovery": round(recovery) if recovery is not None else None,
        "calorie_target": calorie_target,
        "protein_target_g": protein_target,
        "water_l": water_l,
        "avg_burn": avg_burn,
        "meals": out_meals,
    }


if __name__ == "__main__":
    import json
    print(json.dumps(build_suggestions(), indent=2))
