# Production image: API + static UI
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt .

# One RUN: compiler for uvicorn[standard] / native wheels, then remove build-only packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y build-essential libffi-dev libssl-dev \
    && apt-get autoremove -y --purge \
    && rm -rf /var/lib/apt/lists/*

COPY backend ./backend
COPY static ./static
COPY app.py .

RUN mkdir -p /app/data

EXPOSE 8000

# PORT is overridden by platforms like Railway, Fly, Render
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*"]
