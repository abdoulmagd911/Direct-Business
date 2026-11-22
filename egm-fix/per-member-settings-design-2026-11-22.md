# Per-member settings — design for approval (22 Nov 2026)

**APPROVED by him, 22 Nov 2026 (voice call) — he said "Yes" to Rocky's recommendation. Build as the next landing after the sweep fix round is fully settled. (Updated 22 Nov 2026, by Rocky.)**

## The idea (his words, 21 Nov 14:48)

Each member does everything for their OWN clients, including finance. Importing files and editing someone else's work is EXTRA — a specific role, not for every member. And each member can have their own settings for what they can do, edit, or only view.

So: roles set the basics (once per role), and per-member settings give a specific person extra access — or restrict them — when needed.

## Roles — the basics (set once per role)

These are the basics, already confirmed live by the sweep (21 Nov):

- Member: sees Finance, adds and edits Finance for their OWN clients. Can add, edit and delete anything for their own clients. Cannot import files. Cannot edit someone else's work. Cannot change credit limits.
- Commercial: same as Member for Finance and their own clients.
- Manager: same as Member, plus sees and manages their team's work.
- Head: same as Manager, plus can import files and change credit limits.
- Admin: everything, including all settings.
- Viewer (view-only): sees everything, edits nothing — including Finance.

## Per-member settings — the extras (set per person)

On each person's record in Settings → People & access, a new section: "Extra access for this person."

For each of the three extra areas, the person is set to one of three choices:

| Area | "As their role" (default) | "Allowed" (extra) | "View only" (restricted) |
| --- | --- | --- | --- |
| Import files on Finance | Only Admin + Head can import | This person can import too | This person cannot import (even if their role allows it) |
| Edit someone else's work | Only Admin + Head | This person can edit others' work too | This person cannot edit others' work |
| Change credit limits | Only Admin + Head | This person can change credit limits too | This person cannot change credit limits |

The clearest example is Abdurrahman himself: he is a Member, but he is responsible for the monthly review and the finance details, so he gets "Allowed" on Finance import — and whatever he imports or edits on Finance reflects everywhere else (achievements, tasks, reports, client details), because everything is connected.

## Rules the design keeps

- An override only changes that one person. It never changes what the role gives everyone else.
- A Viewer stays view-only. No override turns a Viewer into an editor — if a Viewer needs to edit, their role changes instead.
- Import and credit-limit change stay a specific role (Admin + Head) by default. An override gives it to a specific person, not to every member.
- Members still own their own clients, including finance. Nothing about that changes.
- The money figures (revenue, cost, profit) do not change. This is about who can do what, not about the numbers.
- Every change to a person's settings is written in the Settings log (who changed it, when), so it can be checked later.

## Where it lives

Settings → People & access → open a person's record → "Extra access for this person" (three rows, one per area, each with the three choices above, and a note showing who set it and when).

## What happens when he approves

The session builds it as the next landing: the three rows on each person's record, the checks that enforce them (import, edit-others, credit-limit), and a test that a Member with the Finance-import extra can import while a Member without it cannot — and that a Viewer still cannot edit anything.

## Approval — APPROVED 22 Nov 2026 (voice call)

He said "Yes" to Rocky's recommendation. Build as the next landing after the sweep fix round is fully settled.

## Reading confirmed for the build (23 Nov 2026, relayed by Rocky)

A Manager keeps managing their team's work exactly as today. The "Edit someone else's work" row only governs editing work outside what the person's role already gives them: "View only" on that row does not take away a Manager's team editing. The role basics stay as they are; the three rows only add or restrict the extras.
