"""E2E del flusso client: Supabase Auth → 404 /users/me → onboarding →
piano/giorni/esercizi annidati → sessione. Stesse chiamate di lib/api.ts.

Uso: python3 scripts/e2e-client-flow.py   (richiede backend :3000 + supabase :54321)
"""
import json
import sys
import time
import urllib.error
import urllib.request

SUPA = "http://127.0.0.1:54321"
API = "http://localhost:3000/api"
ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9."
        "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0")

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("OK  " if ok else "FAIL") + f" {name}" + (f" — {detail}" if detail else ""))


def call(method: str, url: str, body=None, headers: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, resp.read().decode(), dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode(), dict(exc.headers)


def main() -> int:
    email = f"e2e-{int(time.time())}@example.com"
    password = "password-e2e-1"

    # --- Supabase Auth: signup + login (come lib/auth.tsx) ---
    status, text, _ = call("POST", f"{SUPA}/auth/v1/signup",
                           {"email": email, "password": password, "data": {"name": "E2E"}},
                           {"apikey": ANON, "Authorization": f"Bearer {ANON}"})
    check("Supabase signup → 200", status == 200, f"{status} {text[:160]}")

    status, text, _ = call("POST", f"{SUPA}/auth/v1/token?grant_type=password",
                           {"email": email, "password": password},
                           {"apikey": ANON, "Authorization": f"Bearer {ANON}"})
    check("Supabase login → 200 con access_token", status == 200, f"{status} {text[:160]}")
    if status != 200:
        return 1
    token = json.loads(text)["access_token"]
    auth = {"Authorization": f"Bearer {token}"}

    # --- 404 iniziale: l'onboarding deve scattare da qui ---
    status, text, _ = call("GET", f"{API}/users/me", headers=auth)
    err = json.loads(text).get("error", {}) if text.startswith("{") else {}
    check("GET /users/me nuovo utente → 404", status == 404, f"{status}")
    check("404 ha envelope {error:{code,message}}",
          err.get("code") == "NOT_FOUND" and bool(err.get("message")), str(err)[:160])

    # --- Completamento onboarding (mappature di lib/profileQueries.ts) ---
    payload = {"name": "Utente E2E", "birth_date": f"{time.gmtime().tm_year - 30}-01-01",
               "gender": "male", "height_cm": 178, "weight_kg": 74,
               "goal": "lose", "activity_level": "active"}
    status, text, _ = call("POST", f"{API}/users", payload, auth)
    check("POST /users → 201", status == 201, f"{status} {text[:160]}")

    status, text, _ = call("POST", f"{API}/users", payload, auth)
    check("POST /users due volte → 409 CONFLICT (gestito come successo)",
          status == 409 and json.loads(text).get("error", {}).get("code") == "CONFLICT",
          f"{status}")

    status, text, _ = call("GET", f"{API}/users/me", headers=auth)
    me = json.loads(text) if status == 200 else {}
    check("GET /users/me → 200 con obiettivo TDEE",
          status == 200 and bool(me.get("daily_calorie_target")), f"{status}")

    # --- Scheda: piano → giorno → esercizi (come useSaveWorkoutDay) ---
    status, text, _ = call("POST", f"{API}/workout-plans",
                           {"name": "La mia scheda", "source": "manual"}, auth)
    plan = json.loads(text) if status == 201 else {}
    check("POST /workout-plans → 201", status == 201, f"{status} {text[:160]}")

    status, text, _ = call("POST", f"{API}/workout-days",
                           {"workout_plan_id": plan.get("id"), "name": "Giorno Push",
                            "day_order": 1}, auth)
    day = json.loads(text) if status == 201 else {}
    check("POST /workout-days → 201", status == 201, f"{status} {text[:160]}")

    ex_ids = []
    for i, (name, sets, reps, weight) in enumerate(
            [("Panca piana", 4, 8, 60.0), ("Push up", 3, 12, 0.0)], start=1):
        body = {"workout_day_id": day.get("id"), "name": name, "sets": sets,
                "reps": reps, "order_index": i}
        if weight > 0:
            body["weight_kg"] = weight
        status, text, _ = call("POST", f"{API}/exercises", body, auth)
        if status == 201:
            ex_ids.append(json.loads(text)["id"])
    check("POST /exercises ×2 → 201", len(ex_ids) == 2, f"{len(ex_ids)}/2")

    # --- Dettaglio annidato consumato da useWorkoutPlan ---
    status, text, _ = call("GET", f"{API}/workout-plans/{plan.get('id')}", headers=auth)
    detail = json.loads(text) if status == 200 else {}
    days = detail.get("workout_days") or []
    nested = days[0].get("exercises") if days else []
    check("GET /workout-plans/:id → 200 annidato",
          status == 200 and [d["id"] for d in days] == [day.get("id")], f"{status}")
    check("giorni ed esercizi ordinati nel dettaglio",
          [e["order_index"] for e in nested] == [1, 2],
          str([e["order_index"] for e in nested]))

    # --- Sessione chiusa (come useCreateWorkoutSession) ---
    now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
    started = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() - 3600))
    status, text, _ = call("POST", f"{API}/workout-sessions",
                           {"workout_plan_id": plan.get("id"), "workout_day_id": day.get("id"),
                            "started_at": started, "completed_at": now,
                            "performed_data": [{"exercise_id": ex_ids[0],
                                                "sets": [{"reps": 8, "weight_kg": 62.5}]}]},
                           auth)
    session = json.loads(text) if status == 201 else {}
    check("POST /workout-sessions → 201", status == 201, f"{status} {text[:160]}")

    status, text, _ = call("GET", f"{API}/workout-sessions", headers=auth)
    rows = json.loads(text) if status == 200 else []
    check("GET /workout-sessions → 200 e ritrova la sessione",
          status == 200 and any(r["id"] == session.get("id") for r in rows), f"{status}")

    # --- CORS: preflight dal dev server Expo web ---
    status, _, hdrs = call("OPTIONS", f"{API}/workout-plans", headers={
        "Origin": "http://localhost:8081",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    allow = hdrs.get("Access-Control-Allow-Origin") or hdrs.get("access-control-allow-origin")
    check("CORS preflight da :8081 → 204 con allow-origin",
          status in (200, 204) and allow == "http://localhost:8081", f"{status} {allow}")

    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
    if failed:
        print("Fallite: " + "; ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
