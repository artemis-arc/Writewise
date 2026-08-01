# WriteWise — Setup Guide

Everything you need to get the database, backend, and frontend running locally. Follow this in order the first time; day-to-day, jump to [Day-to-day workflow](#day-to-day-workflow).

## Prerequisites

Install these before you start:

| Tool | Version used in dev | Check with |
|---|---|---|
| Python | 3.11+ (3.14 tested) | `python --version` |
| Node.js | 20+ (22 tested) | `node --version` |
| Docker Desktop | any recent version | `docker --version` |
| Git | any | `git --version` |

Docker Desktop must be **running** (not just installed) before any `docker compose` command below.

---

## 1. Database (Postgres, via Docker)

The project uses PostgreSQL. You don't install Postgres yourself — a `docker-compose.yml` at the repo root spins up a container for you.

```bash
# from the repo root (the folder with docker-compose.yml)
docker compose up -d postgres
```

This starts a Postgres 16 container named `writewise-postgres-1`, with a persistent Docker volume (`writewise_pgdata`) so your data survives restarts.

**Connection details** (already wired into `backend/.env.example` — see step 2):

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | **`55432`** (not the default 5432 — see note below) |
| Database | `writewise` |
| User | `writewise` |
| Password | `writewise` |

> **Why port 55432?** Some machines already have a native Postgres install occupying port 5432 (this bit us once — the container looked "connected" but auth failed because we were actually hitting the wrong Postgres). Port 55432 avoids that collision. If 55432 is also taken on your machine, change the left side of the `ports:` mapping in `docker-compose.yml` (e.g. `"55433:5432"`) and update `DATABASE_URL` in your `.env` to match.

**Verify it's up:**
```bash
docker ps --filter name=writewise-postgres
```
You should see it `Up`.

**Stopping it:** `docker compose down` (data is preserved). **Never** run `docker compose down -v` unless you intend to permanently delete all local data — the `-v` flag drops the volume too.

---

## 2. Backend (FastAPI)

```bash
cd backend
python -m venv .venv              # first time only
.venv\Scripts\activate             # Windows — use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
copy .env.example .env             # Windows — use `cp .env.example .env` on macOS/Linux
```

Now edit `backend/.env` and fill in:
- `GEMINI_API_KEY` — ask a teammate or check the team's shared secrets doc for the project's Gemini API key. **Do not commit a real key** to `.env.example`.
- `DATABASE_URL` — already defaults to `postgresql+psycopg2://writewise:writewise@localhost:55432/writewise`, matching step 1. Only change this if you changed the Docker port.
- `JWT_SECRET_KEY` — generate your own local value, don't reuse the placeholder:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
  Paste the output in as `JWT_SECRET_KEY`. Any value works for local dev; it just needs to be non-empty and kept out of git.

**Run the database migrations** (creates all tables — `users`, `writing_submissions`, `submission_scores`, `task_definitions`, `refresh_tokens`):

```bash
alembic upgrade head
```

**Start the backend:**

```bash
uvicorn app.main:app --reload
```

Runs at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs` — useful for poking at endpoints directly without the frontend.

---

## 3. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000`. It talks to the backend at `http://localhost:8000` by default — set `TASK_DEFINITION_BACKEND_URL` in a `frontend/.env.local` if yours runs elsewhere.

Run backend + frontend + Postgres together (three terminals, or Postgres detached in the background as in step 1) to use the full app.

---

## 4. First login

There's no seed data — every teammate creates their own account:

1. Open `http://localhost:3000/signup`.
2. Sign up with any email/password (min 8 characters). This creates a real row in the `users` table.
3. You'll land on `/dashboard`. Upload a document via **Start a New Task** to generate your first scores.

Auth uses httpOnly cookies set by the Next.js API routes — you don't need to manage tokens manually.

---

## 5. Browsing the database directly

If you want to inspect data without going through the app:

**Quick SQL shell (no install needed):**
```bash
docker exec -it writewise-postgres-1 psql -U writewise -d writewise
```
Then e.g. `\dt` to list tables, `SELECT * FROM users;` to see rows.

**GUI client (DBeaver, pgAdmin, TablePlus, etc.):** connect using the same details as step 1 (`localhost:55432`, db `writewise`, user/pass `writewise`/`writewise`).

---

## Day-to-day workflow

Once you're set up, pulling new changes usually means:

```bash
# backend
cd backend
.venv\Scripts\activate
pip install -r requirements.txt   # in case new deps were added
alembic upgrade head              # in case new migrations were added
uvicorn app.main:app --reload

# frontend (separate terminal)
cd frontend
npm install                       # in case new deps were added
npm run dev

# Postgres container just needs to be running (docker compose up -d postgres),
# no need to recreate it unless the docker-compose.yml itself changed
```

**If you write a new migration** (added/changed a SQLAlchemy model in `backend/app/db/models.py`):
```bash
cd backend
alembic revision --autogenerate -m "short description of the change"
alembic upgrade head
```
Commit the generated file under `backend/alembic/versions/` along with your model change — teammates get your schema change automatically next time they run `alembic upgrade head`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend crashes on startup with a pydantic `ValidationError` about `database_url` or `jwt_secret_key` | `.env` is missing or incomplete — recheck step 2. |
| `psycopg2.OperationalError: password authentication failed` | You're probably hitting a different Postgres on the same port (e.g. a native install on 5432). Confirm `DATABASE_URL` in `.env` uses port `55432`, matching `docker-compose.yml`. |
| `docker compose up` fails to pull the image / hangs | Docker Desktop isn't running — start it and retry. |
| Frontend shows "Could not score the uploaded document. Is the backend service running..." | Backend isn't running, or `GEMINI_API_KEY` is missing/invalid in `backend/.env`. |
| Logged in but immediately redirected back to `/login` | Cookies didn't get set — check the browser's dev tools → Application → Cookies for `ww_access`/`ww_refresh` on `localhost:3000`, and check the backend terminal for a 401/500 on `/api/v1/auth/login`. |
| `alembic upgrade head` says "Can't locate revision" or similar | Someone's migration history diverged (two people wrote migrations off the same base without pulling first). Pull latest `main`, and if still stuck, ask before force-editing `alembic_version` in the DB. |
