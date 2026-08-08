# Roles, logins and access — verified 2026-08-08

Read straight from the live database, not from the code or the brief.

## Who can sign in today

| Email | Role | Active | Last sign-in | Name on file |
|---|---|---|---|---|
| `aboelmagd@directksa.com` | **admin** | yes | 2026-07-25 | *(blank)* |
| `osharafi@direct-visa.net` | **manager** | yes | 2026-07-07 | Othman Al Sharafi |
| `a.hassan@directksa.net` | **team_member** | yes | 2026-08-08 | *(blank)* |
| `test@directksa.com` | **admin** | yes | never | QA Test Account |

All four are confirmed, each has a sign-in identity, and each links correctly to an
`app_users` row. No orphans, nothing broken.

- `business@directksa.com` is allow-listed as **admin** but has **no login yet**. Whoever
  signs up with that address is auto-provisioned admin and active.
- Two accounts have a **blank full name**, so the app falls back to the email prefix and
  shows "aboelmagd" / "a.hassan" in the sidebar and the Today greeting. Worth filling in.

## The six roles and what each can actually do

Access is decided by `app_role()`, which returns the role **only if `active` is true**.
Switch someone off and `app_role()` returns nothing — every role-gated rule then denies.

| | admin | manager | bd | operations | team_member | viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Read leads, contacts, activities, funnels, finance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Edit leads** (`businesses`) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Edit contacts** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Log activities | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Save the workspace (bookings, invoices, offers, requests, settings) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Edit finance invoices** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Change funnels** (rename, field templates) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage users and the allow-list** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Two oddities worth a decision, not bugs as such:

1. **`operations` cannot edit leads or contacts**, but *can* save the workspace blob — which
   is where bookings, invoices, offers and requests live. Probably intentional (ops handles
   bookings, not the pipeline), but it means an ops person cannot correct a client's phone
   number.
2. **Everyone who can read anything can read everything**, including `viewer`. All read
   rules are just `app_role() IS NOT NULL`. A viewer sees every lead and all 176 finance
   invoices with revenue, cost and profit.

## Five tables that ignore roles completely

These are written as "any signed-in user", so they never call `app_role()`. That means a
`viewer` — **and a user switched off, since deactivation only stops `app_role()`** — still
has full access:

| Table | What it exposes |
|---|---|
| `master_db_companies` | the company registry (VAT, IBAN, licence numbers) |
| `app_state_bak` | full workspace backups — read **and delete** |
| `generated_documents` | read, insert, update |
| `ksa_events` | full read/write |
| `share_links` | read existing share tokens **and mint new ones** |

**This is the thing to fix when the roles work starts.** Turning someone off today does not
actually cut their access — it only stops the role-gated half.

## Page-level permissions are decoration

`app_users.allowed_pages` exists and the app honours it when drawing the screen, but no
database rule enforces it. The same is true of `must_change_password`: it is a flag the
screen respects, and the user can clear it themselves. Neither is a real boundary.

## What a proper authority model would need

1. Make deactivation absolute — bring those five tables under `app_role()`.
2. Decide whether `viewer` should see money. Right now it does.
3. Give `operations` edit rights on contacts if they are expected to correct client details.
4. Replace free-text `assigned_to` with a real link to `app_users`, so "my leads" and
   per-person restrictions become possible. Nothing owner-based can be built until then.
5. Enforce `allowed_pages` in the database, or drop it so it stops implying safety.
