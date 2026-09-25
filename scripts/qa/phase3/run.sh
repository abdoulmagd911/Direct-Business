#!/usr/bin/env bash
# Phase 3 release 1 — the task-manager design's 87 attack tests + the 6 release-1 tests, on a LOCAL Postgres.
# Builds a throwaway database: Supabase's default grants (00a) → the test copy of the live access functions
# (00_test_copy_of_live.sql, 29e) → the corrections measured on live 2026-09-25 (00b_live_truth.sql) →
# the migration → attacks.py. Pass the migration as $1 (default: the release-1 file). Run the DESIGN as
# written (29a) through it to see the six R1 tests fail — that is their sabotage.
# Needs: a local Postgres reachable at TM_DSN (default host=/tmp user=postgres dbname=tm12) and psycopg2.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; MIG="${1:-$HERE/../../sql/phase3-r1-task-manager.sql}"
DB="${TM_DB:-tm12}"; H="${TM_HOST:-/tmp}"; U="${TM_USER:-postgres}"
dropdb -h "$H" -U "$U" --if-exists "$DB"; createdb -h "$H" -U "$U" "$DB"
for f in 00a_supabase_defaults.sql 00_test_copy_of_live.sql 00b_live_truth.sql; do psql -h "$H" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/$f" >/dev/null; done
psql -h "$H" -U "$U" -d "$DB" -q -v ON_ERROR_STOP=1 -f "$MIG" >/dev/null
TM_DSN="host=$H user=$U dbname=$DB" python3 "$HERE/attacks.py"
