// @ts-check
// Where the QA sweep keeps what a run makes: the stack's copy of v2/supabase, the settings, the fixtures (made-up
// people with made-up passwords), the logs and the screenshots. Outside the repository on purpose, so a run never
// dirties the tree or the format and rule-7 checks; only results.json is written next to the specs (git-ignored).
//
// A second, independent sweep (its own stack, app port and run folder, so it never meets the first one's database or
// build) is chosen with environment settings; unset, every default below is the QA lane's first stack:
//   QA_RUN_DIR=~/.cache/direct-qa-sweep2  QA_APP_PORT=9612  QA_STACK_PROJECT=direct-commercial-qa2
//   QA_STACK_PORT_BASE=9640 (the stack on 9640–9649)  QA_RESULTS_JSON=<file>  QA_APP_DIR=<a copy of v2 to build>
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SWEEP_DIR = dirname(fileURLToPath(import.meta.url));
export const V2_DIR = join(SWEEP_DIR, '..', '..', '..');
export const RUN_DIR =
  process.env.QA_RUN_DIR || join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'direct-qa-sweep');
export const STACK_DIR = join(RUN_DIR, 'stack');
export const ENV_FILE = join(RUN_DIR, 'env');
export const FIXTURES_FILE = join(RUN_DIR, 'fixtures.json');
export const RESULTS_LINES = join(RUN_DIR, 'results.jsonl');
export const RESULTS_JSON = process.env.QA_RESULTS_JSON || join(SWEEP_DIR, 'results.json');
export const SHOTS_DIR = process.env.QA_SHOTS || join(RUN_DIR, 'shots');
export const APP_PORT = Number(process.env.QA_APP_PORT || 9610);
export const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
/** The stack's docker project and its ports: base + 0 shadow, 1 API, 2 database, 3 studio, 4 mail, 7 analytics, 9 pooler. */
export const STACK_PROJECT = process.env.QA_STACK_PROJECT || 'direct-commercial-qa';
export const STACK_PORT_BASE = Number(process.env.QA_STACK_PORT_BASE || 9620);
