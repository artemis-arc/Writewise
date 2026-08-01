# Contributing Guide

Each member owns one module. Use your **student ID** (e.g. `215131E`) as your namespace on the backend so nobody's files collide. Frontend work is proxied through a single Next.js API layer so components never call the FastAPI backend directly.

## Backend (`backend/`)

FastAPI app. Put your code under a folder named after your student ID inside each of these:

```
backend/app/api/routes/<your_id>/    # your FastAPI routers
backend/app/models/<your_id>/        # your pydantic schemas
backend/app/services/<your_id>/      # your business logic
backend/app/data/<your_id>/          # your datasets / model checkpoints
```

Steps to add a new endpoint:

1. Define request/response schemas in `backend/app/models/<your_id>/schemas.py`.
2. Write the logic in `backend/app/services/<your_id>/`.
3. Create a router in `backend/app/api/routes/<your_id>/your_feature.py`:
   ```python
   router = APIRouter(prefix="/api/v1/your-feature", tags=["your-feature"])
   ```
4. Register it in `backend/app/main.py`:
   ```python
   from app.api.routes.<your_id> import your_feature
   app.include_router(your_feature.router)
   ```
5. If you need config (API keys, file paths), add fields to `backend/app/core/config.py` and to `.env.example`.

Keep your namespace self-contained — don't import another member's `services/<their_id>/` code directly; ask if you need to share something and we'll pull it into a common module.

## Frontend (`frontend/`)

Never call the FastAPI backend directly from a component. The flow is always:

```
Component / hook
   -> src/features/<feature>/services/*.ts   (calls apiRequest, business-friendly types)
   -> src/app/api/<feature>/*/route.ts        (Next.js route handler, validates with zod)
   -> src/lib/backend/*Client.ts              (knows the FastAPI URL + wire format)
   -> FastAPI backend
```

Steps to wire up a new endpoint:

1. **Backend client** — add a function in `src/lib/backend/yourFeatureClient.ts` that `fetch`es `` `${BACKEND_BASE_URL}/api/v1/your-feature` `` and maps the response into your app's types.
2. **Route handler** — add `src/app/api/<feature>/<action>/route.ts`, validate the incoming body with a zod schema, call your backend client, return `NextResponse.json(...)`.
3. **Feature service** — add a function in `src/features/<feature>/services/*.ts` that calls `apiRequest("/api/<feature>/<action>", { method: "POST", body })` from `src/lib/api/client.ts`. Components call this, never `fetch` directly.
4. Add any shared types to `src/features/<feature>/types.ts`.

This keeps one seam (`route.ts` + the backend client) that knows the FastAPI backend exists — everything above it just deals in plain app types, so it's easy to mock while backend work is in progress.

## Running the project

The project now has a Postgres database and auth in front of it, so setup takes a few more steps than just `pip install` + `npm install`.

**See [SETUP.md](SETUP.md) for the full walkthrough** — database (Docker), backend, frontend, first login, browsing the DB directly, and a troubleshooting table.

Quick reference once you've done the one-time setup in SETUP.md:

```bash
# Postgres (if not already running)
docker compose up -d postgres

# Backend
cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend && npm run dev
```

If you add a new SQLAlchemy model or change an existing one, generate and commit a migration:
```bash
cd backend
alembic revision --autogenerate -m "short description"
alembic upgrade head
```
