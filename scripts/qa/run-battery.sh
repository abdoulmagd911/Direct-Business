#!/bin/bash
# Run the battery — the list in battery.txt, nothing else.
#
# Written 2026-09-07 (watch cycle 36). Before this the runner was a throwaway in /tmp that kept
# only the LAST LINE of each probe's output. That is why six cycles of moving reds were
# diagnosed from a summary line and written off as "environmental": when a probe failed inside
# a batch, the checks it failed on were already gone. Every run now keeps the full output of
# every probe, so the next unexplained red can be read instead of guessed at.
#
#   scripts/qa/run-battery.sh              # all of it, 6 at a time
#   scripts/qa/run-battery.sh -j 3         # fewer at once (2 vCPUs: 6 is 3x oversubscribed)
#   scripts/qa/run-battery.sh -o /tmp/run1 # where the per-probe logs go
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
JOBS=6; OUT="/tmp/battery-$(date +%H%M%S)"; TIMEOUT=600
while [ $# -gt 0 ]; do
  case "$1" in
    -j) JOBS="$2"; shift 2;;
    -o) OUT="$2"; shift 2;;
    -t) TIMEOUT="$2"; shift 2;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
mkdir -p "$OUT"
RES="$OUT/results.txt"; : > "$RES"
LIST="$OUT/list.txt"
grep -v '^#' "$HERE/battery.txt" | grep -v '^[[:space:]]*$' > "$LIST"
N=$(wc -l < "$LIST")
echo "battery: $N entries from battery.txt, $JOBS at a time, ${TIMEOUT}s each"
echo "full output per probe: $OUT/<probe>.log"
cd "$REPO"
export OUT RES TIMEOUT
# shellcheck disable=SC2016
xargs -P "$JOBS" -I {} bash -c '
  log="$OUT/{}.log"
  timeout "$TIMEOUT" node scripts/qa/{}.mjs > "$log" 2>&1
  code=$?
  last=$(grep -v "^$" "$log" | tail -1 | cut -c1-110)
  echo "{}|$code|$last" >> "$RES"
' < "$LIST"
echo
BAD=$(awk -F"|" '$2!=0' "$RES" | sort)
GOOD=$(awk -F"|" '$2==0' "$RES" | wc -l)
echo "green: $GOOD / $N"
if [ -n "$BAD" ]; then
  echo "RED:"
  echo "$BAD" | while IFS="|" read -r name code last; do
    echo "  ✗ $name (exit $code) — $last"
    # the reason this script exists: show the failing checks, not just the summary line
    grep -E "^ *(x |✗|FAIL)" "$OUT/$name.log" | head -8 | sed "s/^/        /"
    echo "        full log: $OUT/$name.log"
  done
  exit 1
fi
echo "battery OK — every probe in battery.txt exited 0"
