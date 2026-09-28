import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeCtx, runCheck, type Check, type Finding } from '../../../scripts/checks/lib.mjs';

/** A throwaway folder (outside any git repository) holding the given files. */
export function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v2-check-'));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
  return root;
}

export async function findings(
  check: Check,
  root: string,
  env: Record<string, string | undefined> = {},
): Promise<Finding[]> {
  return runCheck(check, makeCtx(root, env));
}

/** Runs git in a fixture folder with a made-up identity. */
export function git(root: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.email=test@example.com', '-c', 'user.name=Test', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  ).toString();
}
