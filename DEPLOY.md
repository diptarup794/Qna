# Deploying QnA PDF Assistant

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

## Option 4: Render

**Blueprint:** In the Render dashboard, choose **New → Blueprint** and connect this repo; it will read `render.yaml` (Docker + 1 GB disk at `/app/data` for SQLite). Set `GROQ_API_KEY` when prompted.

**Manual:** New **Web Service** → Docker, same Dockerfile. Add `SECRET_KEY`, `GROQ_API_KEY`. Add a **disk** mounted at `/app/data` and set `DATABASE_URL=sqlite:////app/data/qna.db`. Free tier may not include disks; without a disk, the database resets when the instance restarts.

---

## HTTPS and reverse proxy

Put **Caddy** or **nginx** in front for TLS, or use the platform’s managed HTTPS. The app listens with `--proxy-headers` so `X-Forwarded-*` from the proxy is respected.

---

## Health check

`GET /api/health` — use for load balancer or uptime checks.
