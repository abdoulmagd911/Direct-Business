#!/usr/bin/env bash
# The document Generator's own battery — the six probes in this folder, run through the main runner
# (same retry-alone rule, same results.txt shape). Revived 2026-09-25 (fire #260): they had crashed
# before boot since 2026-09-24 because their route patterns began with `**host` and Playwright 1.55
# never matches a `**` that is not followed by `/`; every pattern is now `**/host`.
#   scripts/generator-qa/run-all.sh            # 3 at a time, logs under /tmp/generator-qa
#   scripts/generator-qa/run-all.sh -o DIR     # logs elsewhere
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec "$HERE/../qa/run-battery.sh" -j 3 -l "$HERE/battery.txt" -d "$HERE" "$@"
