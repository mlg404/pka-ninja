#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${PKA_SITE:-/var/www/pka.ninja}"

cd "$ROOT"
git pull --ff-only
npm install
npm run build

# dist/data vem do git do site e não pode substituir o repositório dos captures.
rsync -a --delete \
  --exclude 'data/' \
  --exclude 'data-old/' \
  --chown=www-data:www-data \
  "$ROOT/dist/" "$SITE/"

echo "Site atualizado em $SITE. A pasta data não foi alterada."
echo "Market agregado: npm run build-market"
echo "Enxugar captures: npm run compact-market -- --write"
