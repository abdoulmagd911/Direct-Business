# The Direct theme: dimmed black, modern, with Direct's orange (V636) — the token values for builder B (#254)

Design lead, 14 Oct night. **Three themes, each person picks in My profile (owner, 14 Oct 23:05): Light is the default, Dark is optional, and Direct is this one.** This replaces my earlier idea of retiring Direct: it stays, in this new form. Replaces the values of `[data-theme='direct']` in `v2/src/ui/tokens.css` (the only file that may hold a colour). The names do not change; only the values do.
The door tokens (`--door-*`: sign-in and new password) stay as they are, one light set whatever the theme (V213).
`tests/unit/tokens.test.ts` and the BUILD-PLAN "Design tokens" table must be updated in the same PR.

## The block

```css
/* ---------- Direct · dimmed black, Direct orange ---------- */
[data-theme='direct'] {
  color-scheme: dark;
  --bg: #121416;
  --surface: #171a1e;
  --raised: #1f2328;
  --border: #2d333b;
  --border-strong: #7d8896;
  --text: #edf0f3;
  --muted: #9ea8b3;
  --link: #ff9a5c;
  --accent: #f06820;
  --accent-hover: #ff8240;
  --on-accent: #1a1410;
  --accent-soft: #2b1d14;
  --primary: #f06820;
  --primary-hover: #ff8240;
  --on-primary: #1a1410;
  --focus: #8ab4ff;
  --success: #4cc38a;
  --warning: #e6a94b;
  --danger: #f27a6f;
  --info: #6faaf2;
  --success-soft: #15291f;
  --warning-soft: #30260f;
  --danger-soft: #331a1a;
  --info-soft: #172334;
  --nav-bg: #0e1012;
  --nav-text: #d0d6dc;
  --nav-muted: #8d98a4;
  --nav-active: #1f2328;
  --nav-active-text: #ffffff;
  --nav-mark: #f06820;
  --nav-border: #242a31;
  --top-bg: #171a1e;
  --top-text: #edf0f3;
  --top-border: #2d333b;
  --search-bg: #1f2328;
  --search-border: #2d333b;
  --search-text: #9ea8b3;
  --c1: #f06820;
  --c2: #5aa0f0;
  --c3: #d4a017;
  --c4: #a98bf0;
  --c5: #3dba7e;
  --c6: #9aa4b0;
  --shadow-1: 0 0 0 1px rgba(255, 255, 255, 0.05);
  --shadow-2: 0 14px 30px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06);
  --scrim: rgba(0, 0, 0, 0.6);
}
```

## The idea in four lines
- **Dimmed black, not black:** the page is a soft near-black (`#121416`); every layer above it is a step lighter (surface, raised), so depth reads without heavy borders or shadows. The drawer is one step darker than the page, so the chrome recedes.
- **One orange, used like a pen:** `--accent` and `--primary` are Direct's orange `#f06820`. It fills the active-item mark, the active tab bar, selection, and the one primary button. Text in the accent family uses `--link` (`#ff9a5c`, a lighter orange that reads on dark). **Dark text sits on orange** (`--on-accent`, `--on-primary` = `#1a1410`), never white, as the token file's own rule says.
- **Status colours stay cool and separate:** green, amber, a salmon red and blue, each with its own dark tint; a status always shows its word and an icon, never colour alone, because amber and salmon sit near orange.
- **Charts:** five series, orange first, then blue, gold, violet, green; `--c6` is the grey for "Other". Never more than five series; the sixth becomes "Other". Every chart keeps its legend and direct labels.

## Contrast, checked (WCAG, computed for these exact values)
| Pair | Ratio | Needs |
|---|---|---|
| text on page / raised | 16.1 / 13.8 | 4.5 |
| muted on page / raised | 7.7 / 6.6 | 4.5 |
| link on page / raised | 8.8 / 7.5 | 4.5 |
| dark text on orange (button, mark) | 5.8 | 4.5 |
| orange fill on raised (marks, bars) | 5.0 | 3 |
| strong border on raised / page (inputs) | 4.4 / 5.1 | 3 |
| focus ring on raised | 7.6 | 3 |
| success, warning, danger, info on raised | 7.1, 7.6, 5.9, 6.6 | 4.5 |
| each status on its own tint | 6.9, 7.2, 6.0, 6.6 | 4.5 |
| nav text / nav muted on drawer | 13.0 / 6.5 | 4.5 |
| search text on search box | 6.6 | 4.5 |
| link and text on the soft orange | 7.8 / 14.3 | 4.5 |
Chart colours (the five series, on a dark surface): contrast over 3:1 for all; the worst adjacent pair is 17.3 (colour-blind view) and 26.8 (normal view), well over the floors. The validator's "lightness band" check flags the orange and blue as just outside its band; that is expected for a brand orange and is why every chart carries a legend and direct labels.

## Rules for the builder
1. Replace only the values above; keep every token name; keep `[data-theme='light']`, `dark` and `colorful` as they are (their fate is the owner's, V636 / Q55).
2. `BrandLogo` already shows the on-dark logo for every theme except light; nothing to change.
3. Nothing white sits on `--accent` or `--primary`; the unit test for that rule stays.
4. At 375 and 1,440 px, English and Arabic, the screens to look at first: My day, Tasks, Clients, Finance overview, the bell, the Capture sheet. A hover or selected row uses `--nav-active` or `--accent-soft`, never a new colour.
5. The door (sign in) stays light.

## Boards (docs/v2/briefs/direct-theme/, one PNG each, all axe-clean including contrast)
`MyDayTodayDim` (1440), `MyDayCaptureDim`, `MyDayWrapUpDim`, `MyDayTodayArDim` (Arabic 1440), `PhoneTodayDim` (390), `PhoneCaptureReminderDim`, `PhoneWrapUpDim`, `PhoneTodayArDim`. They are the My day Stage 1 and 2 screens in the Direct theme, so the owner can judge the look on the screens he uses every day: soft near-black page, a darker drawer, raised cards one step lighter, one orange primary button with dark text, a selected control as a soft orange tint (never a white block), status colours with their words.
Selected controls in the Direct theme use `--accent-soft` with `--link` text and an `--accent` border (segmented controls, chips, the three Wrap up buttons); a Drop choice uses the danger tint.

## Light and Dark checks (the values as built in `tokens.css`, checked against the same WCAG table)
- **Dark (Night oasis): passes every pair.** No change.
- **Light (Sea-glass): one pair fails:** `--border-strong` `#858f88` on the page `--bg` is 2.996:1 and needs 3:1 (an input's border). **Change `--border-strong` to `#7c867f`** (3.4 on the page, 3.6 on surface, 3.8 on raised, 3.1 on the drawer). Nothing else changes in Light.
- The old Direct slate theme failed one pair (white on orange, 3.1:1); the new Direct values replace it, with dark text on orange at 5.8:1.
- **Colorful** is not one of the three themes; its one near-miss (link on its soft tint 4.4:1) is moot unless the owner keeps it (V635 Q55).
- **A reminder for the buttons:** the primary button is each theme's own `--primary` (orange with dark text in Direct; the theme's teal in Light and Dark). This amends my earlier "orange is never a button fill" (item 20 of the sense list): in the Direct theme it is, because the theme is Direct's orange.
