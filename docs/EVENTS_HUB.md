# KSA Events Hub — how we use it

The events page (`events/index.html`, live at /events) is not just a calendar. Every
event carries **"Our move"** — what Direct does with it:

| Move | Meaning | Stored as |
|---|---|---|
| **Have a stand** | Book a booth and sell from it | `approach = 'stand'` |
| **Go & meet** | Attend in person, walk the floor, collect leads | `approach = 'attend'` |
| **Mine the website** | Don't travel. Sign up online, pull the exhibitor / companies list and the contacts published on the event's official site | `approach = 'mine'` |
| **Skip** | Not for us (no edition this year, duplicate entry, wrong audience) | `approach = 'skip'` |
| **Not decided** | Default until someone makes the call | `approach = 'undecided'` |

Each event also carries **Progress** (`approach_status`: not_started → signed_up →
in_progress → leads_added → done) and a **Companies list link**
(`exhibitor_list_url`) — the page on the event's site where the exhibitor list or
registry lives, filled in once someone signs up.

All three columns were added to `ksa_events` on 2026-08-12 (migration
`ksa_events_our_move`). They are plain text with defaults, so the main app and the
`ksa-events-hub` edge function are unaffected.

## The first classification (2026-08-12)

All 39 events were classified in one pass — suggestions, changeable per event with
the Edit button:

- **Have a stand (3):** Saudi Event Show, International MICE Summit, Business Travel
  Roadshow — rooms full of exactly Direct's buyers (event companies, MICE planners,
  corporate travel managers).
- **Go & meet (12):** the big corporate-footfall events (LEAP, Cityscape, Biban,
  Black Hat MEA, Money20/20, GAIN) and the key travel-industry rooms (WTM Spotlight,
  Hotel & Hospitality Expo, AERO, Global Airports Forum, Air Cargo Expo, Hajj
  Conference).
- **Mine the website (17):** conferences and expos whose sponsor/exhibitor lists are
  published online — including both Dubai events (MEES, ATM), the mid-size Riyadh tech
  conferences, the education fairs with dates (GESS, MEETES), and the Asian Indoor
  Games (delegations via the official site).
- **Skip (2):** Back to school (likely a duplicate of GESS), TOURISE (no 2026 edition).
- **Not decided (5):** the five study-vertical entries with no date and no link —
  nothing to act on yet.

## Team sign-in, event-site logins, and lead counts (added 2026-08-12)

The page has two faces:

- **Signed out (anyone with the link):** sees the calendar and the moves. Cannot save —
  this was always true in the database (`ksa_events` writes need a signed-in user), but
  the page used to fail silently; now the Save/Delete buttons open the sign-in dialog.
- **Signed in (Team sign-in button, same login as the main app):** can edit, and sees two
  extra things per event — the **event-site login** and the **lead count**.

**Event-site logins** (the account made on the event's own website to reach its exhibitor
list) live in their own table, `ksa_event_signups` (migration
`ksa_event_signups_team_only`): email used, password, who signed up. It has **no public
access** — only signed-in team members can read or write it, so nothing about it ever
reaches the public page. It is deliberately team-shared: anyone signed in sees the
passwords, so use throwaway passwords for event sites, never personal ones. Passwords are
also excluded from the CSV export.

On directksab2b.com the sign-in is shared with the main app automatically (same browser,
same login). On preview links, use the Team sign-in button.

**Lead counts:** each event row shows "N leads in the app" — a live count of `businesses`
rows whose Outreach & Network field `funnel_details->>'event_name'` matches the event's
English name (case/spacing-insensitive). Convention: when logging a lead from an event,
put the event's **exact English name** from this page in the lead's "Event / conference"
field, and the count links up by itself. (As of 2026-08-12, zero leads had this field
filled — the 63 Outreach leads predate the convention.)

## Where mined leads go

Leads collected from events belong in the **Outreach & Network funnel** in the main
app (fields: Where we found them · Event · Event date · Booth/meeting · Planned
approach). Set Progress to "Leads collected" on the event once they are in.

## Testing

`node scripts/qa/events-sweep.mjs` drives the page headless with a stubbed Supabase
module (the sandbox cannot reach supabase.co or esm.sh) — renders the table, exercises
the Our-move filter, the edit/add modal, sorting, and the mobile layout, and saves
screenshots next to the script. Look at the screenshots, not just the console output.
