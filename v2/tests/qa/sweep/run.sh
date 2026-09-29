#!/usr/bin/env bash
# The QA sweep (V410's QA lane): the real app on 127.0.0.1:9610 against the QA lane's own LOCAL Supabase stack (never
# a cloud project), signed in as a made-up person of every role, with a PASS / FAIL / NOT BUILT line per screen and
# per check. Every person and value is made up (rule 7).
#
#   tests/qa/sweep/run.sh                 start what is missing, build, seed, sweep, print the table, stop the app
#   tests/qa/sweep/run.sh --fresh         rebuild the database from zero first (every migration applied again)
#   tests/qa/sweep/run.sh --no-build      reuse the last build (.next) — only when the app's code has not changed
#   tests/qa/sweep/run.sh --stop          also stop the stack at the end (it is left running by default)
#   tests/qa/sweep/run.sh -- <args>       anything after -- goes to Playwright (e.g. -- --grep "sign-in")
#
# Output: tests/qa/sweep/results.json (git-ignored), and in the run folder (QA_RUN_DIR, default
# ~/.cache/direct-qa-sweep): app.log, build.log, stack.log, fixtures.json, shots/ (QA_SHOTS overrides it).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
v2="$(cd "$here/../../.." && pwd)"
run_dir="${QA_RUN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/direct-qa-sweep}"
port="${QA_APP_PORT:-9610}"
export QA_RUN_DIR="$run_dir" QA_APP_PORT="$port"
fresh=0
build=1
stop=0
pw_args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --fresh) fresh=1 ;;
    --no-build) build=0 ;;
    --stop) stop=1 ;;
    --) shift; pw_args=("$@"); break ;;
    *) echo "unknown option $1 (see the top of $0)"; exit 2 ;;
  esac
  shift
done
mkdir -p "$run_dir"

sb() {
  if [ -n "${SUPABASE_BIN:-}" ]; then "$SUPABASE_BIN" "$@" --workdir "$run_dir/stack"; else npx -y supabase@2.118.0 "$@" --workdir "$run_dir/stack"; fi
}

step() { printf '\n== %s\n' "$*"; }

step "docker"
if ! docker info >/dev/null 2>&1; then
  sudo service docker start >/dev/null
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi
docker info >/dev/null 2>&1 || { echo "docker is not running (docker info fails)"; exit 1; }

step "the QA stack (API 9621, DB 9622)"
node "$here/stack.mjs" prepare
if ! sb status >/dev/null 2>&1; then
  sb start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,realtime,storage-api,mailpit \
    >"$run_dir/stack.log" 2>&1 || { tail -20 "$run_dir/stack.log"; exit 1; }
fi
if [ "$fresh" = 1 ] || ! node "$here/stack.mjs" stale; then
  sb db reset --local >>"$run_dir/stack.log" 2>&1 || { tail -20 "$run_dir/stack.log"; exit 1; }
fi
node "$here/stack.mjs" env >"$run_dir/env"
set -a
# shellcheck disable=SC1091
. "$run_dir/env"
set +a
export SIGN_IN_METHOD=password NEXT_TELEMETRY_DISABLED=1
if [ -z "${PW_CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ]; then
  export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
fi

step "dependencies"
[ -d "$v2/node_modules/.pnpm" ] || pnpm -C "$v2" install --frozen-lockfile

if [ "$build" = 1 ]; then
  step "build (log: $run_dir/build.log)"
  pnpm -C "$v2" build >"$run_dir/build.log" 2>&1 || { tail -30 "$run_dir/build.log"; exit 1; }
fi

step "the app on $port"
if curl -s -o /dev/null "http://127.0.0.1:$port/sign-in"; then
  echo "port $port is already taken — stop what runs there first"
  exit 1
fi
(cd "$v2" && exec pnpm exec next start -p "$port" >"$run_dir/app.log" 2>&1) &
app_pid=$!
cleanup() {
  kill "$app_pid" 2>/dev/null || true
  pkill -f "next start -p $port" 2>/dev/null || true
  if [ "$stop" = 1 ]; then sb stop --no-backup >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://127.0.0.1:$port/sign-in" && break
  sleep 1
done
curl -s -o /dev/null "http://127.0.0.1:$port/sign-in" || { tail -20 "$run_dir/app.log"; exit 1; }

step "fixtures (made-up people and organisations)"
node "$here/seed.mjs"

step "the sweep"
rm -f "$run_dir/results.jsonl"
set +e
pnpm -C "$v2" exec playwright test -c tests/qa/sweep/playwright.config.ts "${pw_args[@]}"
pw_exit=$?
set -e

step "results"
node "$here/report.mjs"
exit "$pw_exit"
