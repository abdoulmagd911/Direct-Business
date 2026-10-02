#!/usr/bin/env node
/* bash-guard.mjs — runs before every shell command a Claude session makes (PreToolUse on Bash). The allow list in
   .claude/settings.json matches only the START of a command, so a flag placed later ("git push origin v2/main --force",
   "git -C . push -f") or a compound command could slip past it (QA on #110, 29 Sep 17:20). This guard reads the WHOLE
   command, every segment of it (split on && || ; | and newlines, "-C <dir>" or not), and DENIES — never asks (the
   owner's rule of 30 Sep: no tool call may prompt him; what needs his word goes to the oversight in chat):
     · what touches the hosted database outside sql-guard: supabase db reset --linked, db push (to the linked
       project), link, projects delete, and any supabase call naming --linked, --project-ref or --db-url;
     · a push that forces, deletes or rewrites (--force / -f / --force-with-lease, a +<refspec>, --delete, a
       :<branch> refspec, --mirror / --prune / --all / --tags), a push to production (claude/new-session-9fhlp1), to
       v2/main, to a branch outside the five lanes (v2/a-*, v2/b-*, v2/c-*, v2/q-*, v2/architecture) or to a raw ref —
       the integration branch and production land by PR;
     · work thrown away for good: branch -D, reset --hard / --merge, clean, filter-branch / filter-repo.
   Everyday sandbox commands (rm, find, installs, one-line scripts, docker, the local supabase) are the allow list's
   and pass. The deny checks read the raw text, so a forced push hidden in $( ) or in node -e is still refused.
   Anything the guard cannot read at all is refused, never waved through. The rules are pure (decide()) so a unit test
   proves each string: v2/tests/unit/guard/the-shell-guard-refuses-force-and-production.test.ts. */

/** The command's segments: each simple command, whatever joins them. */
export function segmentsOf(command) {
  return String(command)
    .replace(/\\\n/g, ' ')
    .split(/&&|\|\||;|\||\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// `git` at the start, after whitespace, or after $( ' " ` — a push hidden in a subshell or in node -e is read too
/** The five lanes' work branches (the architect, 30 Sep): builders A, B and C, QA, and the architecture branch. */
export const LANE_BRANCH = /^v2\/(?:(?:a|b|c|d|e|q)-[\w.-]+|architecture)$/;

const git = (s) => /(^|[\s(`'"])git\s/.test(` ${s} `) || /^(sudo\s+)?git\s/.test(s);

/** Why a command is denied, asked, or null when the allow list may decide. */
export function decide(command) {
  const deny = (reason) => ({ decision: 'deny', reason: `bash-guard: ${reason}` });
  const whole = String(command);
  const segs = segmentsOf(whole);
  if (!segs.length) return deny('could not read the command — refused, never waved through');
  for (const s of segs) {
    /* ---- the hosted database: refused outright ---- */
    if (/^supabase\b/.test(s) || /(^|[\s(`'"])supabase\s/.test(s)) {
      if (/\bdb\s+reset\b[^]*--linked/.test(s)) return deny('supabase db reset --linked wipes the hosted database');
      if (/\bdb\s+push\b/.test(s) && !/--local\b/.test(s)) return deny('supabase db push changes the hosted database outside sql-guard');
      if (/\blink\b/.test(s)) return deny('supabase link points this checkout at a hosted project');
      if (/\bprojects\s+delete\b/.test(s)) return deny('supabase projects delete');
      if (/--linked\b|--project-ref\b|--db-url\b/.test(s)) return deny('a supabase call naming the hosted project — refused; the hosted database changes by migration through the oversight');
    }
    /* ---- pushes that force, delete or bypass review; work thrown away for good: refused ---- */
    if (git(s)) {
      if (/\bpush\b/.test(s)) {
        if (/\s(--force|--force-with-lease|--force-if-includes)\b/.test(s) || /\s-[a-zA-Z]*f[a-zA-Z]*(\s|$)/.test(s))
          return deny('a forcing flag on git push (--force / -f) — refused; history on a shared branch is never rewritten');
        if (/\s--(mirror|prune|all|tags|delete-branch)\b/.test(s)) return deny('git push --mirror / --prune / --all / --tags rewrites or removes remote branches — refused');
        if (/\s\+\S/.test(s)) return deny('a +refspec on git push forces the branch — refused');
        if (/\s--delete\b|\s-d\b/.test(s)) return deny('git push --delete removes a branch on the remote — refused');
        if (/\s:\S/.test(s) || /\s\S+:\S+(\s|$)/.test(s.replace(/\S+:\/\/\S+/g, ''))) return deny('a refspec with a colon on git push (deletes or renames on the remote) — refused');
        if (/\bclaude\/new-session-9fhlp1\b/.test(s)) return deny('a push to production (claude/new-session-9fhlp1) — refused; production lands by PR merge');
        // only the lanes' own work branches go up — builders A, B, C, QA and the architect (the guard ships in every
        // checkout, so it admits all five); v2/main lands by PR merge, production too
        const refs = s.replace(/\S+:\/\/\S+/g, '').split(/\s+/).filter((w) => /^(v2|claude)\//.test(w) || /^refs\//.test(w) || w === 'HEAD');
        if (refs.some((r) => !LANE_BRANCH.test(r) && !/^claude\/(?!new-session-9fhlp1)[\w.-]+$/.test(r)))
          return deny('a push to v2/main, a branch outside the five lanes or a raw ref — refused; the integration branch lands by PR');
        if (!refs.length && !/\s(-u|--set-upstream)\s/.test(s)) return deny('a push naming no lane branch — refused; name the v2/<lane>-* branch');
      }
      if (/\bbranch\b[^]*\s-[a-zA-Z]*D/.test(s)) return deny('git branch -D throws a branch away — refused; a branch is deleted by the oversight after its PR merges');
      if (/\breset\b[^]*--hard/.test(s) || /\breset\s+--merge\b/.test(s)) return deny('git reset --hard throws work away — refused; commit or stash instead');
      if (/\bclean\b/.test(s)) return deny('git clean removes files — refused; name the files to remove');
      if (/\b(filter-branch|filter-repo)\b/.test(s)) return deny('history rewriting (filter-branch / filter-repo) — refused');
    }
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
      return answer('deny', 'bash-guard: could not read the call — refused instead of guessing');
    }
    const cmd = String((ev.tool_input || {}).command || '');
    if (!cmd) return answer('deny', 'bash-guard: no command text found in the call — refused');
    const d = decide(cmd);
    if (d) return answer(d.decision, d.reason);
    process.exit(0);
  });
}
