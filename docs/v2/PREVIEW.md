# Preview for the team — the owner's checklist

Go-live is postponed (V609): before day one the owner shows the team a **preview from his own account**. No staff
account is opened for it. Production holds test data until the go-live wipe (V533), so demo records are fine.
This page is the whole preview: what to prepare, what to show in about 15 minutes, and what to leave out.

## The day before (10 minutes)

1. Sign in at www.directksab2b.com with **your employee account** — the one in the Commercial team — not the admin
   account, on the laptop you will present from, in English. The admin account is never in a team (V444), so it can
   hand tasks out but never own one; your own tasks and wins live on your employee account.
2. Check, once, in Settings with the admin account: your employee account and every pilot member are **in a team**
   (without one, a person cannot add a task); the Commercial department's **2026 plan is open** (without it, Log
   achievement asks for an admin); Finance, Pipeline and the other deferred modules are **off** for members and
   managers.
3. Open each screen once so you know it loads: **My day**, **Tasks**, **Clients**, **Past work**, **KPIs ›
   Achievements**.
4. Make three demo records (test data is allowed): one client organisation with one contact; two tasks — one due today,
   one already overdue; one note from a call on My day.
5. Read **Known issues** at the bottom and keep away from those spots.

## The preview (about 15 minutes, three jobs)

The pilot asks three things of everyone: **log my day, run my tasks, record a win.** Show one job at a time.

1. **Log my day — My day.** The day's list: overdue first, then today. Write a short note from a call, then
   **Turn into → reminder** (or a logged call, or an achievement for a win). For a meeting, **Finish meeting** logs
   it on the client.
2. **Run my tasks — Tasks.** **Quick add** a task (title, owner, due date). Switch between **List**, **Board** and
   **Calendar**. Open a task, tick an action item, and show **Escalate** on a stuck one. For managers: **Team** shows
   each person's load.
3. **Clients.** Open the demo client: its page (Overview, Activity, Related) and the details on the right. Log a call
   on it from the page; it shows in Activity at once.
4. **Record a win — the + button › Log achievement.** What was won, for which client, when; it lands under
   **KPIs › Achievements**.
5. **Past work.** Paste a few rows from a spreadsheet into the Past work grid: last month's work goes in at once.
6. **Close (one minute).** Day one is set after this week's testing; a small pilot group starts first, in English;
   Finance, Pipeline and Reports come later; tell the oversight what you would change.

## Leave out

- **Finance, Pipeline, Projects, Overview, Reports, Appraisal and Arabic** — switched off until they are ready, not
  dropped (V517). Finance is being set up with the finance team's rules of 5 Oct.
- **Settings** — not for a team demo.
- **Real client money figures** — none are in the app yet.

## Known issues

From the test round of 7 Oct (QA 1 on desktop, QA 2 at phone width — both on a local copy of the production code;
nothing blocks the three jobs). #188 (7 Oct, 18:12 UTC) fixed most of what it found: a member in no team no longer
sees Task in the + (QA-245), every browser tab names its page (QA-219), and on a phone a long name wraps in the header
and the back links are bigger. Steer around what is left:

- **Turn into** on a note offers a call or meeting, a reminder and, since #175 (7 Oct), an **achievement**; a task
  joins later (#183's database part waits for production's database to be repaired — see #157). Use **Quick add**
  for a task.
- A **member in no team** cannot add a task — every pilot member must be in a team.
- The Clients page's second tab reads **Suppliers** (as signed, V507); its button still reads **New supplier &
  partner** and becomes **New supplier** (QA-247, with #146).

## After the preview

Write down every question or wish the team raised and send the list to the oversight in one message.
