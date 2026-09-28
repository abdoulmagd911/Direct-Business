## 5. Code shipped this session (all live)

- **v32** Finance "Income by service line" (gross = cost + service fee; service fee =
  taxable income). Read-only, no values changed.
- **v33** Leads "Service fit" map (per-service buys-elsewhere / with-Direct / not-a-fit).
  **v39 made it a collapsed one-liner that expands on tap.**
- **v34** Won→Client link: captures the **Direct client ID** (the link key) + linked/
  not-linked banner on clients.
- **v35** Suggested next step per lead stage (calm one-liner, EN+AR).
- **v36** Client profile "managed in Direct": hides the loud duplicate "KSA onboarding"
  button; **v39 folded it into the v34 strip** so a client shows ONE Direct strip.
- **v39** Detail-card tidy: one Direct strip, collapsed service map, dropped duplicate
  "Lifetime billed" from Key facts, trimmed `.ch-sub` helper subtitles.

### ⚠️ Reverted this session — do NOT re-apply blindly
- **v37 + v38 were REMOVED** (commit `1043570`). They hid the "All funnels"/"All stages"
  dropdowns, the "Has app" filter, a duplicate "Needs attention", and a duplicate
  Chain-of-command button. The user said those were **good filters** — they were restored.
  If you re-declutter the Leads toolbar, confirm with him first and check against real data.

---

## 6. Still open / backlog (Leads-focused first, per the user's current scope)

1. **Archive the 201 BNPL junk leads** (on his "archive them"). Highest-impact declutter.
2. **Trim the 23 stale-flag texts.**
3. **Get the Direct Payments client list** (real ~42 clients) — the app can't see it; the
   corporate-portal export is test data. This unlocks correct client classification +
   finance reconciliation + settles any remaining "is X a client" question.
4. **Dedupe** the ~10 duplicate company rows.
5. **Ownership is free text** — 746 leads have no real owner; blocks "show me my leads".
   Needs `assigned_to`/`account_manager` linked to real `app_users`.
6. **Finance values need the user's review** before the team/board leans on them: overall
   ~89% margin, several service lines at 100% because `cost_sar=0`, some duplicate invoice
   numbers. **No finance values were changed** — they're the team's figures, flagged only.
7. Finance Month/Quarter/Year period rollups (parked, touches values under review).

---

## 7. How to work here safely (recap)

- **Verify against REAL data or a screenshot**, never the mock harness alone (§0).
- Data changes: **snapshot first**, change `is_client` AND `raw.isClient` together, keep a
  one-line undo. Live tool the team uses — reversible beats clever.
- Code changes: append a self-contained `try/catch` `<script>` layer at the end of
  `index.html`; don't restructure the middle. Deploy = push dev + fast-forward
  `claude/new-session-9fhlp1`; verify the Vercel deployment goes READY.
- One clear next step at a time; the user is not a developer and has hit many dead ends —
  bias to reducing his workload and keeping everything reversible.

---

## 8. Links & references

- App: https://www.directksab2b.com · PR: `abdoulmagd911/Direct-Business#12`
- Docs to read: `CLAUDE.md`, `docs/BACKLOG.md`, `docs/DIRECT_MASTER_BRIEF.md`,
  `docs/DIRECT_SYSTEMS_MAP.md`, `docs/ROLES_AND_ACCESS.md`, this file.
- Snapshots (admin/manager only): `businesses_snapshot_20260808`,
  `_20260809_clientmove` (batch 1), `_20260809_clientmove2` (batch 2).
- Drive (shared this morning, exports of the real systems — mostly test/HTML dumps):
  "Executive CRM Dashboard" + "Direct Corporate – B2B Admin Panel" folders.
