"""Smoke test HTTP per il backend FitTrack (profilo users + workout_plans
+ workout_days).

Richiede il Supabase locale attivo (npx supabase start) e il server avviato:
  PORT=3000 npm start

Genera token JWT HS256 firmati con SUPABASE_JWT_SECRET (da .env o dall'env),
così si esercita il percorso reale di verifica: nessun bypass d'auth. Copre
anche i percorsi ES256: alg fuori whitelist, kid ignoto (refresh del JWKS) e
un token reale emesso da Supabase Auth e verificato via JWKS.

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

def load_env(name: str, default: str | None = None) -> str | None:
    """Legge una variabile dall'env o dal .env del progetto (mai fatal)."""
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return default


def load_secret() -> str:
    secret = load_env("SUPABASE_JWT_SECRET")
    if not secret:
        sys.exit("SUPABASE_JWT_SECRET assente: imposta .env o la variabile d'ambiente")
    return secret


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


def make_es256_token() -> str:
    """JWT con header ES256 e kid ignoto: stessa forma dei token moderni di
    Supabase Auth, ma nessuna chiave del JWKS lo conosce → deve finire in 401
    (e copre il refresh del JWKS)."""
    now = int(time.time())
    header = {"alg": "ES256", "kid": "kid-non-del-nostro-supabase", "typ": "JWT"}
    payload = {"iss": "supabase", "role": "authenticated",
               "iat": now, "exp": now + 3600, "sub": USER_ID}
    signing_input = (
        f"{b64url(json.dumps(header, separators=(',', ':')).encode())}."
        f"{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    )
    return f"{signing_input}.{b64url(os.urandom(64))}"


def make_alg_none_token() -> str:
    """Header alg=none: l'algoritmo non è nella whitelist, va scartato."""
    now = int(time.time())
    header = {"alg": "none", "typ": "JWT"}
    payload = {"iss": "supabase", "role": "authenticated",
               "iat": now, "exp": now + 3600, "sub": USER_ID}
    return (
        f"{b64url(json.dumps(header, separators=(',', ':')).encode())}."
        f"{b64url(json.dumps(payload, separators=(',', ':')).encode())}."
    )


def supa_access_token() -> str | None:
    """Signup reale su Supabase Auth: restituisce l'access_token ES256 emesso
    (None se l'auth locale non risponde o le env Expo mancano)."""
    url = load_env("EXPO_PUBLIC_SUPABASE_URL")
    anon = load_env("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not anon:
        return None
    body = json.dumps({
        "email": f"smoke-{int(time.time() * 1000)}@example.com",
        "password": "password-smoke-1",
        "data": {"name": "Smoke"},
    }).encode()
    request = urllib.request.Request(
        f"{url}/auth/v1/signup", data=body, method="POST",
        headers={"Content-Type": "application/json", "apikey": anon,
                 "Authorization": f"Bearer {anon}"})
    try:
        with urllib.request.urlopen(request) as resp:
            return json.loads(resp.read().decode()).get("access_token")
    except (urllib.error.HTTPError, urllib.error.URLError, ValueError):
        return None


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
    """Seed/cleanup SQL sul DB locale (container Docker della Supabase CLI).
    Con `SMOKE_DB_URL` (es. pooler cloud) la stessa suite gira contro un
    backend remoto: la connessione passa a quella indicata dall'env."""
    target = os.environ.get("SMOKE_DB_URL")
    cmd = ["docker", "exec", "supabase_db_FitTrack", "psql"]
    cmd += [target] if target else ["-U", "postgres", "-d", "postgres"]
    cmd += ["-v", "ON_ERROR_STOP=1", "-c", sql]
    subprocess.run(cmd, check=True, capture_output=True, text=True)


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
        run("Token alg=none → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED", token=make_alg_none_token())
        run("Token ES256 con kid ignoto → 401", "GET", "/api/workout-plans",
            status=401, code="UNAUTHENTICATED", token=make_es256_token())
        # Il percorso usato dall'app: token reale di Supabase Auth (ES256)
        # verificato contro il JWKS del progetto.
        es256_token = supa_access_token()
        if es256_token:
            run("Token ES256 reale (verifica via JWKS) → 200 lista", "GET",
                "/api/workout-plans", status=200, token=es256_token)
        else:
            record("Token ES256 reale (verifica via JWKS) → 200 lista", False,
                   "atteso 200, signup Supabase Auth non riuscito", "")

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

        # dettaglio annidato: il GET del piano deve riportare giorni ed
        # esercizi (già ordinati) per la vista settimanale del client
        def plan_nested(payload):
            days = payload.get("workout_days") or []
            if [d["id"] for d in days] != [day_id]:
                return False, f"giorni attesi {[day_id]}, ricevuti {[d['id'] for d in days]}"
            exercises = days[0].get("exercises") or []
            ids = [e["id"] for e in exercises]
            orders = [e["order_index"] for e in exercises]
            ok = payload["id"] == plan_id and ids == ex_ids and orders == [1, 2]
            return ok, f"esercizi {ids}, ordini {orders}"

        run("GET /workout-plans/:id → 200 con giorni/esercizi annidati", "GET",
            f"/api/workout-plans/{plan_id}", status=200, test=plan_nested)

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

        # --- CRUD diet_plans (stesso pattern di workout_plans)
        diet_ids = []

        def diet_created(payload):
            diet_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID and payload["source"] == "manual"
                  and payload["is_active"] is True
                  and payload["daily_calorie_target"] == 2200
                  and payload["protein_g"] == 160)
            return ok, json.dumps(payload)[:300]

        run("POST /diet-plans → 201 (user_id dal token)", "POST",
            "/api/diet-plans",
            body={"user_id": OTHER_ID, "name": "Dieta forza", "source": "manual",
                  "daily_calorie_target": 2200, "protein_g": 160,
                  "carbs_g": 220, "fat_g": 70},
            status=201, test=diet_created)
        diet_id = diet_ids[0]

        def diet_created_min(payload):
            diet_ids.append(payload["id"])
            # is_active di default true: campo non inviato nel body
            return payload["is_active"] is True, json.dumps(payload)[:300]

        run("POST /diet-plans minimo → 201 (is_active di default)", "POST",
            "/api/diet-plans", body={"name": "Dieta jet", "source": "ai"},
            status=201, test=diet_created_min)
        diet_delete_id = diet_ids[1]

        run("POST /diet-plans source non ammesso → 400", "POST",
            "/api/diet-plans", body={"name": "x", "source": "magic"},
            status=400, code="VALIDATION_ERROR")
        run("POST /diet-plans corpo incompleto → 400", "POST",
            "/api/diet-plans", body={"name": "solo nome"},
            status=400, code="VALIDATION_ERROR")

        def two_diets(payload):
            ids = [d["id"] for d in payload]
            return len(ids) == 2 and diet_id in ids, str(ids)[:300]

        run("GET /diet-plans → 200 lista propria", "GET", "/api/diet-plans",
            status=200, test=two_diets)
        run("GET /diet-plans/:id → 200", "GET", f"/api/diet-plans/{diet_id}",
            status=200, test=lambda p: (p["id"] == diet_id, str(p)[:300]))
        run("GET /diet-plans/:id inesistente → 404", "GET",
            f"/api/diet-plans/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /diet-plans/:id → 200", "PUT", f"/api/diet-plans/{diet_id}",
            body={"name": "Dieta forza v2", "source": "ai", "is_active": False},
            status=200,
            test=lambda p: (p["name"] == "Dieta forza v2" and p["source"] == "ai"
                            and p["is_active"] is False, str(p)[:300]))
        run("PUT /diet-plans corpo vuoto → 400", "PUT",
            f"/api/diet-plans/{diet_id}", body={}, status=400,
            code="BAD_REQUEST")
        run("PUT /diet-plans/:id inesistente → 404 (P2025)", "PUT",
            f"/api/diet-plans/{uuid.uuid4()}", body={"name": "x"},
            status=404, code="NOT_FOUND")
        run("Altro utente: lista diete → 200 vuota", "GET", "/api/diet-plans",
            status=200, token=intruder, test=lambda p: (p == [], str(p)[:300]))
        run("Altro utente: GET dieta altrui → 404", "GET",
            f"/api/diet-plans/{diet_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT dieta altrui → 404", "PUT",
            f"/api/diet-plans/{diet_id}", body={"name": "hacker"},
            status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE dieta altrui → 404", "DELETE",
            f"/api/diet-plans/{diet_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sulla seconda dieta (la prima serve a /meals)
        status, _ = req("DELETE", f"/api/diet-plans/{diet_delete_id}")
        record("DELETE /diet-plans/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/diet-plans/{diet_delete_id}")
        record("DELETE dieta due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # --- CRUD meals (filtro data obbligatorio, diet_plan opzionale)
        meal_ids = []
        lunch_date = "2026-09-27"

        def meal_created(payload):
            meal_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID
                  and payload["diet_plan_id"] == diet_id
                  and payload["meal_type"] == "lunch"
                  and payload["date"][:10] == lunch_date
                  and payload["name"] == "Riso e pollo")
            return ok, json.dumps(payload)[:300]

        run("POST /meals → 201 (user_id dal token)", "POST", "/api/meals",
            body={"diet_plan_id": diet_id, "meal_type": "lunch",
                  "date": lunch_date, "name": "Riso e pollo",
                  "user_id": OTHER_ID},
            status=201, test=meal_created)
        meal_id = meal_ids[0]

        def meal_created_min(payload):
            meal_ids.append(payload["id"])
            ok = (payload["diet_plan_id"] is None and payload["name"] is None
                  and payload["meal_type"] == "snack")
            return ok, json.dumps(payload)[:300]

        run("POST /meals minimo → 201 (pasto libero, senza piano)", "POST",
            "/api/meals", body={"meal_type": "snack", "date": lunch_date},
            status=201, test=meal_created_min)
        snack_id = meal_ids[1]

        run("POST /meals meal_type non ammesso → 400", "POST", "/api/meals",
            body={"meal_type": "brunch", "date": lunch_date},
            status=400, code="VALIDATION_ERROR")
        run("POST /meals data non valida → 400", "POST", "/api/meals",
            body={"meal_type": "lunch", "date": "27-09-2026"},
            status=400, code="VALIDATION_ERROR")
        run("POST /meals con dieta inesistente → 422 (P2003)", "POST",
            "/api/meals",
            body={"meal_type": "lunch", "date": lunch_date,
                  "diet_plan_id": str(uuid.uuid4())},
            status=422, code="FOREIGN_KEY_VIOLATION")
        run("Altro utente: POST meal sulla nostra dieta → 404", "POST",
            "/api/meals",
            body={"meal_type": "lunch", "date": lunch_date,
                  "diet_plan_id": diet_id},
            status=404, code="NOT_FOUND", token=intruder)

        def two_meals(payload):
            ids = [m["id"] for m in payload]
            return ids == meal_ids, str(ids)[:300]

        run("GET /meals senza filtro → 400", "GET", "/api/meals",
            status=400, code="VALIDATION_ERROR")
        run("GET /meals?date → 200 (i due pasti del giorno)", "GET",
            f"/api/meals?date={lunch_date}", status=200, test=two_meals)
        run("GET /meals?from&to → 200 (estremi inclusi)", "GET",
            f"/api/meals?from={lunch_date}&to={lunch_date}", status=200,
            test=two_meals)
        run("GET /meals?from>to → 400", "GET",
            "/api/meals?from=2026-09-28&to=2026-09-27", status=400,
            code="VALIDATION_ERROR")
        run("GET /meals?date altro giorno → 200 vuota", "GET",
            "/api/meals?date=2026-01-01", status=200,
            test=lambda p: (p == [], str(p)[:300]))
        run("Altro utente: GET meals del nostro giorno → 200 vuota", "GET",
            f"/api/meals?date={lunch_date}", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("GET /meals/:id → 200", "GET", f"/api/meals/{meal_id}",
            status=200, test=lambda p: (p["id"] == meal_id, str(p)[:300]))
        run("GET /meals/:id inesistente → 404", "GET",
            f"/api/meals/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /meals/:id → 200", "PUT", f"/api/meals/{meal_id}",
            body={"name": "Riso e pollo integrali", "meal_type": "dinner"},
            status=200,
            test=lambda p: (p["name"] == "Riso e pollo integrali"
                            and p["meal_type"] == "dinner", str(p)[:300]))
        run("PUT /meals corpo vuoto → 400", "PUT", f"/api/meals/{meal_id}",
            body={}, status=400, code="BAD_REQUEST")
        run("PUT /meals/:id inesistente → 404 (P2025)", "PUT",
            f"/api/meals/{uuid.uuid4()}", body={"name": "x"},
            status=404, code="NOT_FOUND")
        run("Altro utente: GET meal altrui → 404", "GET",
            f"/api/meals/{meal_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT meal altrui → 404", "PUT",
            f"/api/meals/{meal_id}", body={"name": "hacker"}, status=404,
            code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE meal altrui → 404", "DELETE",
            f"/api/meals/{meal_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sullo snack (il pranzo serve a /food-items)
        status, _ = req("DELETE", f"/api/meals/{snack_id}")
        record("DELETE /meals/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/meals/{snack_id}")
        record("DELETE meal due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # --- CRUD food_items (annidati sotto meals)
        food_ids = []

        def food_created(payload):
            food_ids.append(payload["id"])
            ok = (payload["meal_id"] == meal_id and payload["name"] == "Riso basmati"
                  and payload["calories"] == 350 and payload["source"] == "manual"
                  and payload["protein_g"] == 7.5 and payload["quantity_g"] == 160)
            return ok, json.dumps(payload)[:300]

        run("POST /food-items → 201", "POST", "/api/food-items",
            body={"meal_id": meal_id, "name": "Riso basmati", "quantity_g": 160,
                  "calories": 350, "protein_g": 7.5, "carbs_g": 78, "fat_g": 0.8,
                  "source": "manual"},
            status=201, test=food_created)
        food_id = food_ids[0]

        def food_created_2(payload):
            food_ids.append(payload["id"])
            ok = (payload["source"] == "barcode"
                  and payload["barcode"] == "8001234567890")
            return ok, json.dumps(payload)[:300]

        run("POST /food-items (secondo, per il DELETE)", "POST",
            "/api/food-items",
            body={"meal_id": meal_id, "name": "Petto di pollo", "calories": 210,
                  "protein_g": 35, "carbs_g": 0, "fat_g": 3, "source": "barcode",
                  "barcode": "8001234567890"},
            status=201, test=food_created_2)
        food_delete_id = food_ids[1]

        run("POST /food-items source non ammesso → 400", "POST",
            "/api/food-items",
            body={"meal_id": meal_id, "name": "x", "calories": 1, "protein_g": 0,
                  "carbs_g": 0, "fat_g": 0, "source": "telepatia"},
            status=400, code="VALIDATION_ERROR")
        run("POST /food-items corpo incompleto → 400", "POST",
            "/api/food-items", body={"meal_id": meal_id, "name": "x"},
            status=400, code="VALIDATION_ERROR")
        run("POST /food-items su pasto inesistente → 422 (P2003)", "POST",
            "/api/food-items",
            body={"meal_id": str(uuid.uuid4()), "name": "x", "calories": 1,
                  "protein_g": 0, "carbs_g": 0, "fat_g": 0, "source": "manual"},
            status=422, code="FOREIGN_KEY_VIOLATION")
        run("Altro utente: POST food-item sul nostro pasto → 404", "POST",
            "/api/food-items",
            body={"meal_id": meal_id, "name": "intruso", "calories": 1,
                  "protein_g": 0, "carbs_g": 0, "fat_g": 0, "source": "manual"},
            status=404, code="NOT_FOUND", token=intruder)

        def two_foods(payload):
            ids = [f["id"] for f in payload]
            return ids == food_ids, str(ids)[:300]

        run("GET /food-items senza meal_id → 400", "GET", "/api/food-items",
            status=400, code="VALIDATION_ERROR")
        run("GET /food-items?meal_id → 200 lista", "GET",
            f"/api/food-items?meal_id={meal_id}", status=200, test=two_foods)
        run("Altro utente: lista alimenti del nostro pasto → 200 vuota", "GET",
            f"/api/food-items?meal_id={meal_id}", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("GET /food-items/:id → 200", "GET", f"/api/food-items/{food_id}",
            status=200, test=lambda p: (p["id"] == food_id, str(p)[:300]))
        run("GET /food-items/:id inesistente → 404", "GET",
            f"/api/food-items/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /food-items/:id → 200", "PUT", f"/api/food-items/{food_id}",
            body={"name": "Riso basmati integrale", "calories": 360},
            status=200,
            test=lambda p: (p["name"] == "Riso basmati integrale"
                            and p["calories"] == 360, str(p)[:300]))
        run("PUT /food-items corpo vuoto → 400", "PUT",
            f"/api/food-items/{food_id}", body={}, status=400,
            code="BAD_REQUEST")
        run("PUT /food-items/:id inesistente → 404 (P2025)", "PUT",
            f"/api/food-items/{uuid.uuid4()}", body={"name": "x"},
            status=404, code="NOT_FOUND")
        run("Altro utente: GET food-item altrui → 404", "GET",
            f"/api/food-items/{food_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT food-item altrui → 404", "PUT",
            f"/api/food-items/{food_id}", body={"name": "hacker"}, status=404,
            code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE food-item altrui → 404", "DELETE",
            f"/api/food-items/{food_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sul secondo alimento
        status, _ = req("DELETE", f"/api/food-items/{food_delete_id}")
        record("DELETE /food-items/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/food-items/{food_delete_id}")
        record("DELETE food-item due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])

        # il pasto ha ancora "Riso basmati": DELETE del pasto -> cascata
        status, _ = req("DELETE", f"/api/meals/{meal_id}")
        record("DELETE /meals con alimenti dentro → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        leftover_food = subprocess.run(
            ["docker", "exec", "supabase_db_FitTrack", "psql", "-U", "postgres",
             "-d", "postgres", "-tAc",
             f"select count(*) from food_items where meal_id='{meal_id}'"],
            capture_output=True, text=True, check=True).stdout.strip()
        record("cascata: nessun food_item residuo del pasto",
               leftover_food == "0", f"righe food_items residue: {leftover_food}")

        # --- CRUD body_measurements (almeno un campo numerico, range opzionale)
        bm_ids = []

        def bm_created(payload):
            bm_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID and payload["date"][:10] == "2026-09-26"
                  and payload["weight_kg"] == 80.5 and payload["waist_cm"] == 84
                  and payload["chest_cm"] == 100 and payload["hips_cm"] == 98)
            return ok, json.dumps(payload)[:300]

        run("POST /body-measurements → 201 (user_id dal token)", "POST",
            "/api/body-measurements",
            body={"date": "2026-09-26", "weight_kg": 80.5, "waist_cm": 84,
                  "hips_cm": 98, "chest_cm": 100, "arms_cm": 36,
                  "user_id": OTHER_ID},
            status=201, test=bm_created)
        bm_id = bm_ids[0]

        def bm_created_min(payload):
            bm_ids.append(payload["id"])
            ok = payload["date"][:10] == "2026-09-20" and payload["weight_kg"] == 81
            return ok, json.dumps(payload)[:300]

        run("POST /body-measurements minimo → 201 (un solo campo)", "POST",
            "/api/body-measurements",
            body={"date": "2026-09-20", "weight_kg": 81},
            status=201, test=bm_created_min)
        bm_delete_id = bm_ids[1]

        run("POST /body-measurements senza campi numerici → 400", "POST",
            "/api/body-measurements", body={"date": "2026-09-26"},
            status=400, code="VALIDATION_ERROR")
        run("POST /body-measurements peso fuori range → 400", "POST",
            "/api/body-measurements",
            body={"date": "2026-09-26", "weight_kg": 999},
            status=400, code="VALIDATION_ERROR")
        run("POST /body-measurements data non valida → 400", "POST",
            "/api/body-measurements",
            body={"date": "26/09/2026", "weight_kg": 80},
            status=400, code="VALIDATION_ERROR")

        def only_first_bm(payload):
            ids = [m["id"] for m in payload]
            return ids == [bm_id], str(ids)[:300]

        def both_bm(payload):
            ids = [m["id"] for m in payload]
            return ids == bm_ids, str(ids)[:300]

        run("GET /body-measurements senza filtro → 200 lista propria", "GET",
            "/api/body-measurements", status=200, test=both_bm)
        run("GET /body-measurements?from&to → 200 (un giorno)", "GET",
            "/api/body-measurements?from=2026-09-25&to=2026-09-27",
            status=200, test=only_first_bm)
        run("GET /body-measurements?from>to → 400", "GET",
            "/api/body-measurements?from=2026-09-27&to=2026-09-25",
            status=400, code="VALIDATION_ERROR")
        run("GET /body-measurements range vuoto → 200 []", "GET",
            "/api/body-measurements?from=2026-09-27&to=2026-09-28",
            status=200, test=lambda p: (p == [], str(p)[:300]))
        run("Altro utente: lista misurazioni → 200 vuota", "GET",
            "/api/body-measurements", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("GET /body-measurements/:id → 200", "GET",
            f"/api/body-measurements/{bm_id}", status=200,
            test=lambda p: (p["id"] == bm_id, str(p)[:300]))
        run("GET /body-measurements/:id inesistente → 404", "GET",
            f"/api/body-measurements/{uuid.uuid4()}", status=404,
            code="NOT_FOUND")
        run("PUT /body-measurements/:id → 200", "PUT",
            f"/api/body-measurements/{bm_id}",
            body={"waist_cm": 83.5, "weight_kg": 79.8}, status=200,
            test=lambda p: (p["waist_cm"] == 83.5 and p["weight_kg"] == 79.8
                            and p["chest_cm"] == 100, str(p)[:300]))
        run("PUT /body-measurements corpo vuoto → 400", "PUT",
            f"/api/body-measurements/{bm_id}", body={}, status=400,
            code="BAD_REQUEST")
        run("PUT /body-measurements/:id inesistente → 404 (P2025)", "PUT",
            f"/api/body-measurements/{uuid.uuid4()}", body={"weight_kg": 80},
            status=404, code="NOT_FOUND")
        run("Altro utente: GET misurazione altrui → 404", "GET",
            f"/api/body-measurements/{bm_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT misurazione altrui → 404", "PUT",
            f"/api/body-measurements/{bm_id}", body={"weight_kg": 55},
            status=404, code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE misurazione altrui → 404", "DELETE",
            f"/api/body-measurements/{bm_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sulla seconda misurazione
        status, _ = req("DELETE", f"/api/body-measurements/{bm_delete_id}")
        record("DELETE /body-measurements/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/body-measurements/{bm_delete_id}")
        record("DELETE misurazione due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])
        run("GET /body-measurements dopo DELETE → 200 con una riga", "GET",
            "/api/body-measurements", status=200, test=only_first_bm)

        # --- progress_photos: lista + POST + DELETE, nessun PUT
        pp_ids = []

        def pp_created(payload):
            pp_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID and payload["date"][:10] == "2026-09-01"
                  and payload["photo_url"] == "https://cdn.test/fronte-1.jpg")
            return ok, json.dumps(payload)[:300]

        run("POST /progress-photos → 201 (user_id dal token)", "POST",
            "/api/progress-photos",
            body={"date": "2026-09-01",
                  "photo_url": "https://cdn.test/fronte-1.jpg",
                  "user_id": OTHER_ID},
            status=201, test=pp_created)
        pp_id = pp_ids[0]

        def pp_created_2(payload):
            pp_ids.append(payload["id"])
            return payload["date"][:10] == "2026-09-15", json.dumps(payload)[:300]

        run("POST /progress-photos (seconda, per il DELETE)", "POST",
            "/api/progress-photos",
            body={"date": "2026-09-15", "photo_url": "/storage/fittrack/p2.jpg"},
            status=201, test=pp_created_2)
        pp_delete_id = pp_ids[1]

        run("POST /progress-photos senza photo_url → 400", "POST",
            "/api/progress-photos", body={"date": "2026-09-01"},
            status=400, code="VALIDATION_ERROR")
        run("POST /progress-photos photo_url vuota → 400", "POST",
            "/api/progress-photos",
            body={"date": "2026-09-01", "photo_url": "   "},
            status=400, code="VALIDATION_ERROR")
        run("POST /progress-photos data non valida → 400", "POST",
            "/api/progress-photos",
            body={"date": "ieri", "photo_url": "https://cdn.test/x.jpg"},
            status=400, code="VALIDATION_ERROR")

        def two_photos(payload):
            ids = [p["id"] for p in payload]
            # ordinamento per data desc: 15/09 prima del 01/09
            return ids == [pp_delete_id, pp_id], str(ids)[:300]

        def only_first_photo(payload):
            ids = [p["id"] for p in payload]
            return ids == [pp_id], str(ids)[:300]

        run("GET /progress-photos senza filtro → 200 lista propria", "GET",
            "/api/progress-photos", status=200, test=two_photos)
        run("GET /progress-photos?from&to → 200", "GET",
            "/api/progress-photos?from=2026-09-10&to=2026-09-20", status=200,
            test=lambda p: ([x["id"] for x in p] == [pp_delete_id], str(p)[:300]))
        run("GET /progress-photos?from>to → 400", "GET",
            "/api/progress-photos?from=2026-09-20&to=2026-09-10", status=400,
            code="VALIDATION_ERROR")
        run("Altro utente: lista foto → 200 vuota", "GET",
            "/api/progress-photos", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("GET /progress-photos/:id → 404 ROUTE_NOT_FOUND (nessuna rota)",
            "GET", f"/api/progress-photos/{pp_id}", status=404,
            code="ROUTE_NOT_FOUND")
        run("PUT /progress-photos/:id → 404 ROUTE_NOT_FOUND (nessun PUT)",
            "PUT", f"/api/progress-photos/{pp_id}",
            body={"photo_url": "https://cdn.test/h.jpg"}, status=404,
            code="ROUTE_NOT_FOUND")
        run("Altro utente: DELETE foto altrui → 404", "DELETE",
            f"/api/progress-photos/{pp_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sulla seconda foto
        status, _ = req("DELETE", f"/api/progress-photos/{pp_delete_id}")
        record("DELETE /progress-photos/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/progress-photos/{pp_delete_id}")
        record("DELETE foto due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])
        run("GET /progress-photos dopo DELETE → 200 con una foto", "GET",
            "/api/progress-photos", status=200, test=only_first_photo)

        # --- CRUD reminders (time "HH:MM", days_of_week interi 0-6)
        rem_ids = []

        def rem_created(payload):
            rem_ids.append(payload["id"])
            ok = (payload["user_id"] == USER_ID and payload["type"] == "workout"
                  and payload["time"] == "07:30"
                  and payload["days_of_week"] == [1, 3, 5]
                  and payload["is_active"] is True
                  and payload["message"] == "Allenamento")
            return ok, json.dumps(payload)[:300]

        run("POST /reminders → 201 (user_id dal token)", "POST",
            "/api/reminders",
            body={"type": "workout", "time": "07:30", "days_of_week": [1, 3, 5],
                  "message": "Allenamento", "user_id": OTHER_ID},
            status=201, test=rem_created)
        rem_id = rem_ids[0]

        def rem_created_2(payload):
            rem_ids.append(payload["id"])
            ok = (payload["is_active"] is True and payload["message"] is None
                  and payload["days_of_week"] == [0, 6])
            return ok, json.dumps(payload)[:300]

        run("POST /reminders minimo → 201 (is_active di default)", "POST",
            "/api/reminders",
            body={"type": "meal", "time": "12:30", "days_of_week": [0, 6]},
            status=201, test=rem_created_2)
        rem_delete_id = rem_ids[1]

        run("POST /reminders time senza zero iniziale → 400", "POST",
            "/api/reminders",
            body={"type": "custom", "time": "7:30", "days_of_week": [1]},
            status=400, code="VALIDATION_ERROR")
        run("POST /reminders time fuori range → 400", "POST",
            "/api/reminders",
            body={"type": "custom", "time": "25:00", "days_of_week": [1]},
            status=400, code="VALIDATION_ERROR")
        run("POST /reminders days vuoto → 400", "POST", "/api/reminders",
            body={"type": "custom", "time": "08:00", "days_of_week": []},
            status=400, code="VALIDATION_ERROR")
        run("POST /reminders day fuori 0-6 → 400", "POST", "/api/reminders",
            body={"type": "custom", "time": "08:00", "days_of_week": [7]},
            status=400, code="VALIDATION_ERROR")
        run("POST /reminders corpo incompleto → 400", "POST", "/api/reminders",
            body={"type": "custom"}, status=400, code="VALIDATION_ERROR")

        def two_reminders(payload):
            ids = [r["id"] for r in payload]
            # ordinamento per time: 07:30 prima di 12:30
            return ids == rem_ids, str(ids)[:300]

        run("GET /reminders → 200 lista propria", "GET", "/api/reminders",
            status=200, test=two_reminders)
        run("Altro utente: lista promemoria → 200 vuota", "GET",
            "/api/reminders", status=200, token=intruder,
            test=lambda p: (p == [], str(p)[:300]))
        run("GET /reminders/:id → 200", "GET", f"/api/reminders/{rem_id}",
            status=200, test=lambda p: (p["id"] == rem_id, str(p)[:300]))
        run("GET /reminders/:id inesistente → 404", "GET",
            f"/api/reminders/{uuid.uuid4()}", status=404, code="NOT_FOUND")
        run("PUT /reminders/:id → 200", "PUT", f"/api/reminders/{rem_id}",
            body={"time": "06:45", "is_active": False, "message": "Sveglia"},
            status=200,
            test=lambda p: (p["time"] == "06:45" and p["is_active"] is False
                            and p["message"] == "Sveglia", str(p)[:300]))
        run("PUT /reminders corpo vuoto → 400", "PUT",
            f"/api/reminders/{rem_id}", body={}, status=400, code="BAD_REQUEST")
        run("PUT /reminders time invalido → 400", "PUT",
            f"/api/reminders/{rem_id}", body={"time": "9:5"},
            status=400, code="VALIDATION_ERROR")
        run("PUT /reminders/:id inesistente → 404 (P2025)", "PUT",
            f"/api/reminders/{uuid.uuid4()}", body={"time": "08:00"},
            status=404, code="NOT_FOUND")
        run("Altro utente: GET promemoria altrui → 404", "GET",
            f"/api/reminders/{rem_id}", status=404, code="NOT_FOUND",
            token=intruder)
        run("Altro utente: PUT promemoria altrui → 404", "PUT",
            f"/api/reminders/{rem_id}", body={"time": "00:01"}, status=404,
            code="NOT_FOUND", token=intruder)
        run("Altro utente: DELETE promemoria altrui → 404", "DELETE",
            f"/api/reminders/{rem_id}", status=404, code="NOT_FOUND",
            token=intruder)

        # DELETE + P2025 sul secondo promemoria
        status, _ = req("DELETE", f"/api/reminders/{rem_delete_id}")
        record("DELETE /reminders/:id → 204", status == 204,
               f"atteso 204, ricevuto {status}")
        status, text = req("DELETE", f"/api/reminders/{rem_delete_id}")
        record("DELETE promemoria due volte → 404 (P2025)", status == 404,
               f"atteso 404, ricevuto {status}", text[:200])
        run("GET /reminders dopo DELETE → 200 con uno", "GET",
            "/api/reminders", status=200,
            test=lambda p: ([r["id"] for r in p] == [rem_id], str(p)[:300]))

        # --- ai_usage_log: solo POST + conteggio di oggi (limite piano free)
        run("GET /ai-usage-log/today → 200 count 0 (nessun uso)", "GET",
            "/api/ai-usage-log/today?feature=photo_meal", status=200,
            test=lambda p: (p == {"feature": "photo_meal", "count": 0},
                            json.dumps(p)))

        # uso di giorni scorsi: fuori dalla giornata odierna, non deve contare
        psql(f"INSERT INTO ai_usage_log (id, user_id, feature, used_at) "
             f"VALUES ('{uuid.uuid4()}','{USER_ID}','photo_meal',"
             f" now() - interval '2 days');")
        run("GET /ai-usage-log/today ignora gli usi passati → count 0", "GET",
            "/api/ai-usage-log/today?feature=photo_meal", status=200,
            test=lambda p: (p["count"] == 0, json.dumps(p)))

        def usage_logged(payload):
            ok = (payload["user_id"] == USER_ID
                  and payload["feature"] == "photo_meal"
                  and payload["used_at"] is not None)
            return ok, json.dumps(payload)[:300]

        run("POST /ai-usage-log → 201 (user_id dal token)", "POST",
            "/api/ai-usage-log", body={"feature": "photo_meal"},
            status=201, test=usage_logged)
        run("GET /ai-usage-log/today → count 1", "GET",
            "/api/ai-usage-log/today?feature=photo_meal", status=200,
            test=lambda p: (p["count"] == 1, json.dumps(p)))

        run("POST /ai-usage-log (secondo uso) → 201", "POST",
            "/api/ai-usage-log",
            body={"feature": "photo_meal", "user_id": OTHER_ID},
            status=201, test=lambda p: (p["user_id"] == USER_ID, str(p)[:300]))
        run("GET /ai-usage-log/today → count 2 (limite free raggiunto)", "GET",
            "/api/ai-usage-log/today?feature=photo_meal", status=200,
            test=lambda p: (p["count"] == 2, json.dumps(p)))
        run("GET /ai-usage-log/today altra feature → count 0", "GET",
            "/api/ai-usage-log/today?feature=workout_generation", status=200,
            test=lambda p: (p["count"] == 0, json.dumps(p)))
        run("Altro utente: GET today → count 0 (scoping)", "GET",
            "/api/ai-usage-log/today?feature=photo_meal", status=200,
            token=intruder, test=lambda p: (p["count"] == 0, json.dumps(p)))
        run("POST /ai-usage-log feature non ammessa → 400", "POST",
            "/api/ai-usage-log", body={"feature": "mago"},
            status=400, code="VALIDATION_ERROR")
        run("GET /ai-usage-log/today senza feature → 400", "GET",
            "/api/ai-usage-log/today", status=400, code="VALIDATION_ERROR")
        run("GET /ai-usage-log (senza /today) → 404 ROUTE_NOT_FOUND", "GET",
            "/api/ai-usage-log", status=404, code="ROUTE_NOT_FOUND")
        run("PUT /ai-usage-log/:id → 404 ROUTE_NOT_FOUND (nessun PUT)", "PUT",
            f"/api/ai-usage-log/{uuid.uuid4()}", body={"feature": "photo_meal"},
            status=404, code="ROUTE_NOT_FOUND")
        run("DELETE /ai-usage-log/:id → 404 ROUTE_NOT_FOUND", "DELETE",
            f"/api/ai-usage-log/{uuid.uuid4()}", status=404,
            code="ROUTE_NOT_FOUND")

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
