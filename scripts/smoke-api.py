"""Smoke test HTTP per il backend FitTrack (workout_plans + workout_days).

Richiede il Supabase locale attivo (npx supabase start) e il server avviato:
  PORT=3000 npm start

Genera token JWT HS256 firmati con SUPABASE_JWT_SECRET (da .env o dall'env),
così si esercita il percorso reale di verifica: nessun bypass d'auth.

Uso: python3 scripts/smoke-api.py   (API_BASE per cambiare la base URL)
"""
import base64
import hashlib
import hmac
import json
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
               sign_with=None, with_sub=True) -> str:
    """JWT HS256 firmato con hmac: identico nella forma a quelli di Supabase Auth."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"iss": "supabase", "role": "authenticated",
               "iat": now, "exp": now + expires_in}
    if with_sub:
        payload["sub"] = sub
    signing_input = (
        f"{b64url(json.dumps(header, separators=(',', ':')).encode())}."
        f"{b64url(json.dumps(payload, separators=(',', ':')).encode())}"
    )
    key = (sign_with or secret).encode()
    sig = hmac.new(key, signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(sig)}"


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
    TOKEN = make_token(load_secret())

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
        intruder = make_token(load_secret(), sub=OTHER_ID)

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
    finally:
        psql(f"DELETE FROM users WHERE id='{USER_ID}';")

    failed = 0
    for name, ok, info, detail in results:
        print(f"{'✅' if ok else '❌'} {name}" + (f"  [{info}]" if not ok else "")
              + (f"\n     {detail}" if detail and not ok else ""))
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} test superati")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
