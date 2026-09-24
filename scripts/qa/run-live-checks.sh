#!/usr/bin/env bash
# run-live-checks.sh — the three by-hand checks that reach PRODUCTION, as one command.
#
# Written 2026-09-24 (fire #244, DECISIONS M87). The battery drives the app against a mock and can
# never see the live project; three checks do, and each must be run by hand during a sweep:
#
#   check-live-matches-repo   is the thing I edited the thing being served?
#   check-public-surface      what does a caller with NO sign-in get?
#   check-live-data-shapes    are the record shapes the app was hardened against actually present?
#
# They were three separate commands, and a sweep that ran one and forgot another looked complete.
# That is exactly how record_history sat readable-without-sign-in for four days: the surface check
# had not been run since the day the policy was written. This script runs all three, prints each
# verdict on its own line, and exits non-zero if ANY of them did not pass — including the data-shape
# check's exit 2 ("could not reach the database"), which is not the same answer as "clean".
#
# It reads production and never writes. It needs network. It is NOT in the battery on purpose
# (see battery-excluded.txt for each check's own reason). The container's proxy breaks direct
# HTTPS from node, so the proxy variables are stripped for the calls — the same recipe CLAUDE.md
# gives for every live drive.
#
# The repo root is taken from git, so this works from any directory INSIDE the repository and from
# a copy of the script; the script-relative path is the fallback when git is not there, and a tree
# with no scripts/qa is refused (exit 3) rather than reported as three crashes — which is what a
# copy run from the scratchpad did the first time. A check that CRASHES (missing
# file, syntax error) reports its first "Error:" line, not the Node version banner that ends a
# stack trace — the first version of this script printed the banner and called it the reason.
#
# Run:  bash scripts/qa/run-live-checks.sh
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || ROOT="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)"
cd "$ROOT" || { echo "run-live-checks: cannot find the repository root"; exit 3; }
[ -d scripts/qa ] || { echo "run-live-checks: $ROOT has no scripts/qa — wrong tree"; exit 3; }

run() {  # $1 = check basename ; prints "  ✓/✗ name — verdict" ; returns the check's exit code
  local name="$1" out rc line
  if [ ! -f "scripts/qa/${name}.mjs" ]; then printf '  ✗ %-26s scripts/qa/%s.mjs does not exist\n' "$name" "$name"; return 1; fi
  out="$(env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy timeout 600 node "scripts/qa/${name}.mjs" 2>&1)"; rc=$?
  # the verdict line, if the check printed one; else its first Error line; else its last line
  line="$(printf '%s\n' "$out" | grep -E ' (OK|FAILED|FOUND|COULD NOT RUN)( |$|—)' | tail -1)"
  [ -n "$line" ] || line="$(printf '%s\n' "$out" | grep -E '^(Error|TypeError|SyntaxError|ReferenceError)[: ]' | head -1)"
  [ -n "$line" ] || line="$(printf '%s\n' "$out" | grep -v '^\s*$' | tail -1)"
  line="$(printf '%s' "$line" | cut -c1-140)"
  if [ "$rc" -eq 0 ]; then printf '  ✓ %-26s %s\n' "$name" "$line"; else printf '  ✗ %-26s exit %s — %s\n' "$name" "$rc" "$line"; fi
  return "$rc"
}

echo "live checks against production — $(date -u '+%Y-%m-%d %H:%M UTC') — $ROOT"
bad=0
run check-live-matches-repo   || bad=$((bad+1))
run check-public-surface      || bad=$((bad+1))
run check-live-data-shapes    || bad=$((bad+1))

if [ "$bad" -eq 0 ]; then
  echo "live checks OK — the site serves this repository, nothing answers a caller with no sign-in, and every live record is in a shape the app reads cleanly."
  exit 0
fi
echo "LIVE CHECKS FAILED — ${bad} of 3 did not pass. A sweep is not complete until each of these is green or its failure is written up."
exit 1
