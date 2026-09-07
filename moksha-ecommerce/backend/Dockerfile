# syntax=docker/dockerfile:1
#
# Two stages so the runtime image carries no build toolchain. psycopg[binary] ships wheels, so
# nothing here needs a compiler — but keeping the split means that stays true if a dependency
# changes.

FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# `app/` is copied *before* the install, not after.
#
# pyproject declares the package under `[tool.setuptools.packages.find]`, so `pip install .` builds
# a wheel and needs the source on disk. Copying only pyproject.toml — to keep the dependency layer
# cached — meant setuptools was told to build a package that was not there:
#
#     error: package directory 'app' does not exist
#
# Local `docker compose` never caught it, because compose bind-mounts the source over /app and so
# never executes the image's own copy of the code. The same blind spot then hid a second bug: a
# bare `packages = ["app"]` installed the top-level package only, leaving out app.api, app.core and
# app.services — that one built clean and failed at *import* time.
#
# The Dockerfile is a deliverable a reviewer may well run, so it now has its own verification step:
# `backend/scripts/docker-verify.sh`, which builds the image and runs it against a real database.
#
# The cost is that editing any source file invalidates the dependency layer, so a rebuild
# re-resolves the whole tree. Roughly two minutes on Render's free tier, for a deploy that happens
# a handful of times. The alternative — installing dependencies against a stub package first, then
# `pip install --no-deps .` after copying the real source — halves rebuild time in exchange for a
# construct that needs a paragraph to explain. Not worth it here.
COPY pyproject.toml ./
COPY app ./app

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

# Only the files that are **not** part of the installed package.
#
# `app/` itself is deliberately absent: it is installed into the venv, and copying it here as well
# would put a second copy at /app that shadows the installed one — because the working directory
# precedes site-packages on sys.path. Two copies of the same code, with the one that actually runs
# decided by CWD, is a debugging trap. This way there is exactly one.
#
# Alembic's migration scripts and the seed script are not importable package code, so they are
# copied. `tests/`, `run.py` and `pyproject.toml` are not needed at runtime and stay out of the
# image.
COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app scripts ./scripts

USER app

EXPOSE 8000

# Render (and any orchestrator) injects $PORT; default to 8000 for local compose.
#
# Migrations run against MIGRATION_DATABASE_URL when it is set, falling back to DATABASE_URL —
# see alembic/env.py. On Neon that wants to be the *direct* endpoint rather than the pooled one.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
