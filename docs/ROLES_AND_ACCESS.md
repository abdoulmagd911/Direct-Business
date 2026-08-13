# Roles, logins and access — proven by rehearsal, 2026-08-13

Not read from the code, and not assumed: five employees and one admin **signed in for real,
worked the live app, and tried to do what they must not do**. Every line below was measured
twice — once on screen, once against the database with that person's own login.

## The people who can sign in

| Email | Name | Arabic | Short | Role | Active |
|---|---|---|---|---|---|
| `business@directksa.com` | Abdulrahman Aboelmagd | عبدالرحمن أبوالمجد | Abdelrahman | **admin** | yes |
| `aboelmagd@directksa.com` | Abdulrahman Aboelmagd | عبدالرحمن أبوالمجد | Abdelrahman | **admin** | yes |
| `test@directksa.com` | QA Test Account | حساب الاختبار | QA | **admin** | yes (testing only) |
| `osharafi@direct-visa.net` | Othman Al Sharafi | عثمان الشرفي | Othman | **manager** | yes |
| `raad.elkhair@directksa.com` | Raad Awad | رعد عوض | Raad | **bd** | yes |
| `kareem.medhat@directksa.com` | Kareem Medhat | كريم مدحت | Kareem | **operations** | yes |
| `assem.alsweed@directksa.com` | Assem Alsweed | عاصم السويد | Assem | **team_member** | yes |
| `mohammed.altuwaijri@directksa.com` | Mohammed Altuwaijri | محمد التويجري | Mohammed | **viewer** | yes |
| `ahmed.aboelmagd@directksa.net` | Ahmed Abo El Magd | أحمد أبوالمجد | Ahmed | team_member | yes |
| `abdulaziz.alreshody@directksa.com` | Abdul Aziz Alreshody | عبدالعزيز الرشودي | Abdulaziz | team_member | yes |
| `a.hassan@directksa.net` | Abdelrahman Hasan | عبدالرحمن حسن | — | team_member | yes |

Roles are changed in one click: profile chip (top right) → **Team**.

## What each role may do — verified on 2026-08-13

**Everyone signed in can READ everything.** That is deliberate: this is an internal tool for
one company, and hiding numbers between colleagues only creates work. Writing is what differs.

| | admin | manager | business dev | operations | team member | read-only |
|---|---|---|---|---|---|---|
| Leads & clients (add, edit, stage, owner) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Proposals | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Requests & bookings | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Logging activity on any company | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Finance: invoices, expenses, targets, import | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Promo codes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Company settings page | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Team & page access | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Both walls agree: the screen only offers what the person may do, **and** the database refuses
the rest even if someone bypasses the screen entirely (measured: 60 write attempts across six
roles and nine tables, every one landed exactly as the table above says).

## How a new person gets in — the whole process

1. Admin: profile chip → **Team** → type their email, name, pick a role → **Add**.
2. The screen shows a **temporary password**. Send it to them.
3. They sign in, and the app immediately makes them **choose their own password**
   (at least 8 characters, typed twice). From then on it is theirs alone.
4. Nothing else. No invitations to accept, no email links to click, no setup screens.

Forgotten password: admin → Team → **Reset password** → hand over the new temporary one.
Someone leaves: admin → Team → switch them **off**. They keep no access, and their work stays.

## Landmines fixed on 2026-08-13 (do not reintroduce)

- **`clear_must_change` used to be admin-only.** Every employee who changed their password on
  first sign-in was asked for it again on *every* sign-in, forever. It is now self-service
  (it only ever touches the caller's own row). Anyone who re-gates it traps the whole team.
- **The app used to appear before it knew who you were.** Permissions applied a second late,
  so a read-only person saw full-power buttons and someone owing a password change could
  start working first. The app is now revealed only after the role check passes, with a
  9-second failsafe so a network hiccup can never lock anybody out.
- **The signed-in person's name was stored in the ONE shared settings row.** Whoever signed in
  last overwrote everybody else — which is exactly why "Mine" kept showing another person's
  work. Identity is per-session now and never written to shared storage.
- **Proposals, requests, bookings and settings accepted writes from anyone signed in**,
  including the read-only account. They are now scoped to the roles in the table above.
- **The Settings page was reachable by anyone who forced it** (the sidebar link was merely
  hidden). It is now refused for non-admins with a plain explanation.

## How to re-prove all of this in one command

    cd scripts/qa
    NODE_USE_ENV_PROXY=1 node probe-rls-matrix.mjs    # the database wall: 60 checks
    NODE_USE_ENV_PROXY=1 node probe-roles.mjs         # six people working: 83 checks
    NODE_USE_ENV_PROXY=1 node probe-firstlogin.mjs    # first sign-in for five people: 40 checks
    NODE_USE_ENV_PROXY=1 node probe-teamwork.mjs      # hand-over + two people at once: 8 checks

`emp-rig.mjs` holds the logins used for testing. **Reset those passwords from the Team screen
before handing accounts to the real people.**
