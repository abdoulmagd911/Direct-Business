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
# Files that REPORT rather than assert (scripts/qa/reports.txt) always exit 0 — they cannot go
# red, so counting them among the passes makes the green number larger without making it mean
# more. Added 2026-09-07 (watch cycle 38): they get their own line, and the pass count is the
# count of things that could actually have failed.
REPORTS_FILE="$HERE/reports.txt"
REPORT_NAMES=""
[ -f "$REPORTS_FILE" ] && REPORT_NAMES=$(grep -v '^#' "$REPORTS_FILE" | grep -v '^[[:space:]]*$' | cut -d: -f1 | tr -d ' ' | tr '\n' ' ')
is_report() { case " $REPORT_NAMES " in *" $1 "*) return 0;; *) return 1;; esac; }

REPORTED=""; PROBE_GOOD=0; PROBE_N=0
while IFS="|" read -r name code rest; do
  if is_report "$name"; then REPORTED="$REPORTED $name"; continue; fi
  PROBE_N=$((PROBE_N+1)); [ "$code" = "0" ] && PROBE_GOOD=$((PROBE_GOOD+1))
done < "$RES"

BAD=$(awk -F"|" '$2!=0' "$RES" | sort | while IFS="|" read -r n c r; do is_report "$n" || echo "$n|$c|$r"; done)
# A report cannot fail an assertion — it has none — but it CAN crash, and then it produced
# nothing at all. That is worth seeing and is not the same thing as a probe going red, so it
# gets its own line (watch cycle 40, after sweep-buttons died on a navigation race and appeared
# under RED while being excluded from the pass count — two statements that contradicted).
CRASHED=$(awk -F"|" '$2!=0' "$RES" | sort | while IFS="|" read -r n c r; do is_report "$n" && echo "  · $n (exit $c) — a report that did not finish, so it reported nothing: $OUT/$n.log"; done)
echo "green: $PROBE_GOOD / $PROBE_N probes that can fail"
if [ -n "$REPORTED" ]; then
  echo "reports (no assertions — read them, they cannot go red):$REPORTED"
fi
if [ -n "$CRASHED" ]; then
  echo "REPORTS THAT DID NOT FINISH:"
  echo "$CRASHED"
fi
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
echo "battery OK — every probe in battery.txt that can fail exited 0"
