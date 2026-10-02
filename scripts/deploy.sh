#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
compose=(docker compose -f compose.yml)
if [[ "${1:-}" == "--cloudflare" ]]; then
  docker network inspect "${CLOUDFLARE_NETWORK:-cloudflare_ingress}" >/dev/null
  compose+=(-f compose.ingress.yml)
elif [[ $# -gt 0 ]]; then
  echo 'Uso: bash scripts/deploy.sh [--cloudflare]' >&2
  exit 1
fi
[[ -f .env ]] || { echo 'Execute python3 scripts/configure.py primeiro.' >&2; exit 1; }
docker info >/dev/null
"${compose[@]}" config --quiet
"${compose[@]}" build app
"${compose[@]}" up -d --wait --wait-timeout 180 db
# Stop the worker before migrations; database and media volumes are preserved.
"${compose[@]}" stop app
"${compose[@]}" run --rm app npm run db:migrate
if [[ -f .env.bootstrap ]]; then
  "${compose[@]}" -f compose.bootstrap.yml run --rm app npm run bootstrap
  rm .env.bootstrap
fi
"${compose[@]}" run --rm app node --import tsx scripts/check-installation.ts
"${compose[@]}" up -d --wait --wait-timeout 180 app
"${compose[@]}" ps
echo 'Aplicação saudável. Configure o Tunnel com http://wapphub-chat:3000 se usou --cloudflare.'
