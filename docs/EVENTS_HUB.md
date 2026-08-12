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

## Where mined leads go

Leads collected from events belong in the **Outreach & Network funnel** in the main
app (fields: Where we found them · Event · Event date · Booth/meeting · Planned
approach). Set Progress to "Leads collected" on the event once they are in.

## Testing

`node scripts/qa/events-sweep.mjs` drives the page headless with a stubbed Supabase
module (the sandbox cannot reach supabase.co or esm.sh) — renders the table, exercises
the Our-move filter, the edit/add modal, sorting, and the mobile layout, and saves
screenshots next to the script. Look at the screenshots, not just the console output.
