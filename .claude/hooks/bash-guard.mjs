#!/usr/bin/env node
/* bash-guard.mjs — runs before every shell command a Claude session makes (PreToolUse on Bash). The allow list in
   .claude/settings.json matches only the START of a command, so a flag placed later ("git push origin v2/main --force",
   "git -C . push -f") or a compound command could slip past the ask rules (QA on #110, 29 Sep 17:20). This guard reads
   the WHOLE command, every segment of it (split on && || ; | and newlines, "-C <dir>" or not), and:
     · DENIES what touches the hosted database outside sql-guard: supabase db reset --linked, db push (to the linked
       project), link, projects delete, and any supabase call naming --linked or --project-ref;
     · ASKS before anything that rewrites or throws away history or work: --force / -f / --force-with-lease, a
       +<refspec>, --delete or a :<branch> refspec on a push, branch -D, reset --hard, clean -f, checkout -- <path>,
       restore --source / restore ., worktree remove, stash drop|clear, rm -r outside /tmp;
     · ASKS before remote code is fetched and run: curl/wget piped into anything, npx, pnpm dlx, pnpm add/install of
       a named package, docker run/pull/compose.
   Anything the guard cannot read is asked, never waved through. The rules are pure (decide()) so a unit test proves
   each of the QA's strings: v2/tests/unit/guard/the-shell-guard-asks-before-force-and-production.test.ts. */

/** The command's segments: each simple command, whatever joins them. */
export function segmentsOf(command) {
  return String(command)
    .replace(/\\\n/g, ' ')
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const git = (s) => /(^|\s)git\s/.test(` ${s} `) || /^git\s/.test(s) || /^(sudo\s+)?git\s/.test(s);

/** Why a command is denied, asked, or null when the allow list may decide. */
export function decide(command) {
  const whole = String(command);
  const segs = segmentsOf(whole);
  if (!segs.length) return { decision: 'ask', reason: 'bash-guard: could not read the command' };
  for (const s of segs) {
    /* ---- the hosted database: denied outright ---- */
    if (/^supabase\b/.test(s) || /(^|\s)supabase\s/.test(s)) {
      if (/\bdb\s+reset\b[^]*--linked/.test(s)) return { decision: 'deny', reason: 'bash-guard: supabase db reset --linked wipes the hosted database' };
      if (/\bdb\s+push\b/.test(s) && !/--local\b/.test(s)) return { decision: 'deny', reason: 'bash-guard: supabase db push changes the hosted database outside sql-guard' };
      if (/\blink\b/.test(s)) return { decision: 'deny', reason: 'bash-guard: supabase link points this checkout at a hosted project' };
      if (/\bprojects\s+delete\b/.test(s)) return { decision: 'deny', reason: 'bash-guard: supabase projects delete' };
      if (/--linked\b|--project-ref\b|--db-url\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: a supabase call naming the hosted project — the owner decides' };
    }
    /* ---- history and work thrown away: asked ---- */
    if (git(s)) {
      if (/\s(--force|--force-with-lease|--force-if-includes)\b/.test(s) || /\s-[a-zA-Z]*f[a-zA-Z]*(\s|$)/.test(s))
        return { decision: 'ask', reason: 'bash-guard: a forcing flag on a git command (--force / -f) — never unprompted' };
      if (/\bpush\b/.test(s)) {
        if (/\s\+\S/.test(s)) return { decision: 'ask', reason: 'bash-guard: a +refspec on git push forces the branch' };
        if (/\s--delete\b|\s-d\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git push --delete removes a branch on the remote' };
        if (/\s:\S/.test(s) || /\s\S+:\S+(\s|$)/.test(s.replace(/\S+:\/\/\S+/g, ''))) return { decision: 'ask', reason: 'bash-guard: a refspec with a colon on git push (deletes or renames on the remote)' };
        if (/\bclaude\/new-session-9fhlp1\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: a push to production (claude/new-session-9fhlp1) — the owner decides' };
      }
      if (/\bbranch\b[^]*\s-[a-zA-Z]*D/.test(s)) return { decision: 'ask', reason: 'bash-guard: git branch -D throws a branch away' };
      if (/\breset\b[^]*--hard/.test(s) || /\breset\s+--merge\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git reset --hard throws work away' };
      if (/\bclean\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git clean removes files' };
      if (/\bcheckout\s+(-[a-zA-Z]+\s+)*--\s/.test(s) || /\bcheckout\s+\.(\s|$)/.test(s)) return { decision: 'ask', reason: 'bash-guard: git checkout -- <path> throws edits away' };
      if (/\brestore\b/.test(s) && !/--staged\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git restore throws edits away' };
      if (/\bworktree\s+remove\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git worktree remove' };
      if (/\bstash\s+(drop|clear)\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: git stash drop/clear throws work away' };
      if (/\b(rebase|filter-branch|filter-repo|replace)\b/.test(s) && /\b(rebase\s+-i|filter-branch|filter-repo|replace)\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: history rewriting' };
    }
    if (/^(sudo\s+)?rm\s/.test(s) && /\s-[a-zA-Z]*r/.test(s) && !/\s\/tmp\//.test(s)) return { decision: 'ask', reason: 'bash-guard: rm -r outside /tmp' };
    /* ---- remote code fetched and run: asked ---- */
    if (/^(sudo\s+)?(npx|pnpx)\b/.test(s) || /(^|\s)(npx|pnpx)\s/.test(s)) return { decision: 'ask', reason: 'bash-guard: npx fetches and runs a package' };
    if (/\bpnpm\s+(dlx|add|i|install|update|up|remove|rm|link|patch)\b/.test(s) && !/\bpnpm\s+install(\s+--frozen-lockfile|\s+--offline)+(\s|$)/.test(s))
      return { decision: 'ask', reason: 'bash-guard: pnpm fetching or changing packages' };
    if (/^(sudo\s+)?docker\s+(run|pull|compose|build|push|login|system\s+prune|rm|rmi)\b/.test(s)) return { decision: 'ask', reason: 'bash-guard: docker fetching or removing' };
  }
  /* curl or wget whose output goes somewhere else (a pipe, a redirect into a script, --output then run) */
  const pieces = whole.split(/&&|\|\||;|\n/);
  for (const p of pieces) {
    if (/(^|\s)(curl|wget)\s/.test(p) && /\|/.test(p)) return { decision: 'ask', reason: 'bash-guard: curl/wget piped into another command runs what it fetched' };
    if (/(^|\s)(curl|wget)\s[^]*\s(bash|sh|node|python3?)\b/.test(p) && /<\(|\$\(/.test(p)) return { decision: 'ask', reason: 'bash-guard: curl/wget fed into an interpreter' };
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    const answer = (decision, reason) => {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }));
      process.exit(0);
    };
    let ev;
    try {
      ev = JSON.parse(raw || '{}');
    } catch (_) {
      return answer('ask', 'bash-guard: could not read the call — asking instead of guessing');
    }
    const cmd = String((ev.tool_input || {}).command || '');
    if (!cmd) return answer('ask', 'bash-guard: no command text found in the call');
    const d = decide(cmd);
    if (d) return answer(d.decision, d.reason);
    process.exit(0);
  });
}
