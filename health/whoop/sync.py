import os, requests, psycopg2
from datetime import datetime, timedelta, timezone
from base64 import b64encode
from nacl import encoding, public

CLIENT_ID     = os.environ["WHOOP_CLIENT_ID"]
CLIENT_SECRET = os.environ["WHOOP_CLIENT_SECRET"]
REFRESH_TOKEN = os.environ["WHOOP_REFRESH_TOKEN"]
DB_URL        = os.environ["SUPABASE_DB_URL"]
GH_PAT        = os.environ.get("GH_PAT")
GH_REPO = os.environ.get("GITHUB_REPOSITORY", "fernandomartinez-de/whoop-pipeline")

SPORT_NAMES = {
    -1: "Activity", 0: "Running", 1: "Cycling", 16: "Baseball", 17: "Basketball",
    18: "Rowing", 19: "Fencing", 20: "Field Hockey", 21: "Football", 22: "Golf",
    24: "Ice Hockey", 25: "Lacrosse", 27: "Rugby", 28: "Sailing", 29: "Skiing",
    30: "Soccer", 31: "Softball", 32: "Squash", 33: "Swimming", 34: "Tennis",
    35: "Track and Field", 36: "Volleyball", 37: "Water Polo", 38: "Wrestling",
    39: "Boxing", 42: "Dance", 43: "Pilates", 44: "Yoga", 45: "Weightlifting",
    47: "Cross Country Skiing", 48: "Functional Fitness", 49: "Duathlon",
    51: "Gymnastics", 52: "Hiking/Rucking", 53: "Horseback Riding",
    55: "Kayaking", 56: "Martial Arts", 57: "Mountain Biking", 59: "Powerlifting",
    60: "Rock Climbing", 61: "Paddleboarding", 62: "Triathlon", 63: "Walking",
    64: "Surfing", 65: "Elliptical", 66: "Stairmaster", 70: "Meditation",
    71: "Other", 73: "Diving", 74: "Operations - Tactical", 75: "Operations - Medical",
    76: "Operations - Flying", 77: "Operations - Water", 82: "Ultimate",
    83: "Climber", 84: "Jumping Rope", 85: "Australian Football", 86: "Skateboarding",
    87: "Coaching", 88: "Ice Bath", 89: "Commuting", 90: "Gaming",
    91: "Snowboarding", 92: "Motocross", 93: "Caddying", 94: "Obstacle Course Racing",
    95: "Motor Racing", 96: "HIIT", 97: "Spin", 98: "Jiu Jitsu",
    99: "Manual Labor", 100: "Cricket", 101: "Pickleball", 102: "Inline Skating",
    103: "Box Fitness", 104: "Spikeball", 105: "Wheelchair Pushing",
    106: "Paddle Tennis", 107: "Barre", 108: "Stage Performance",
    109: "High Stress Work", 110: "Parkour", 111: "Gaelic Football",
    112: "Hurling/Camogie", 113: "Circus Arts", 121: "Massage Therapy",
    125: "Watching Sports", 126: "Assault Bike", 127: "Kickboxing",
    128: "Stretching", 230: "Table Tennis", 231: "Badminton", 232: "Netball",
    233: "Sauna", 234: "Disc Golf", 235: "Yard Work", 236: "Air Compression",
    237: "Percussive Massage", 238: "Paintball", 239: "Ice Skating",
    240: "Handball", 248: "F45 Training", 249: "Padel", 250: "Barry's",
    251: "Dedicated Parenting", 252: "Stroller Walking", 253: "Stroller Jogging",
    254: "Toddlerwearing", 255: "Babywearing", 258: "Barre3", 259: "Hot Yoga",
    261: "Stadium Steps", 262: "Polo", 263: "Musical Performance", 264: "Kite Boarding",
    266: "Dog Walking", 267: "Water Skiing", 268: "Wakeboarding", 269: "Cooking",
    270: "Cleaning", 272: "Public Speaking",
}

def update_github_secret(secret_name, secret_value):
    if not GH_PAT:
        print("GH_PAT not set, skipping secret rotation")
        return
    try:
        h = {"Authorization": f"token {GH_PAT}", "Accept": "application/vnd.github+json"}
        key_resp = requests.get(f"https://api.github.com/repos/{GH_REPO}/actions/secrets/public-key", headers=h)
        key_resp.raise_for_status()
        key_data = key_resp.json()
        pub_key = public.PublicKey(key_data["key"].encode("utf-8"), encoding.Base64Encoder())
        sealed = public.SealedBox(pub_key).encrypt(secret_value.encode("utf-8"))
        encrypted = b64encode(sealed).decode("utf-8")
        put_resp = requests.put(
            f"https://api.github.com/repos/{GH_REPO}/actions/secrets/{secret_name}",
            headers=h,
            json={"encrypted_value": encrypted, "key_id": key_data["key_id"]}
        )
        put_resp.raise_for_status()
        print(f"Rotated {secret_name} successfully")
    except Exception as e:
        print(f"Failed to rotate {secret_name}: {e}")

def get_access_token():
    r = requests.post("https://api.prod.whoop.com/oauth/oauth2/token", data={
        "grant_type":    "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "offline",
    })
    r.raise_for_status()
    payload = r.json()
    new_refresh = payload.get("refresh_token")
    if new_refresh and new_refresh != REFRESH_TOKEN:
        update_github_secret("WHOOP_REFRESH_TOKEN", new_refresh)
    return payload["access_token"]

def whoop_get_all(token, path, days_back=365):
    all_records = []
    next_token = None
    page = 1
    start = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()
    end   = datetime.now(timezone.utc).isoformat()
    while True:
        params = {"limit": 25, "start": start, "end": end}
        if next_token:
            params["nextToken"] = next_token
        r = requests.get(
            f"https://api.prod.whoop.com/developer/v2/{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params
        )
        r.raise_for_status()
        data = r.json()
        records = data.get("records", [])
        all_records.extend(records)
        print(f"  {path} page {page}: {len(records)} records (total: {len(all_records)})")
        next_token = data.get("next_token")
        if not next_token:
            break
        page += 1
        if page > 100:
            print("  Stopped at 100 pages safety limit")
            break
    return all_records

def whoop_get(token, path):
    r = requests.get(
        f"https://api.prod.whoop.com/developer/v2/{path}",
        headers={"Authorization": f"Bearer {token}"}
    )
    r.raise_for_status()
    return r.json()

def ms_to_min(ms):
    return round(ms / 60000.0, 1) if ms else None

def sync():
    token = get_access_token()
    conn  = psycopg2.connect(DB_URL)
    cur   = conn.cursor()

    print("Fetching all cycles...")
    cycles = whoop_get_all(token, "cycle")
    for c in cycles:
        score = c.get("score") or {}
        kj = score.get("kilojoule")
        cal = round(kj * 0.239, 1) if kj else None
        cur.execute("""
            insert into whoop_cycles (cycle_id, start_time, end_time, strain,
              average_heart_rate, max_heart_rate, kilojoules, calories_kcal)
            values (%s,%s,%s,%s,%s,%s,%s,%s)
            on conflict (cycle_id) do update set
              strain=excluded.strain, average_heart_rate=excluded.average_heart_rate,
              max_heart_rate=excluded.max_heart_rate, kilojoules=excluded.kilojoules,
              calories_kcal=excluded.calories_kcal
        """, (str(c["id"]), c.get("start"), c.get("end"),
              score.get("strain"), score.get("average_heart_rate"),
              score.get("max_heart_rate"), kj, cal))

    print("Fetching all recovery...")
    recoveries = whoop_get_all(token, "recovery")
    for r in recoveries:
        score = r.get("score") or {}
        cycle_id_str = str(r["cycle_id"])
        cur.execute("select start_time::date from whoop_cycles where cycle_id = %s", (cycle_id_str,))
        row = cur.fetchone()
        rec_date = row[0] if row else None
        cur.execute("""
            insert into whoop_recovery (cycle_id, recovery_date, recovery_score, resting_heart_rate,
              hrv_rmssd_milli, spo2_percentage, skin_temp_celsius)
            values (%s,%s,%s,%s,%s,%s,%s)
            on conflict (cycle_id) do update set
              recovery_date=excluded.recovery_date,
              recovery_score=excluded.recovery_score,
              resting_heart_rate=excluded.resting_heart_rate,
              hrv_rmssd_milli=excluded.hrv_rmssd_milli,
              spo2_percentage=excluded.spo2_percentage,
              skin_temp_celsius=excluded.skin_temp_celsius
        """, (cycle_id_str, rec_date, score.get("recovery_score"),
              score.get("resting_heart_rate"), score.get("hrv_rmssd_milli"),
              score.get("spo2_percentage"), score.get("skin_temp_celsius")))

    print("Fetching all sleep...")
    sleeps = whoop_get_all(token, "activity/sleep")
    for s in sleeps:
        score = s.get("score") or {}
        stages = score.get("stage_summary") or {}
        dur = None
        if s.get("start") and s.get("end"):
            dur = round((datetime.fromisoformat(s["end"].replace("Z","+00:00")) -
                   datetime.fromisoformat(s["start"].replace("Z","+00:00"))).seconds / 60, 1)
        cur.execute("""
            insert into whoop_sleep (sleep_id, cycle_id, start_time, end_time,
              duration_minutes, performance_percentage, sleep_efficiency_percentage,
              light_sleep_minutes, slow_wave_sleep_minutes, rem_sleep_minutes, awake_minutes)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            on conflict (sleep_id) do update set
              performance_percentage=excluded.performance_percentage,
              sleep_efficiency_percentage=excluded.sleep_efficiency_percentage,
              light_sleep_minutes=excluded.light_sleep_minutes,
              slow_wave_sleep_minutes=excluded.slow_wave_sleep_minutes,
              rem_sleep_minutes=excluded.rem_sleep_minutes,
              awake_minutes=excluded.awake_minutes
        """, (str(s["id"]), str(s.get("cycle_id")) if s.get("cycle_id") else None,
              s.get("start"), s.get("end"), dur,
              score.get("sleep_performance_percentage"),
              score.get("sleep_efficiency_percentage"),
              ms_to_min(stages.get("total_light_sleep_time_milli")),
              ms_to_min(stages.get("total_slow_wave_sleep_time_milli")),
              ms_to_min(stages.get("total_rem_sleep_time_milli")),
              ms_to_min(stages.get("total_awake_time_milli"))))

    print("Fetching all workouts...")
    workouts = whoop_get_all(token, "activity/workout")
    for w in workouts:
        score = w.get("score") or {}
        kj = score.get("kilojoule")
        cal = round(kj * 0.239, 1) if kj else None
        sport_id = w.get("sport_id")
        sport_name = SPORT_NAMES.get(sport_id, f"Unknown ({sport_id})")
        cur.execute("""
            insert into whoop_workouts (workout_id, start_time, end_time, sport_name,
              strain, average_heart_rate, max_heart_rate, kilojoules, calories_kcal)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            on conflict (workout_id) do update set
              sport_name=excluded.sport_name,
              strain=excluded.strain,
              kilojoules=excluded.kilojoules,
              calories_kcal=excluded.calories_kcal
        """, (str(w["id"]), w.get("start"), w.get("end"), sport_name,
              score.get("strain"), score.get("average_heart_rate"),
              score.get("max_heart_rate"), kj, cal))

    try:
        data = whoop_get(token, "user/measurement/body")
        cur.execute("delete from whoop_body")
        cur.execute("""
            insert into whoop_body (height_meter, weight_kilogram, max_heart_rate, vo2_max)
            values (%s,%s,%s,%s)
        """, (data.get("height_meter"), data.get("weight_kilogram"),
              data.get("max_heart_rate"), data.get("vo2_max")))
    except Exception as e:
        print(f"Body measurement skipped: {e}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"Sync complete: {datetime.now()}")
    print(f"Totals: {len(cycles)} cycles, {len(recoveries)} recoveries, {len(sleeps)} sleeps, {len(workouts)} workouts")

sync()
