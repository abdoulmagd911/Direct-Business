#!/usr/bin/env bash
# The preview gallery (the oversight's ask of 29 Sep 15:59): v2 on 127.0.0.1:9610 against the QA lane's own LOCAL
# stack (never a cloud project), a made-up person of every role, every route at 1440 and 390, plus the empty, error
# and signed-out states — then index.html for the Artifact. Every person and value is made up (rule 7).
#
#   tests/qa/gallery/run.sh             rebuild the database, build, seed, shoot, write the page
#   tests/qa/gallery/run.sh --no-build  reuse the last build (.next)
#
# Output: $QA_GALLERY_OUT (default ~/.cache/direct-qa-sweep/gallery): index.html, shots/, manifest.jsonl.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sweep="$(cd "$here/../sweep" && pwd)"
v2="$(cd "$here/../../.." && pwd)"
run_dir="${QA_RUN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/direct-qa-sweep}"
port="${QA_APP_PORT:-9610}"
out="${QA_GALLERY_OUT:-$run_dir/gallery}"
export QA_RUN_DIR="$run_dir" QA_APP_PORT="$port" QA_GALLERY_OUT="$out"
build=1
[ "${1:-}" = "--no-build" ] && build=0
mkdir -p "$run_dir"

sb() { npx -y supabase@2.118.0 "$@" --workdir "$run_dir/stack"; }
step() { printf '\n== %s\n' "$*"; }
pw() { pnpm -C "$v2" exec playwright test -c tests/qa/gallery/playwright.config.ts; }

step "docker and the QA stack"
docker info >/dev/null 2>&1 || { echo "docker is not running (sudo service docker start)"; exit 1; }
node "$sweep/stack.mjs" prepare
sb status >/dev/null 2>&1 || sb start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,realtime,storage-api,mailpit >"$run_dir/stack.log" 2>&1
sb db reset --local >>"$run_dir/stack.log" 2>&1 || { tail -20 "$run_dir/stack.log"; exit 1; }
node "$sweep/stack.mjs" env >"$run_dir/env"
set -a
# shellcheck disable=SC1091
. "$run_dir/env"
set +a
export SIGN_IN_METHOD=password NEXT_TELEMETRY_DISABLED=1
[ -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome ] && export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
[ -d "$v2/node_modules/.pnpm" ] || pnpm -C "$v2" install --frozen-lockfile
if [ "$build" = 1 ]; then
  step "build"
  pnpm -C "$v2" build >"$run_dir/build.log" 2>&1 || { tail -30 "$run_dir/build.log"; exit 1; }
fi

step "the app on $port"
pkill -f "next start -p $port" 2>/dev/null || true
(cd "$v2" && exec pnpm exec next start -p "$port" >"$run_dir/app.log" 2>&1) &
app_pid=$!
trap 'kill "$app_pid" 2>/dev/null || true; pkill -f "next start -p $port" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "http://127.0.0.1:$port/sign-in" && break; sleep 1; done

rm -rf "$out"
mkdir -p "$out"
step "people only, then the empty screens"
QA_SEED_STAGE=people node "$sweep/seed.mjs"
QA_GALLERY_STATE=empty pw || true
step "the records, then every role"
QA_SEED_STAGE=data QA_SEED_MORE=1 node "$sweep/seed.mjs"
QA_GALLERY_STATE=filled pw || true
step "signing in"
QA_GALLERY_STATE=door pw || true
step "the data API down"
QA_GALLERY_STATE=error pw || true
docker start supabase_rest_direct-commercial-qa >/dev/null 2>&1 || true

step "the page"
GALLERY_SHA="${GALLERY_SHA:-$(git -C "$v2" rev-parse --short HEAD)}" node "$here/build-page.mjs"
