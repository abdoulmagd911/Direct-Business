#!/usr/bin/env bash
# The QA session's runner (V410: the QA lane owns docs/v2/QA-LOG.md and v2/supabase/tests/qa/**). One short command per
# run, so a run does not stop for approval on a long compound shell line. Never touches the working tree: each run
# exports the chosen ref's v2/ into a scratch folder, adds this folder's QA tests, and builds a database from zero.
#
#   run.sh suite  [ref]                     the whole SQL suite plus the QA tests (default ref: origin/v2/main)
#   run.sh only   <ref> <ID>...             only these test IDs (QA-06, SETS-02 …)
#   run.sh after  <ref> <file.sql> [ID...]  the suite (or these IDs) with a SQL file applied after the migrations
#   run.sh probe  <ref> <file.sql>          build the database, then run a probe file against it with psql
#   run.sh gen    <ref> <outdir> [regex]    write one mutant per guard (a `raise exception` made `null;`, an
#                                           authz.require…(…) made authz.me()) of every function whose
#                                           schema.name matches regex (default: all v2 schemas)
#   run.sh mutate <ref> <dir> [ID...]       run the suite (or these IDs) once per mutant in dir; list survivors
#
# Environment: QA_SCRATCH (default ${TMPDIR:-/tmp}/v2qa), QA_DB (default v2_qa), PG* as for scripts/db/test.mjs.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
SCRATCH="${QA_SCRATCH:-${TMPDIR:-/tmp}/v2qa}"
DB="${QA_DB:-v2_qa}"
export PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"

pg_up() {
  if ! psql -X -q -d postgres -Atc 'select 1' >/dev/null 2>&1; then
    echo "postgres is down; starting it" >&2
    service postgresql start >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      psql -X -q -d postgres -Atc 'select 1' >/dev/null 2>&1 && return 0
      sleep 1
    done
    echo "postgres did not start" >&2
    exit 1
  fi
}

# Exports <ref>'s v2/ into $SCRATCH/<name>/v2 and adds this folder's QA tests; prints the v2 path.
# With a second argument "noqa" the QA tests are left out (a mutation run must not count their by-design reds).
export_ref() {
  local ref="$1" mode="${2:-qa}" name dir
  name="$(printf '%s' "$ref" | tr -c 'A-Za-z0-9._-' '_')-$mode"
  dir="$SCRATCH/$name"
  rm -rf "$dir"
  mkdir -p "$dir"
  git -C "$REPO" archive "$ref" v2 | tar -x -C "$dir"
  rm -rf "$dir/v2/supabase/tests/qa"
  if [ "$mode" = qa ]; then
    cp -r "$HERE" "$dir/v2/supabase/tests/qa"
    rm -f "$dir/v2/supabase/tests/qa/run.sh"
  fi
  printf '%s\n' "$dir/v2"
}

run_suite() { # <v2 dir> [test.mjs args...]
  local v2="$1"
  shift
  (cd "$v2" && V2_TEST_DB="$DB" node scripts/db/test.mjs "$@")
}

only_args() { # IDs -> --only ID ... (nothing at all for no IDs)
  local id
  for id in "$@"; do printf '%s\n%s\n' --only "$id"; done
}

cmd="${1:-suite}"
shift || true
case "$cmd" in
  suite)
    pg_up
    v2="$(export_ref "${1:-origin/v2/main}")"
    run_suite "$v2" | grep -E '^(FAIL|built)|passed, ' || true
    ;;
  only)
    pg_up
    ref="$1"
    shift
    v2="$(export_ref "$ref")"
    mapfile -t extra < <(only_args "$@")
    run_suite "$v2" "${extra[@]}" || true
    ;;
  after)
    pg_up
    ref="$1" file="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
    shift 2
    v2="$(export_ref "$ref")"
    mapfile -t extra < <(only_args "$@")
    run_suite "$v2" --after "$file" "${extra[@]+"${extra[@]}"}" || true
    ;;
  probe)
    pg_up
    ref="$1" file="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
    v2="$(export_ref "$ref")"
    run_suite "$v2" --only QA-07 >/dev/null || true # builds the database from zero and loads the harness
    psql -X -q -d "$DB" -v ON_ERROR_STOP=0 -f "$file" 2>&1 | grep -vE '^\s*$|^-+(\+-+)*$|\(1 row\)' || true
    ;;
  gen)
    pg_up
    ref="$1" out="$2" re="${3:-^(core|authz|audit|notify|partner|norm|work)\.}"
    v2="$(export_ref "$ref")"
    run_suite "$v2" --only QA-07 >/dev/null || true
    mkdir -p "$out"
    DB="$DB" RE="$re" OUT="$out" python3 - <<'PY'
import json, os, re, subprocess
q = """select coalesce(json_agg(json_build_object('sig', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  'name', n.nspname||'.'||p.proname, 'def', pg_get_functiondef(p.oid))), '[]')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('core','authz','audit','notify','partner','norm','work','perf','finance','files') and p.prokind = 'f'"""
fns = json.loads(subprocess.run(['psql', '-X', '-q', '-At', '-d', os.environ['DB'], '-c', q],
                                capture_output=True, text=True, check=True).stdout)
pat, out, idx, n = re.compile(os.environ['RE']), os.environ['OUT'], [], 0
for f in fns:
    if not pat.search(f['name']):
        continue
    d = f['def']
    guards = [(m, 'null;') for m in re.finditer(r'raise exception using[^;]*;', d)]
    guards += [(m, 'authz.me()') for m in re.finditer(r'authz\.require(_capability)?\([^()]*(\([^()]*\))?[^()]*\)', d)]
    for m, rep in guards:
        n += 1
        open(os.path.join(out, f'{n:03d}.sql'), 'w').write(d[:m.start()] + rep + d[m.end():] + ';\n')
        idx.append({'id': f'{n:03d}', 'sig': f['sig'], 'line': d[:m.start()].count('\n') + 1,
                    'what': re.sub(r'\s+', ' ', m.group(0))[:140]})
json.dump(idx, open(os.path.join(out, 'index.json'), 'w'), indent=0)
print(f'{n} mutants in {out}')
PY
    ;;
  mutate)
    pg_up
    ref="$1" dir="$(cd "$2" && pwd)"
    shift 2
    if [ $# -gt 0 ]; then v2="$(export_ref "$ref")"; else v2="$(export_ref "$ref" noqa)"; fi
    mapfile -t extra < <(only_args "$@")
    survivors=0 total=0
    for m in "$dir"/[0-9]*.sql; do
      total=$((total + 1))
      if run_suite "$v2" --after "$m" "${extra[@]+"${extra[@]}"}" >"$m.out" 2>&1; then
        survivors=$((survivors + 1))
        id="$(basename "$m" .sql)"
        python3 -c "import json,sys; x=[e for e in json.load(open('$dir/index.json')) if e['id']=='$id']; print('SURVIVED', '$id', x[0]['sig'].split('(')[0], x[0]['what'] if x else '')" 2>/dev/null ||
          echo "SURVIVED $id"
      fi
    done
    echo "$survivors of $total mutants left the suite green"
    ;;
  *)
    sed -n '2,17p' "$0"
    exit 2
    ;;
esac
