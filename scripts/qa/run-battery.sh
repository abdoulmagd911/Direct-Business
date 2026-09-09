#!/bin/bash
# Run the battery — the list in battery.txt, nothing else.
#
# Written 2026-09-07 (watch cycle 36). Before this the runner was a throwaway in /tmp that kept
# only the LAST LINE of each probe's output. That is why six cycles of moving reds were
# diagnosed from a summary line and written off as "environmental": when a probe failed inside
# a batch, the checks it failed on were already gone. Every run now keeps the full output of
# every probe, so the next unexplained red can be read instead of guessed at.
#
# 2026-09-08 (watch cycle 58): and a second thing the summary could not say. Cycle 57 ran the
# whole battery twice and got two DIFFERENT sets of reds — five probes went red once each and
# none of them twice, every one green when re-run alone. Their own texts named the cause: one
# drove 1 sub-tab under load and 9 alone, two never received app_settings at all, one died on
# "execution context was destroyed". So the summary line was reporting a race, not a fact, and a
# red could no longer be read at face value — which is exactly how a real defect hides among
# excuses. The runner now re-runs its own reds ONE AT A TIME before it says anything, and reports
# the two outcomes separately: reproduced alone (a finding) and did not (contention). Greens are
# never re-run, so this costs only what was already failing.
#
#   scripts/qa/run-battery.sh              # all of it, 6 at a time
#   scripts/qa/run-battery.sh -j 3         # fewer at once (2 vCPUs: 6 is 3x oversubscribed)
#   scripts/qa/run-battery.sh -o /tmp/run1 # where the per-probe logs go
#   scripts/qa/run-battery.sh -l list.txt -d dir   # a different list / a different probe folder
#                                          # (used by probe-battery-retry-honesty to drive this
#                                          #  script against fakes instead of the real battery)
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
JOBS=6; OUT="/tmp/battery-$(date +%H%M%S)"; TIMEOUT=600
LISTSRC="$HERE/battery.txt"; PDIR="scripts/qa"
while [ $# -gt 0 ]; do
  case "$1" in
    -j) JOBS="$2"; shift 2;;
    -o) OUT="$2"; shift 2;;
    -t) TIMEOUT="$2"; shift 2;;
    -l) LISTSRC="$2"; shift 2;;
    -d) PDIR="$2"; shift 2;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
mkdir -p "$OUT"
RES="$OUT/results.txt"; : > "$RES"
LIST="$OUT/list.txt"
grep -v '^#' "$LISTSRC" | grep -v '^[[:space:]]*$' > "$LIST"
N=$(wc -l < "$LIST")
echo "battery: $N entries from battery.txt, $JOBS at a time, ${TIMEOUT}s each"
echo "full output per probe: $OUT/<probe>.log"
cd "$REPO"
export OUT RES TIMEOUT PDIR
# shellcheck disable=SC2016
xargs -P "$JOBS" -I {} bash -c '
  log="$OUT/{}.log"
  timeout "$TIMEOUT" node "$PDIR/{}.mjs" > "$log" 2>&1
  code=$?
  last=$(grep -v "^$" "$log" | tail -1 | cut -c1-110)
  echo "{}|$code|$last" >> "$RES"
' < "$LIST"
echo

# 2026-09-08 (watch cycle 58). Everything above ran under contention; nothing above is a fact yet.
# Re-run ONLY what came back non-zero, one at a time, and let the second answer stand — a probe
# that fails alone has found something, a probe that passes alone found a busy machine. Greens are
# not re-run: the cost of this is bounded by what was already failing.
RETRY=$(awk -F"|" '$2!=0 {print $1}' "$RES" | sort)
FINAL="$OUT/retried.txt"; : > "$FINAL"
NOTREPRO=""
if [ -n "$RETRY" ]; then
  echo "re-running $(echo "$RETRY" | wc -w | tr -d ' ') non-zero result(s) one at a time — a red under load is not a fact until it reproduces alone"
  for name in $RETRY; do
    rlog="$OUT/$name.retry.log"
    timeout "$TIMEOUT" node "$PDIR/$name.mjs" > "$rlog" 2>&1
    rcode=$?
    rlast=$(grep -v "^$" "$rlog" | tail -1 | cut -c1-110)
    echo "$name|$rcode|$rlast" >> "$FINAL"
    if [ "$rcode" = "0" ]; then
      NOTREPRO="$NOTREPRO $name"
      echo "  · $name — did not reproduce alone"
    else
      echo "  ✗ $name — reproduced alone (exit $rcode)"
    fi
  done
  echo
fi
# From here on the run reads the SECOND answer where there is one. results.txt keeps the first,
# so the parallel and serial verdicts stay separately readable rather than one overwriting the other.
MERGED="$OUT/verdict.txt"; : > "$MERGED"
while IFS="|" read -r m_name m_code m_rest; do
  if [ -s "$FINAL" ] && grep -q "^$m_name|" "$FINAL"; then
    grep "^$m_name|" "$FINAL" >> "$MERGED"
  else
    echo "$m_name|$m_code|$m_rest" >> "$MERGED"
  fi
done < "$RES"
RES="$MERGED"
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
echo "green: $PROBE_GOOD / $PROBE_N probes that can fail (every red above was re-run alone before this line was printed)"
if [ -n "$NOTREPRO" ]; then
  echo "DID NOT REPRODUCE ALONE — went red under -j $JOBS, green on their own:$NOTREPRO"
  echo "  These are counted green because they passed with the machine to themselves, and that is"
  echo "  the honest reading of one run. It is NOT a clean bill: a probe that lands here run after"
  echo "  run is a race in the app or the harness, not a busy machine. Check $OUT/<probe>.log for"
  echo "  the crowded attempt and $OUT/<probe>.retry.log for the quiet one."
fi
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
    grep -E "^ *(x |✗|FAIL)" "$OUT/$name.retry.log" "$OUT/$name.log" 2>/dev/null | head -8 | sed "s|^$OUT/[^:]*:||" | sed "s/^/        /"
    if [ -f "$OUT/$name.retry.log" ]; then
      echo "        full log: $OUT/$name.retry.log (the serial re-run — it failed here too); first attempt: $OUT/$name.log"
    else
      echo "        full log: $OUT/$name.log"
    fi
  done
  exit 1
fi
echo "battery OK — every probe in the list that can fail exited 0, each red re-checked alone"
