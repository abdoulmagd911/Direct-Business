import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The repository's shell guard (.claude/hooks/bash-guard.mjs — QA on #110, 29 Sep 17:20; refusals only since the
// owner's rule of 30 Sep): the allow list matches only the start of a command, so this hook reads the whole of it and
// DENIES whatever forces, deletes or bypasses review on a push, throws work away for good, or touches the hosted
// database — with or without "-C <dir>", first flag or last, even hidden inside $( ) or node -e. It never asks: no
// tool call may prompt the owner. Everyday sandbox commands pass to the allow list.
// Sabotage: tests/sabotage/shell-guard-blind.mjs turns this red.
const ROOT = path.resolve(__dirname, '../../../..');
const GUARD = path.join(ROOT, '.claude/hooks/bash-guard.mjs');
const SETTINGS = path.join(ROOT, '.claude/settings.json');

function decide(command: string): 'allow' | 'deny' {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command } });
  const out = execFileSync('node', [GUARD], { input }).toString();
  expect(out, 'the guard never asks').not.toContain('"permissionDecision":"ask"');
  return out.includes('"permissionDecision":"deny"') ? 'deny' : 'allow';
}

describe('the shell guard refuses force, deletion, production and the integration branch — anywhere in the command', () => {
  it.each([
    'git push origin v2/main --force',
    'git push origin +v2/main',
    'git push origin --delete v2/main',
    'git push origin :v2/main',
    'git push -f origin v2/b-x',
    'git push origin v2/b-x -f',
    'git push --force-with-lease origin v2/b-x',
    'git -C . push -f',
    'git -C . push origin v2/main --force',
    'git -C /home/user/Direct-Business push origin +v2/main',
    'git -C . branch -D v2/b-x',
    'git branch -D v2/b-x',
    'git -C . reset --hard',
    'git reset --hard origin/v2/main',
    'git -C . clean -fdx',
    'git clean -f',
    'git filter-branch --all',
    'cd v2 && git push origin v2/main --force',
    'git fetch origin && git push origin +v2/main',
    'git status; git push -f',
    // QA-114: hidden in $( ), backticks or an interpreter, the words are still read
    'echo $(git push --force origin v2/q-1)',
    'echo `git push -f origin v2/q-1`',
    "node -e \"require('child_process').execSync('git push -f origin v2/q-1')\"",
    'python3 -c "import os; os.system(\'git push -f origin v2/q-1\')"',
    'bash -c "git push -f origin v2/q-1"',
    'sh -c "supabase db reset --linked"',
    'git -C . push --mirror origin',
    'git -C . push --prune origin refs/heads/v2/*',
    'git -C . push --all origin',
    'git push origin v2/main',
    'git push -u origin v2/main',
    'git push origin v2/z-x',
    'git push origin v2/architecture-x',
    'git push origin v2/architectures',
    'git push origin v2/a-',
    'git push origin HEAD',
    'git push origin refs/heads/v2/b-x:refs/heads/v2/main',
    'git push origin claude/new-session-9fhlp1',
    'git push -q -u origin claude/new-session-9fhlp1',
    // the hosted database
    'supabase db reset --linked',
    'supabase db push --linked',
    'supabase db push',
    'supabase link --project-ref kimadjvaxgiqzjaukuqg',
    'supabase projects delete kimadjvaxgiqzjaukuqg',
    'supabase db reset --project-ref kimadjvaxgiqzjaukuqg',
    'cd v2 && supabase db reset --linked',
    'env -u HTTPS_PROXY supabase db push --linked',
    'echo $(supabase db reset --linked)',
    "node -e \"require('child_process').execSync('supabase db reset --linked')\"",
  ])('refuses: %s', (cmd) => {
    expect(decide(cmd)).toBe('deny');
  });

  it.each([
    'git push -u origin v2/b-allow-list',
    'git push -q origin v2/b-p3-7',
    'git -C /home/user/Direct-Business push -q -u origin v2/b-x',
    'git push origin v2/b-p3-7',
    // every lane pushes its own branches: the guard ships in every checkout (the architect on #127, 30 Sep)
    'git -C . push origin v2/a-p3-15',
    'git push -u origin v2/c-ar-for-127',
    'git push -q origin v2/q-round-15',
    'git push origin v2/architecture',
    'git push -q -u origin v2/architecture',
    'git commit -F -',
    'node scripts/sabotage.mjs --only x',
    'python3 scripts/qa/check.py',
    'git -C . status --short',
    'git -C . log --oneline -3',
    'git fetch origin v2/main',
    'git checkout -q -b v2/b-x origin/v2/main',
    'git merge --no-edit origin/v2/main',
    'git add v2/src && git commit -q -m "x"',
    'git branch --show-current',
    'git worktree add /tmp/x v2/b-x',
    'supabase db reset',
    'supabase start',
    'pnpm build',
    'pnpm test:e2e --workers=3',
    'pnpm exec prettier --write x.ts',
    'pnpm install --frozen-lockfile',
    'docker ps',
    'curl -sf -H "Authorization: Bearer x" https://api.github.com/x',
    'rm -rf /tmp/claude-0/x',
    // everyday sandbox commands (owner, 30 Sep): rm, find, installs, one-line scripts, docker, the local supabase
    'rm -rf node_modules/.cache',
    'find . -name "*.png"',
    'find /home/user/repo -name "*.tmp" -delete',
    'find . -name "*.log" | xargs rm',
    'npx some-package',
    'pnpm dlx some-package',
    'pnpm add left-pad',
    'pnpm install left-pad',
    'docker run --rm alpine sh',
    'docker pull alpine',
    'node -e "console.log(1)"',
    'python3 -c "print(1)"',
    'bash -c "ls"',
    "python3 - <<'EOF'\nimport os\nEOF",
    'echo $(git status --short)',
    'curl -sf https://example.test/x.sh | bash',
    'git checkout -- .',
    'git -C . checkout -- v2/src',
    'git worktree remove /tmp/x',
    'git stash drop',
    'git restore v2/src/x.ts',
  ])('leaves an everyday command to the allow list: %s', (cmd) => {
    expect(decide(cmd)).toBe('allow');
  });
});

describe('the allow list itself: no ask rule, the dangerous families denied, pushes explicit', () => {
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8')) as {
    permissions: { allow: string[]; ask: string[]; deny: string[] };
    hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] };
  };
  it('has no ask rule at all — nothing prompts the owner', () => {
    expect(settings.permissions.ask).toEqual([]);
  });
  it('never allows a whole push family; pushes are explicit, non-forced, to a lane branch', () => {
    for (const broad of ['Bash(git push:*)', 'Bash(git push origin v2/:*)', 'Bash(git push -u origin v2/:*)'])
      expect(settings.permissions.allow, broad).not.toContain(broad);
    for (const a of settings.permissions.allow)
      if (a.startsWith('Bash(git push'))
        expect(
          a,
          "pushes are explicit, non-forced, to a lane's v2/<a|b|c|d|e|q>-* branch, v2/architecture or the old app's claude/* work branches",
        ).toMatch(
          /^Bash\(git push (-q )?(-u )?origin ((v2\/(a|b|c|d|e|q)-|claude\/(?!new-session-9fhlp1))[\w-]*:\*|v2\/architecture)\)$/,
        );
  });
  it('denies the dangerous families outright', () => {
    for (const d of [
      'Bash(supabase db reset --linked:*)',
      'Bash(supabase db push:*)',
      'Bash(supabase link:*)',
      'Bash(supabase projects delete:*)',
      'Bash(git push --force:*)',
      'Bash(git push -f:*)',
      'Bash(git push --delete:*)',
      'Bash(git push origin v2/main:*)',
      'Bash(git push origin claude/new-session-9fhlp1:*)',
      'Bash(git reset --hard:*)',
      'Bash(git clean:*)',
      'Bash(git branch -D:*)',
      'mcp__Supabase__deploy_edge_function',
      'mcp__Supabase__pause_project',
      'mcp__Gmail__send_message',
      'mcp__Gmail__forward',
      'mcp__Gmail__reply',
    ])
      expect(settings.permissions.deny, d).toContain(d);
  });
  it('allows the everyday sandbox commands', () => {
    for (const a of [
      'Bash(rm:*)',
      'Bash(find:*)',
      'Bash(npx:*)',
      'Bash(docker:*)',
      'Bash(supabase:*)',
      'Bash(node -e:*)',
    ])
      expect(settings.permissions.allow, a).toContain(a);
  });
  it('runs the shell guard before every Bash call', () => {
    const bash = settings.hooks.PreToolUse.find((h) => h.matcher === 'Bash');
    expect(bash?.hooks.map((h) => h.command)).toContain('node .claude/hooks/bash-guard.mjs');
  });
});
