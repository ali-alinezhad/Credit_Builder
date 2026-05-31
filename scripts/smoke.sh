#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3100}"
USER_ID="${2:-user_1001}"
FROM_DATE="${3:-2026-02-20}"

echo "[1/3] Health"
curl -sS "$BASE_URL/health" | cat

echo "\n[2/3] Sync"
curl -sS -X POST "$BASE_URL/api/users/$USER_ID/sync" | cat

echo "\n[3/3] Reliability"
curl -sS "$BASE_URL/api/users/$USER_ID/reliability?from=$FROM_DATE" | cat

echo ""

