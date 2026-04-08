# Deploying QnA PDF Assistant

**Ideal layout:** this directory **is** the Git repository root (`Dockerfile`, `render.yaml`, `backend/`, `static/` at top level).

**Monorepo:** if the Git root is a parent folder, set Render **Root Directory** to this app folder (e.g. `Qna`) so `./Dockerfile` and the build context resolve correctly.

## Prerequisites

- `SECRET_KEY` — long random string (e.g. `openssl rand -hex 32`)
- `GROQ_API_KEY` — from [Groq Console](https://console.groq.com/)

Never commit `.env` or real keys.

---

## Option 1: Docker (VPS, local server, any host with Docker)

```bash
# From the project root
cp .env.example .env   # if needed; edit SECRET_KEY and GROQ_API_KEY
docker compose up --build -d
```

Open `http://<server-ip>:8000`.

Data is stored in the Docker volume `qna_data` (SQLite under `/app/data`).

---

## Option 2: Railway

1. Push this repo to GitHub.
2. [Railway](https://railway.app/) → New Project → Deploy from GitHub.
3. Add variables: `SECRET_KEY`, `GROQ_API_KEY`, optional `GROQ_MODEL`.
4. Railway sets `PORT` automatically; the Dockerfile `CMD` uses it.
5. Add a **volume** mounted at `/app/data` if you want SQLite to survive redeploys; otherwise the DB resets on each deploy.

For durable data on Railway, prefer attaching a volume or switching `DATABASE_URL` to a managed Postgres URL and migrating the app (not included by default).

---

## Option 3: Fly.io

Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/), then:

```bash
fly launch
```

Choose this Dockerfile when prompted. Then:

```bash
fly secrets set SECRET_KEY=your-secret GROQ_API_KEY=your-groq-key
```

Persist SQLite across restarts: create a volume in the same region as the app (`fly regions list`), then in the generated `fly.toml` add:

```toml
[env]
  DATABASE_URL = "sqlite:////app/data/qna.db"

[[mounts]]
  source = "qna_data"
  destination = "/app/data"
```

Create the volume: `fly volumes create qna_data --region <your-region> --size 1`, then `fly deploy`.

---

## Option 4: Vercel (FastAPI)

This repo defines the app in three ways so `vercel build` can find it:

1. **`pyproject.toml`** — `[project.scripts] app = "backend.main:app"` (recommended by Vercel).
2. **Root `main.py` and `app.py`** — assign `app = fastapi_app` (some scanners only detect an assignment, not `from … import app`).
3. **`api/main.py`** — same pattern; path appears in Vercel’s allowed entrypoint list.

**Project root:** connect the Git repo whose root contains `pyproject.toml` and `backend/` (this folder). If Vercel’s **Root Directory** is wrong, detection fails even with the files above.

**Limits:** Vercel runs your API as a **serverless function**. SQLite files and uploaded PDFs **do not persist** reliably; use **Render / Docker / Fly** if you need a normal disk-backed app.

Optional: put extra static assets under **`public/`** for CDN delivery ([Vercel FastAPI static docs](https://vercel.com/docs/frameworks/backend/fastapi)).

---

## Option 5: Render

**Blueprint:** In the Render dashboard, choose **New → Blueprint** and connect this repo; it will read `render.yaml` (Docker + 1 GB disk at `/app/data` for SQLite). Set `GROQ_API_KEY` when prompted.

**Manual:** New **Web Service** → Docker, same Dockerfile. Add `SECRET_KEY`, `GROQ_API_KEY`. Add a **disk** mounted at `/app/data` and set `DATABASE_URL=sqlite:////app/data/qna.db`. Free tier may not include disks; without a disk, the database resets when the instance restarts.

---

## HTTPS and reverse proxy

Put **Caddy** or **nginx** in front for TLS, or use the platform’s managed HTTPS. The app listens with `--proxy-headers` so `X-Forwarded-*` from the proxy is respected.

---

## Health check

`GET /api/health` — use for load balancer or uptime checks.

---

## Build failed (exit code 1)

1. **Open the full build log** on Render (Deploy → failed deploy → logs). Scroll for the first `error:` line.

2. **Native compile errors** (`httptools`, `uvloop`, `gcc`, `Failed building wheel`): the `Dockerfile` in this repo installs `build-essential` during `pip install` so slim images can compile those dependencies. Push the latest `Dockerfile` and redeploy.

3. **`COPY failed: file not found`**: the paths `backend/`, `static/`, `requirements.txt`, or `app.py` are missing from **Git**. Render only sees committed files. Run `git status`, add and commit them, then push.

4. **Wrong root**: if the repo root is a parent folder, set **Settings → Root Directory** to `Qna` (or your app folder) so `Dockerfile` and `backend/` exist under that path.

5. **Blueprint + disk on Free**: if provisioning fails (not always during “build”), try a **Starter** instance or create a **Web Service** manually without a disk for a quick test (SQLite will be ephemeral).
