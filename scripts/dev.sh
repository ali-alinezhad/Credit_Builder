#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

npm install
npm run migrate
npm run dev

