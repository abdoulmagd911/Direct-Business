# QA sweep

Drives the real `index.html` in a headless browser against a local stand-in for Supabase,
so every page and button can be exercised without touching production data.

Why the stand-in: the sandbox these run in cannot reach `*.supabase.co` or the jsDelivr CDN,
and pointing a test run at the live database would write to real records.
`mock-supabase.mjs` serves the same REST and auth shapes with seeded rows.

## Running

```
npm i playwright @supabase/supabase-js
node scripts/qa/sweep-pages.mjs      # every nav page + every button, EN then AR
node scripts/qa/sweep-language.mjs   # lists UI text still in English while in Arabic
```

Chromium lives at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in this environment;
adjust `executablePath` elsewhere.

## Last run — 2026-08-08

- 16 nav pages opened, 134 buttons clicked, **0 JavaScript errors** in English or Arabic.
- Destructive buttons (delete/archive/sign out/reset) are skipped by a name filter.
- 135 pieces of UI text stay English when the app is switched to Arabic.
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left. Deliberate-looking, but worth a decision.
- Modals do not close on Escape.
