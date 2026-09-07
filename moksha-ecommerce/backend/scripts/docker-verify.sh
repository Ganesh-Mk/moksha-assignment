#!/usr/bin/env bash
#
# Builds the production image and proves it actually works.
#
#     ./scripts/docker-verify.sh [postgres-dsn]
#
# This exists because `docker compose up` does NOT verify the Dockerfile. Compose bind-mounts the
# source over /app, so the image's own copy of the code is never executed and the build path is
# never exercised. Two bugs shipped that way and were only found on Render:
#
#   1. `pip install .` with only pyproject.toml copied — setuptools was told to build a package
#      that had not been copied yet. Failed at build time.
#   2. `packages = ["app"]` installed the top-level package only, leaving out app.api, app.core
#      and app.services. Built clean, then failed at *import* time — worse. A local editable
#      install hid it, because that puts the source tree on sys.path regardless.
#
# So: build the real image, then run the real thing against a real database.

set -euo pipefail

IMAGE="moksha-api:verify"
CONTAINER="moksha-verify"
PORT="${PORT:-8100}"

# Default points at the private local cluster (scripts/pg-local.ps1). Override for any other.
DSN="${1:-postgresql+psycopg://moksha:moksha_dev_pw@host.docker.internal:55432/moksha_docker}"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

step() { printf '\n\033[36m=== %s\033[0m\n' "$1"; }

step "build"
docker build -t "$IMAGE" .

step "the package resolves from site-packages, and every subpackage is present"
# The check that would have caught bug 2: importing the deep modules, not just `app`.
docker run --rm "$IMAGE" python -c "
import app, app.main, app.api.v1.router, app.services.order_service, app.agent.graph
assert '/site-packages/' in app.__file__, app.__file__
print('app ->', app.__file__)
print('routes ->', len(app.main.create_app().openapi()['paths']))
"

step "no shadowing copy of the source at /app"
# /app must contain only the non-package files. A second copy of `app/` there would take
# precedence over the installed one, and which code actually runs would depend on CWD.
docker run --rm "$IMAGE" sh -c '! test -d /app/app' \
  || { echo "FAIL: /app/app exists and shadows the installed package"; exit 1; }

step "runs as a non-root user"
docker run --rm "$IMAGE" sh -c 'test "$(id -u)" -ne 0' \
  || { echo "FAIL: container runs as root"; exit 1; }

step "alembic can see its migration scripts"
docker run --rm "$IMAGE" alembic heads

step "ensure the scratch database exists"
# Created here rather than assumed, so this script works on a clean machine. It runs through the
# image we just built — psycopg is already installed there, so no extra client or image is needed.
# A dedicated, droppable database is the point: migrations must be proven to run from nothing.
docker run --rm --add-host=host.docker.internal:host-gateway "$IMAGE" python -c "
import sys, psycopg
from urllib.parse import urlsplit, urlunsplit

dsn = sys.argv[1].replace('postgresql+psycopg://', 'postgresql://')
parts = urlsplit(dsn)
target = parts.path.lstrip('/')
admin = urlunsplit(parts._replace(path='/postgres'))

with psycopg.connect(admin, autocommit=True) as conn:
    exists = conn.execute('SELECT 1 FROM pg_database WHERE datname = %s', (target,)).fetchone()
    if exists:
        print(f'{target} already exists')
    else:
        conn.execute(f'CREATE DATABASE \"{target}\"')
        print(f'created {target}')
" "$DSN"

step "boot against a real database: migrate, then serve"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" -p "$PORT:8000" \
  -e DATABASE_URL="$DSN" \
  -e ENVIRONMENT=local \
  -e JWT_SECRET=verify-only-not-a-real-secret \
  --add-host=host.docker.internal:host-gateway \
  "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then break; fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    echo "FAIL: container exited"; docker logs "$CONTAINER" | tail -30; exit 1
  fi
  sleep 2
done

curl -sf "http://127.0.0.1:$PORT/api/v1/health/db" | grep -q '"database":"ok"' \
  || { echo "FAIL: database unreachable from the container"; docker logs "$CONTAINER" | tail -30; exit 1; }
echo "migrations applied and /health/db reports ok"

step "authorization still holds in the image"
code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/v1/admin/stats")
[ "$code" = "401" ] || { echo "FAIL: unauthenticated admin call returned $code, expected 401"; exit 1; }
echo "unauthenticated admin call -> 401"

printf '\n\033[32mImage verified.\033[0m\n'
