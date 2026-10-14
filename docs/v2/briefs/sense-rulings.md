# Look and layout: the sense-check rulings, one list (design lead, 14 Oct)

The owner's PC walk, the oversight's phone walk (375 px, production), QA 2's QA-563 and QA-565, and builder S's loading bar (#250), all in one list.
Rule for every item: fewer controls, never more (V633). Wide screen is 1,440 px; Arabic mirrors everything with logical start and end, never physical left and right.
**Owner** marks the only items that need his own yes: the default theme (3), the profile colour (4) and, if the Architect keeps it, item 12.
Builder A owns the wording and data items; builder B the screens; builder S the loading; builder E the menu cut. No new boards are needed for any of these.

| # | Finding | Ruling | Who |
|---|---|---|---|
| 1 | Top bar bunched to the left; search and badge side by side | Search first; Create, bell and badge at the far end with a gap between (one `ms-auto`). At 375 px: Search icon, gap, bell, badge, and Create leaves the bar (the floating + is Create). Arabic mirrors | B |
| 2 | Drawer shows Pin and Expand/Collapse | One control: Collapse / Expand (chevron, flips in Arabic), with its word when the drawer is open. Pin is removed; the stored preference stays | B |
| 3 | Colours do not relate; the app feels dark; no light theme found | One palette: slate for text, chrome and primary buttons; orange only for the active-item mark and the logo; gold only in charts; green, amber, red only for status. Two themes: **Light (default)** and Dark; Colorful and Direct are retired. The switch lives in one place, the profile-badge menu (Light, Dark); My profile loses its theme row | B, **owner** |
| 4 | Profile colour only recolours the badge ring | Remove it; avatar colours come from the person automatically | B, **owner** |
| 5 | Profile name boxes | One labelled box per name, the Arabic name right to left, full width on a phone (screenshot wanted for the exact layout) | builders |
| 6 | Little up/down arrow beside tab rows and in the bell panel | It is the browser's scrollbar arrows. Tab rows get `overflow-y-hidden` (and `overflow-visible` while wrapped on a phone); the bell list gets `scrollbar-thin`; no icon or label | B |
| 7 | "Today" twice on My day | Remove the card title; the date heading is the title; groups are Overdue, Today, Next | B |
| 8 | Capture, Create and Wrap up read as separate things | My day's header holds two outline buttons, **Capture** then **Wrap up**; Capture also leads the Me tab above the Today block; Create stays in the top bar with Capture as its first entry; "New task" leaves My day's header | B |
| 9 | Stray scrollbars elsewhere | Every horizontal scroller gets `overflow-y-hidden` and `scrollbar-thin` (once in `Tabs` and `DataTable`; the four `OrgAccess` tables, `ActivityScreen`, `ListEditor`, `PastWorkGrid`) | B |
| 10 | Sweep of the rest | QA 1's crawl lists scrollbars on tab rows, card titles that repeat their page or group name, and two controls with one action; I rule on each | QA 1, design |
| 11 | Order to build | 6, 9, 7, 2, 1, 8 together; then 3 and 4 after the owner's yes | B |
| 12 | Floating + covers content, and shows on Finance | The + is the page's one add: Capture on My day and pages with no add of their own; New task on Tasks; New client on Clients; New opportunity on Pipeline; New invoice on Finance (only for those who may); none for a viewer. One bottom padding in `AppShell` so the last row clears the + by 16 px. Consequence: on Tasks, Clients, Pipeline and Finance, Capture is two taps (My day, then +) | B, **owner** (Architect may drop the flag) |
| 13 | Scroll bar beside tabs on a phone, bell tab wrap (QA-565) | Same as 6; the bell's tab row never wraps onto a second line at 375 px: three short tabs in one row, or one switcher | B |
| 14 | Finance shows "Payments as of —" and zeros | Where nothing is imported: **Not imported yet**, never a dash or zeros; the stamp reads "Payments · not imported yet"; tiles, months and services are replaced by one card "Not imported yet" with the line "Figures appear after the first Direct Payments import." A real 0 after an import still shows as 0 | A |
| 15 | More sheet holds only KPIs, Profile, Sign out; menus over 9 entries | More holds only destinations that do not fit in the bar; Profile and Sign out move to the profile-badge menu. If a role has five or fewer destinations there is no More. Top level at most 9: My day, Tasks, Clients, Suppliers & partners (when allowed), Pipeline, Projects, Finance, **Reports & KPIs** (KPIs, Reports, Appraisal), **Admin** (Settings, Activity); a group is a row that opens its entries | E, B |
| 16 | Bell wording "Admin account changed your Status change" | One pattern: **"<person> <did what> <on what>"**: always the person's name (never "Admin account"), a past-tense verb, the thing in words (never a field key), the record as a chip. System items have no person ("INV-T-0142 reached 45 days"). A second line only for a quote or a change ("Status: In progress → Done") | A |
| 17 | Top bar bunched to the left at 1,440 px | As item 1 | B |
| 18 | The name shown twice | The top-bar badge keeps it (avatar and name at 1,440, avatar only at 375); the drawer's bottom chip is removed, so the drawer's bottom is only its one Collapse control | B |
| 19 | Unlabelled drawer icons | Every icon-only control in the drawer has a tooltip on hover and keyboard focus (beside the icon in the collapsed rail) and an accessible name; the open drawer shows words | B |
| 20 | Create and Capture both orange | Orange is never a button fill. Create is slate filled, the one filled button in the chrome; page buttons are outline; a dialog's Save may be filled | B |
| 21 | Wrap up placed differently per width | Wrap up is the last button in My day's header row at every width; on a phone that row sits under the date and holds only Wrap up, because Capture there is the floating + | B |
| 22 | ⋯ wraps onto its own line at 375 px | Header action rows never wrap: one primary button plus ⋯ stay inline; the other actions move into ⋯ | B |
| 23 | "Follow" vs "Follow up" (one Arabic word for both) | The eye is **Watch / Watching** (Arabic تتبّع); **Follow up** (the reminder) stays Follow up (Arabic متابعة); wording only; Builder C confirms the Arabic | A, C |
| 24 | Add note and Follow up side by side | Follow up is a ⋯ menu entry plus the chip once set; Add note stays the one button | B |
| 25 | Heavy focus ring on the sheet's close button | A sheet opens with focus on its text field, never on Close; every focus ring is the standard 2 px ring, shown on keyboard focus only (`:focus-visible`) | B |
| 26 | The floating + over Capture at 375 px | The + hides while any sheet or dialog is open (under the overlay and `aria-hidden`) | B |
| 27 | The alert covers Wrap up at 375 px | The alert docks at the bottom: above the floating + on a phone, bottom-right on a wide screen, 16 px from the edge; never over a header action (the Stage 2 boards show it) | B |
| 28 | Monospace times | Mono is for IDs, amounts and codes only (TSK-0412, SAR), never for times or dates; times use the body font with tabular figures; this includes the Stage 2 time chips and fields and the bell's time stamp | B |
| 29 | A tapped tab does not highlight while the page loads | The tapped item becomes active at 0 ms (underline on a tab, filled item in the bar, active row in the drawer); the old one goes quiet; the tapped tab's small spinner replaces its count; `aria-busy` on the content, `aria-current` moves at once; if the load fails the highlight goes back | S |
| 30 | The 4 px loading bar is easy to miss | The highlight is the main signal; the bar only confirms it: 3 px, slate, full width, directly under the top bar at 1,440 and directly under the tab row at 375. Timing: 0 ms highlight and spinner; 100 ms bar; 150 ms old content dims to 60% and takes no taps (never blank); 600 ms skeleton rows; 10 s "Could not load. Try again" and the highlight goes back. Reduced motion: static bar, dimming stays | S |
| 31 | Bell shows unlabelled clock icons on each row | Remove the per-row clock icons (no Snooze in v1; Tomorrow and Next week already cover it for reminders); a row opens its item and marks itself read; **Mark all read** stays | B |
| 32 | Bell time stamps in monospace | As item 28: body font, tabular figures | B |

Stage 2 boards, with the alert and time chips already redrawn: `v2/design-stage2` (docs/v2/briefs/my-day-stage2.md).
