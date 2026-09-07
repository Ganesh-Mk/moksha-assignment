# syntax=docker/dockerfile:1
#
# Two stages so the runtime image carries no build toolchain. psycopg[binary] ships wheels, so
# nothing here needs a compiler — but pinning the split keeps that true if a dependency changes.

FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# Copy only the dependency manifest first: this layer is cached across every code change, so a
# source edit rebuilds in seconds instead of re-resolving the dependency tree.
COPY pyproject.toml ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install .


FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# curl is here only for the compose healthcheck; it is a few hundred KB and saves writing a
# Python probe script.
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app . .

USER app

EXPOSE 8000

# Render (and any orchestrator) injects $PORT; default to 8000 for local compose.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
