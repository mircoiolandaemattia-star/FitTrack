"""Smoke test HTTP per il backend FitTrack (profilo users + workout_plans
+ workout_days).

Richiede il Supabase locale attivo (npx supabase start) e il server avviato:
  PORT=3000 npm start

Genera token JWT HS256 firmati con SUPABASE_JWT_SECRET (da .env o dall'env),
così si esercita il percorso reale di verifica: nessun bypass d'auth.

Uso: python3 scripts/smoke-api.py   (API_BASE per cambiare la base URL)
"""
import base64
import datetime
import hashlib
import hmac
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = os.environ.get("API_BASE", "http://127.0.0.1:3000")
USER_ID = str(uuid.uuid4())      # utente "proprietario" dei dati del test
OTHER_ID = str(uuid.uuid4())     # utente autenticato ma estraneo (test IDOR)
ONBOARD_ID = str(uuid.uuid4())   # utente senza riga users: fa l'onboarding
ONBOARD_EMAIL = "onboarding@test.it"
TOKEN = ""                       # token valido per USER_ID, impostato in main()
results = []


# ---------------------------------------------------------------- JWT (HS256)

def load_secret() -> str:
    if os.environ.get("SUPABASE_JWT_SECRET"):
        return os.environ["SUPABASE_JWT_SECRET"]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("SUPABASE_JWT_SECRET="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SUPABASE_JWT_SECRET assente: imposta .env o la variabile d'ambiente")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def make_token(secret: str, *, sub=USER_ID, expires_in=3600,
               sign_with=None, with_sub=True, email=None) -> str:
    """JWT HS256 firmato con hmac: identico nella forma a quelli di Supabase Auth."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": "supabase", "role": "authenticated",
               "iat": now, "exp": now + expires_in}
    if with_sub:
        payload["sub"] = sub
    if email:
        payload["email"] = email
    signing_input = (
        f"{b64url(json.dumps(header, separators=(',', ':')).encode())}."
        f"{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    )
    key = (sign_with or secret).encode()
    sig = hmac.new(key, signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(sig)}"


# ------------------------------------------------- TDEE atteso (per i test)

ACTIVITY_MULTIPLIER = {"sedentary": 1.2, "light": 1.375, "moderate": 1.55,
                       "active": 1.725, "very_active": 1.9}
GOAL_ADJUSTMENT = {"lose": 0.8, "maintain": 1.0, "gain": 1.1}


def js_round(x: float) -> int:
    """Math.round() di JS (metà per eccesso): non il round banker di Python."""
    return math.floor(x + 0.5)


def expected_targets(birth: datetime.date, gender: str, height: float,
                     weight: float, goal: str, activity: str) -> dict:
    """Ricalcola la formula del backend in modo indipendente, operazione per
    operazione nella stessa identica sequenza, così il confronto è esatto."""
    today = datetime.date.today()
    age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
    base = 10 * weight + 6.25 * height - 5 * age
    if gender == "male":
        bmr = base + 5
    elif gender == "female":
        bmr = base - 161
    else:
        bmr = base + (5 - 161) / 2
    calories = js_round(bmr * ACTIVITY_MULTIPLIER[activity] * GOAL_ADJUSTMENT[goal])
    protein = js_round(1.8 * weight)
    fat = js_round(calories * 0.25 / 9)
    carbs = js_round((calories - protein * 4 - fat * 9) / 4)
    return {"daily_calorie_target": calories, "protein_target_g": protein,
            "carbs_target_g": carbs, "fat_target_g": fat}


# ------------------------------------------------------------------ helpers

def psql(sql: str) -> None:
    subprocess.run(
        ["docker", "exec", "supabase_db_FitTrack", "psql", "-U", "postgres",
         "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True, capture_output=True, text=True,
    )


def req(method: str, path: str, body=None, raw: str | None = None,
        token: str | None = None):
    """`token=None` usa il token globale; `token=""` invia senza Authorization."""
    data, headers = None, {"Accept": "application/json"}
    if raw is not None:
        data, headers["Content-Type"] = raw.encode(), "application/json"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    effective = TOKEN if token is None else token
    if effective:
        headers["Authorization"] = f"Bearer {effective}"
    request = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()


def record(name, ok, info, detail=""):
    results.append((name, ok, info, detail))


def run(name, method, path, *, status, code=None, body=None, raw=None,
        test=None, token=None):
    got_status, text = req(method, path, body=body, raw=raw, token=token)
    ok = got_status == status
    detail = text[:300]
    if ok and code is not None:
        try:
            payload = json.loads(text)
            ok = payload.get("error", {}).get("code") == code
        except (ValueError, AttributeError):
            ok = False
    if ok and test is not None:
        try:
            ok, detail = test(json.loads(text) if text else None)
        except ValueError:
            ok, detail = False, "body non JSON: " + text[:200]
    record(name, ok, f"atteso {status}{'/' + code if code else ''}, "
                     f"ricevuto {got_status}", detail if not ok else "")


def main():
    global TOKEN
    TOKEN = make_token(load_secret(), email="smoke@test.it")

    # attesa server ( /health è l'unica rota senza auth )
    for _ in range(50):
        try:
            if req("GET", "/health", token="")[0] == 200:
                break
        except OSError:
            pass
        time.sleep(0.2)

    psql(f"INSERT INTO users (id,email,name,goal,activity_level,updated_at) "
         f"VALUES ('{USER_ID}','smoke@test.it','Smoke','lose','moderate',now());")

    try:
        # health
        status, text = req("GET", "/health", token="")
        record("/health (senza auth)", status == 200 and text == "OK",
               f"atteso 200 'OK', ricevuto {status} '{text}'")

        # --- autenticazione
        run("Senza token → 401 UNAUTHENTICATED", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED", token="")
        run("Token malformato → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED", token="abc.def.ghi")
        run("Token firmato con altro secret → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED",
            token=make_token(load_secret(), sign_with="un-altro-secret-di-32-caratteri"))
        run("Token scaduto → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED",
            token=make_token(load_secret(), expires_in=-300))
        run("Token senza sub (stile anon key) → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED",
            token=make_token(load_secret(), with_sub=False))

        # --- validazione input (user_id non è più un input)
        run("POST /workout-plans corpo incompleto → 400", "POST", "/api/workout-plans",
            body={"name": "x"}, status=400, code="VALIDATION_ERROR")
        run("POST /workout-plans JSON malformato → 400", "POST", "/api/workout-plans",
            raw='{"name": ', status=400, code="INVALID_JSON")
        run("POST /workout-plans source non ammesso → 400", "POST", "/api/workout-plans",
            body={"name": "Piano", "source": "magic"},
            status=400, code="VALIDATION_ERROR")

        # --- CRUD workout_plans
        plan_ids = []

        def plan_created(payload):
            plan_ids.append(payload["id"])
            # user_id viene dal token, non dal body (dove mandiamo un altro)
            ok = (payload["user_id"] == USER_ID and payload["source"] == "manual"
                  and payload["is_active"] is True)
            return ok, json.dumps(payload)[:300]

        run("POST /workout-plans → 201 (user_id preso dal token)", "POST",
            "/api/workout-plans",
            body={"user_id": OTHER_ID, "name": "Piano forza", "source": "manual"},
            status=201, test=plan_created)

        plan_id = plan_ids[0]

        def only_own(payload):
            ids = [p["id"] for p in payload]
            return plan_id in ids, str(ids)[:300]

        run("GET /workout-plans (user_id in query ignorato) → 200 lista", "GET",
            f"/api/workout-plans?user_id={OTHER_ID}", status=200, test=only_own)
        run("GET /workout-plans/:id → 200", "GET", f"/api/workout-plans/{plan_id}",
            status=200, test=lambda p: (p["id"] == plan_id, str(p)[:300]))
        run("GET /workout-plans/:id inesistente → 404", "GET",
            f"/api/workout-plans/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /workout-plans/:id → 200", "PUT", f"/api/workout-plans/{plan_id}",
            body={"name": "Piano forza v2", "is_active": False}, status=200,
            test=lambda p: (p["name"] == "Piano forza v2" and p["is_active"] is False,
                            str(p)[:300]))
        run("PUT /workout-plans/:id corpo vuoto → 400", "PUT",
            f"/api/workout-plans/{plan_id}", body={}, status=400, code="BAD_REQUEST")
        run("PUT /workout-plans/:id inesistente → 404 (P2025)", "PUT",
            f"/api/workout-plans/{uuid.uuid4()}", body={"name": "x"},
            status=404, code="NOT_FOUND")

        # --- CRUD workout_days
        day_ids = []

        def day_created(payload):
            day_ids.append(payload["id"])
            ok = payload["workout_plan_id"] == plan_id and payload["day_order"] == 1
            return ok, json.dumps(payload)[:300]

        run("POST /workout-days → 201", "POST", "/api/workout-days",
            body={"workout_plan_id": plan_id, "name": "Giorno 1", "day_order": 1},
            status=201, test=day_created)
        day_id = day_ids[0]

        run("POST /workout-days con piano inesistente → 422 (P2003)", "POST",
            "/api/workout-days",
            body={"workout_plan_id": str(uuid.uuid4()), "name": "G", "day_order": 1},
            status=422, code="FOREIGN_KEY_VIOLATION")
        run("POST /workout-days day_order non intero → 400", "POST", "/api/workout-days",
            body={"workout_plan_id": plan_id, "name": "G", "day_order": "1.5"},
            status=400, code="VALIDATION_ERROR")

        def one_day(payload):
            return [d["id"] for d in payload] == [day_id], str(payload)[:300]

        run("GET /workout-days?workout_plan_id → 200", "GET",
            f"/api/workout-days?workout_plan_id={plan_id}", status=200, test=one_day)
        run("GET /workout-days senza filtro → 400", "GET", "/api/workout-days",
            status=400, code="VALIDATION_ERROR")
        run("GET /workout-days/:id → 200", "GET", f"/api/workout-days/{day_id}",
            status=200, test=lambda p: (p["id"] == day_id, str(p)[:300]))
        run("PUT /workout-days/:id → 200", "PUT", f"/api/workout-days/{day_id}",
            body={"name": "Giorno 1 bis", "day_order": 2}, status=200,
            test=lambda p: (p["name"] == "Giorno 1 bis" and p["day_order"] == 2,
                            str(p)[:300]))
        run("PUT /workout-days/:id inesistente → 404 (P2025)", "PUT",
            f"/api/workout-days/{uuid.uuid4()}", body={"name": "x"},
            status=404, code="NOT_FOUND")

        # --- isolamento fra utenti (IDOR/BOLA): altro utente autenticato
        intruder = make_token(load_secret(), sub=OTHER_ID, email="intruder@test.it")

        def empty_list(payload):
            return payload == [], str(payload)[:300]

        run("Altro utente: lista → 200 vuota", "GET", "/api/workout-plans",
            status=200, token=intruder, test=empty_list)
        run("Altro utente: GET piano altrui → 404", "GET",
            f"/api/workout-plans/{plan_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT piano altrui → 404", "PUT",
            f"/api/workout-plans/{plan_id}", body={"name": "hacker"},
            status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE piano altrui → 404", "DELETE",
            f"/api/workout-plans/{plan_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: GET giorno altrui → 404", "GET",
            f"/api/workout-days/{day_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: POST giorno sul piano altrui → 404", "POST",
            "/api/workout-days",
            body={"workout_plan_id": plan_id, "name": "intruso", "day_order": 9},
            status=404, code="NOT_FOUND", token=intruder)

        # --- profilo utente / onboarding (una riga per utente, nessun :id)
        onboard_token = make_token(load_secret(), sub=ONBOARD_ID, email=ONBOARD_EMAIL)
        birth = datetime.date(1990, 5, 20)
        onboard_body = {
            "name": "Mario Rossi", "birth_date": "1990-05-20", "gender": "male",
            "height_cm": 180, "weight_kg": 80, "goal": "lose",
            "activity_level": "moderate",
            # colonne di identità nel body: devono essere ignorate (dal token)
            "id": OTHER_ID, "email": "evil@attacker.it",
        }
        expected = expected_targets(birth, "male", 180, 80, "lose", "moderate")

        def targets_are(want):
            def check(payload):
                got = {k: payload.get(k) for k in want}
                return got == want, json.dumps(got)
            return check

        def onboarding_created(payload):
            ok_targets, detail = targets_are(expected)(payload)
            ok = (payload.get("id") == ONBOARD_ID and payload.get("email") == ONBOARD_EMAIL
                  and payload.get("name") == "Mario Rossi"
                  and payload.get("weight_kg") == 80 and ok_targets)
            return ok, f"id={payload.get('id')} email={payload.get('email')} {detail}"

        run("GET /users/me senza onboarding → 404", "GET", "/api/users/me",
            status=404, code="NOT_FOUND", token=onboard_token)
        run("POST /users corpo incompleto → 400", "POST", "/api/users",
            body={"name": "x"}, status=400, code="VALIDATION_ERROR",
            token=onboard_token)
        run("POST /users token senza claim email → 400 EMAIL_MISSING", "POST",
            "/api/users", body=onboard_body, status=400, code="EMAIL_MISSING",
            token=make_token(load_secret(), sub=ONBOARD_ID))
        run("POST /users (onboarding) → 201 con TDEE atteso", "POST",
            "/api/users", body=onboard_body, status=201, token=onboard_token,
            test=onboarding_created)
        run("POST /users due volte → 409 CONFLICT", "POST", "/api/users",
            body=onboard_body, status=409, code="CONFLICT", token=onboard_token)
        run("GET /users/me → 200 con i target salvati", "GET", "/api/users/me",
            status=200, token=onboard_token, test=targets_are(expected))
        run("Altro utente: GET /users/me → 404 (profilo proprio assente)", "GET",
            "/api/users/me", status=404, code="NOT_FOUND", token=intruder)
        run("GET /users/:id → 404 ROUTE_NOT_FOUND (nessuna rota con :id)",
            "GET", f"/api/users/{ONBOARD_ID}", status=404,
            code="ROUTE_NOT_FOUND", token=intruder)
        run("POST /users nascita futura → 400", "POST", "/api/users",
            body={**onboard_body, "birth_date": "2999-01-01"}, status=400,
            code="VALIDATION_ERROR", token=onboard_token)

        # ricalcolo TDEE: cambiano weight_kg e goal → stessa formula del POST
        expected2 = expected_targets(birth, "male", 180, 90, "gain", "moderate")

        run("PUT /users/me (weight_kg + goal) → 200 con TDEE ricalcolato", "PUT",
            "/api/users/me", body={"weight_kg": 90, "goal": "gain"},
            status=200, token=onboard_token, test=targets_are(expected2))
        run("PUT /users/me (solo name) → 200, target invariati", "PUT",
            "/api/users/me", body={"name": "Mario B."}, status=200,
            token=onboard_token, test=targets_are(expected2))
        run("PUT /users/me corpo vuoto → 400", "PUT", "/api/users/me", body={},
            status=400, code="BAD_REQUEST", token=onboard_token)
        run("PUT /users/me goal non ammesso → 400", "PUT", "/api/users/me",
            body={"goal": "bulk"}, status=400, code="VALIDATION_ERROR",
            token=onboard_token)

        # --- CRUD exercises (annidati: exercise -> giorno -> piano -> utente)
        ex_ids = []

        def exercise_created(payload):
            ex_ids.append(payload["id"])
            ok = (payload["workout_day_id"] == day_id and payload["name"] == "Panca piana"
                  and payload["sets"] == 3 and payload["reps"] == 8
                  and payload["order_index"] == 1)
            return ok, json.dumps(payload)[:300]

        run("POST /exercises → 201", "POST", "/api/exercises",
            body={"workout_day_id": day_id, "name": "Panca piana", "sets": 3,
                  "reps": 8, "weight_kg": 60, "rest_seconds": 90, "order_index": 1},
            status=201, test=exercise_created)

        def ex_created(payload):
            ex_ids.append(payload["id"])
            return payload["name"] == "Rematori", json.dumps(payload)[:300]

        run("POST /exercises (secondo, per il DELETE)", "POST", "/api/exercises",
            body={"workout_day_id": day_id, "name": "Rematori", "sets": 4,
                  "reps": 10, "order_index": 2},
            status=201, test=ex_created)
        panca_id, ex_id = ex_ids          # [0] resta per la cascata, [1] si elimina

        def own_ex_list(payload):
            ids = [e["id"] for e in payload]
            return ids == ex_ids, str(ids)[:300]

        run("GET /exercises senza workout_day_id → 400", "GET", "/api/exercises",
            status=400, code="VALIDATION_ERROR")
        run("GET /exercises?workout_day_id → 200 lista", "GET",
            f"/api/exercises?workout_day_id={day_id}", status=200,
            test=own_ex_list)
        run("GET /exercises/:id → 200", "GET", f"/api/exercises/{ex_id}",
            status=200, test=lambda p: (p["id"] == ex_id, str(p)[:300]))
        run("GET /exercises/:id inesistente → 404", "GET",
            f"/api/exercises/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /exercises/:id → 200", "PUT", f"/api/exercises/{ex_id}",
            body={"name": "Rematori con bilanciere", "reps": 12}, status=200,
            test=lambda p: (p["name"] == "Rematori con bilanciere" and p["reps"] == 12,
                            str(p)[:300]))
        run("PUT /exercises corpo vuoto → 400", "PUT", f"/api/exercises/{ex_id}",
            body={}, status=400, code="BAD_REQUEST")
        run("POST /exercises su giorno inesistente → 422 (P2003)", "POST",
            "/api/exercises",
            body={"workout_day_id": str(uuid.uuid4()), "name": "x", "sets": 1,
                  "reps": 1, "order_index": 0},
            status=422, code="FOREIGN_KEY_VIOLATION")
        run("POST /exercises sets non intero → 400", "POST", "/api/exercises",
            body={"workout_day_id": day_id, "name": "x", "sets": "3",
                  "reps": 1, "order_index": 0},
            status=400, code="VALIDATION_ERROR")

        # isolamento: altro utente autenticato, mai 403 solo 404
        run("Altro utente: lista esercizi del nostro giorno → 200 vuota", "GET",
            f"/api/exercises?workout_day_id={day_id}", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("Altro utente: GET esercizio altrui → 404", "GET",
            f"/api/exercises/{ex_id}", status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: PUT esercizio altrui → 404", "PUT",
            f"/api/exercises/{ex_id}", body={"name": "hacker"}, status=404,
            code="NOT_FOUND", token=intruder)
        run("Altro utente: POST esercizio sul nostro giorno → 404", "POST",
            "/api/exercises",
            body={"workout_day_id": day_id, "name": "intruso", "sets": 1,
                  "reps": 1, "order_index": 9},
            status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE esercizio altrui → 404", "DELETE",
            f"/api/exercises/{ex_id}", status=404, code="NOT_FOUND", token=intruder)

        # DELETE + P2025 (l'"Panca piana" resta, serve per la cascata)
        status, text = req("GET", f"/api/exercises?workout_day_id={day_id}")
        names = [e["name"] for e in json.loads(text)]
        record("lista esercizi: entrambi presenti prima del DELETE",
               "Panca piana" in names and "Rematori con bilanciere" in names,
               str(names)[:300])
        status, _ = req("DELETE", f"/api/exercises/{ex_id}")
        record("DELETE /exercises/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/exercises/{ex_id}")
        record("DELETE esercizio due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # --- CRUD workout_sessions (utente diretto, genitori opzionali)
        session_ids = []

        def session_created(payload):
            session_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID
                  and payload["workout_plan_id"] == plan_id
                  and payload["workout_day_id"] == day_id
                  and payload["completed_at"] is None)
            return ok, json.dumps(payload)[:300]

        run("POST /workout-sessions → 201 (user_id dal token)", "POST",
            "/api/workout-sessions",
            body={"workout_plan_id": plan_id, "workout_day_id": day_id,
                  "started_at": "2026-09-27T18:00:00Z", "notes": "panca + rematori",
                  "user_id": OTHER_ID},
            status=201, test=session_created)
        sess_id = session_ids[0]

        run("POST /workout-sessions senza started_at → 400", "POST",
            "/api/workout-sessions", body={"workout_plan_id": plan_id},
            status=400, code="VALIDATION_ERROR")
        run("POST /workout-sessions started_at non valido → 400", "POST",
            "/api/workout-sessions", body={"started_at": "ieri"},
            status=400, code="VALIDATION_ERROR")
        run("POST /workout-sessions completed_at prima di started_at → 400",
            "POST", "/api/workout-sessions",
            body={"started_at": "2026-09-27T18:00:00Z",
                  "completed_at": "2026-09-27T17:00:00Z"},
            status=400, code="VALIDATION_ERROR")
        run("POST /workout-sessions con piano inesistente → 422 (P2003)",
            "POST", "/api/workout-sessions",
            body={"workout_plan_id": str(uuid.uuid4()),
                  "started_at": "2026-09-27T18:00:00Z"},
            status=422, code="FOREIGN_KEY_VIOLATION")
        run("Altro utente: POST sessione sul nostro piano → 404", "POST",
            "/api/workout-sessions",
            body={"workout_plan_id": plan_id,
                  "started_at": "2026-09-27T18:00:00Z"},
            status=404, code="NOT_FOUND", token=intruder)

        def only_our_session(payload):
            ids = [s["id"] for s in payload]
            return ids == [sess_id], str(ids)[:300]

        run("GET /workout-sessions senza filtro → 200 lista propria", "GET",
            "/api/workout-sessions", status=200, test=only_our_session)
        run("GET /workout-sessions?workout_plan_id → 200", "GET",
            f"/api/workout-sessions?workout_plan_id={plan_id}", status=200,
            test=only_our_session)
        run("Altro utente: GET sessioni col nostro piano → 200 vuota", "GET",
            f"/api/workout-sessions?workout_plan_id={plan_id}", status=200,
            token=intruder, test=lambda p: (p == [], str(p)[:300]))
        run("GET /workout-sessions/:id → 200", "GET",
            f"/api/workout-sessions/{sess_id}", status=200,
            test=lambda p: (p["id"] == sess_id, str(p)[:300]))
        run("GET /workout-sessions/:id inesistente → 404", "GET",
            f"/api/workout-sessions/{uuid.uuid4()}", status=404,
            code="NOT_FOUND")

        def session_updated(payload):
            ok = (payload["completed_at"] is not None
                  and payload["performed_data"][0]["exercise_id"] == panca_id
                  and payload["performed_data"][0]["sets"][1] == {"reps": 8})
            return ok, json.dumps(payload)[:300]

        run("PUT /workout-sessions/:id → 200 (completed_at + performed_data)",
            "PUT", f"/api/workout-sessions/{sess_id}",
            body={"completed_at": "2026-09-27T19:10:00Z",
                  "performed_data": [{"exercise_id": panca_id,
                                      "sets": [{"reps": 10, "weight_kg": 60},
                                               {"reps": 8}]}]},
            status=200, test=session_updated)
        run("PUT /workout-sessions corpo vuoto → 400", "PUT",
            f"/api/workout-sessions/{sess_id}", body={}, status=400,
            code="BAD_REQUEST")
        run("PUT /workout-sessions performed_data malformato → 400", "PUT",
            f"/api/workout-sessions/{sess_id}",
            body={"performed_data": [{"sets": []}]},
            status=400, code="VALIDATION_ERROR")
        run("PUT /workout-sessions: started_at dopo completed_at → 400", "PUT",
            f"/api/workout-sessions/{sess_id}",
            body={"started_at": "2026-09-27T20:00:00Z"},
            status=400, code="BAD_REQUEST")
        run("Altro utente: GET sessione altrui → 404", "GET",
            f"/api/workout-sessions/{sess_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT sessione altrui → 404", "PUT",
            f"/api/workout-sessions/{sess_id}", body={"notes": "hacker"},
            status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE sessione altrui → 404", "DELETE",
            f"/api/workout-sessions/{sess_id}", status=404, code="NOT_FOUND",
            token=intruder)

        status, _ = req("DELETE", f"/api/workout-sessions/{sess_id}")
        record("DELETE /workout-sessions/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/workout-sessions/{sess_id}")
        record("DELETE sessione due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # --- DELETE (con cascata)
        status, _ = req("DELETE", f"/api/workout-days/{day_id}")
        record("DELETE /workout-days/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/workout-days/{day_id}")
        record("DELETE giorno due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # --- rotte sconosciute
        run("Rotta sconosciuta → 404 ROUTE_NOT_FOUND", "GET", "/api/nope",
            status=404, code="ROUTE_NOT_FOUND")
        run("DELETE /workout-plans inesistente → 404", "DELETE",
            f"/api/workout-plans/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        status, _ = req("DELETE", f"/api/workout-plans/{plan_id}")
        record("DELETE /workout-plans/:id → 204 (cascata days)", status == 204,
               f"atteso 204, ricevuto {status}")

        days = subprocess.run(
            ["docker", "exec", "supabase_db_FitTrack", "psql", "-U", "postgres",
             "-d", "postgres", "-tAc",
             f"select count(*) from workout_days where workout_plan_id='{plan_id}'"],
            capture_output=True, text=True, check=True).stdout.strip()
        record("cascata: nessun giorno residuo del piano", days == "0",
               f"righe workout_days residue: {days}")

        leftover_ex = subprocess.run(
            ["docker", "exec", "supabase_db_FitTrack", "psql", "-U", "postgres",
             "-d", "postgres", "-tAc",
             f"select count(*) from exercises where workout_day_id='{day_id}'"],
            capture_output=True, text=True, check=True).stdout.strip()
        record("cascata: nessun esercizio residuo del giorno", leftover_ex == "0",
               f"righe exercises residue: {leftover_ex}")
    finally:
        psql(f"DELETE FROM users WHERE id IN ('{USER_ID}','{ONBOARD_ID}');")

    failed = 0
    for name, ok, info, detail in results:
        print(f"{'✅' if ok else '❌'} {name}" + (f"  [{info}]" if not ok else "")
              + (f"\n     {detail}" if detail and not ok else ""))
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} test superati")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
