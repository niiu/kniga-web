#!/bin/sh
set -eu
cd "$(dirname "$0")"
PORT="${PORT:-8080}"
export PORT

if docker compose version >/dev/null 2>&1; then
  docker compose up --detach --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up --detach --build
else
  docker build -t kniga .
  docker rm -f kniga >/dev/null 2>&1 || true
  docker volume create kniga-data >/dev/null
  docker run --detach --name kniga --restart unless-stopped \
    --publish "${PORT}:8080" \
    --volume kniga-data:/data \
    --env VITE_AUTH_ENABLED=false \
    --env HOST=0.0.0.0 \
    --env PORT=8080 \
    --env PGLITE_DATA_DIR=/data/pglite \
    kniga
fi

echo "Книга: http://0.0.0.0:${PORT}/"
