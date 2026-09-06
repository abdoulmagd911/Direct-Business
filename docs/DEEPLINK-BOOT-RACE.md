# The deep link that a slow phone throws away

**Status: FIXED and deployed, round 58, 6 Sep 2026.** Both lines below are landed. Guarded by
`scripts/qa/probe-deeplink-boot-race.mjs` (port 8713), which reproduces the race deterministically
by CPU throttling instead of waiting for a busy machine — and which reddens when EITHER half of
the fix is removed.

**Correction to the table below, measured independently before landing anything: the link was
lost from 4x, not 6x.** 4x is an ordinary mid-range phone, not a low-end one. It survived only at
1x — which is to say, only on the machines the people who built it were using.

**Found:** watch cycle 35, 6 Sep 2026 · **Files:** `js/03-clean-url-routing-filter-memory-each-secti.js`, `js/66-document-generator.js` — both outside the watch session's lane, so the fix below is handed over, not landed.
**Guarded by:** `scripts/qa/probe-generator-attacks.mjs`, check `A: contract editor opens by deep link` (and B–E for the other four editors).

## What breaks

Open `www.directksab2b.com/documents/contract` while signed out. Sign in. On a fast machine
you land in the contract editor. On a slower one you land on **Today**, with no error and no
sign that an address was ever asked for. The same goes for `/documents/offer`, `/fees`,
`/profile` and `/tender` — every link anyone pastes into an email or a chat.

## Why

`index.html` loads 68 blocking scripts in order. Two of them read the same thing and race:

* **`js/03` is the 14th.** It captures the address the page opened at into `boot`, then starts
  a 200 ms timer. As soon as `render` and `DB` exist the timer fires `restoreBoot()`, which
  rewrites `location.pathname` to `'/' + current`. Nobody is signed in yet at that moment, so
  `current` is `'today'` — and the address the user asked for is gone from the URL bar.
* **`js/66` is the ~55th.** Its boot IIFE decides which editor to open by reading
  `location.pathname` at its own script-evaluation time.

Whichever arrives first wins. Normally js/66 is evaluated within the first 200 ms and the deep
link survives. Slow the *execution* of those 40 scripts down and js/03's timer gets there
first: js/66 reads `/today`, finds no `/documents/<tab>`, leaves `DG.tab` at its default
`assets`, and the deep link is silently dropped.

Note the shape of it: neither file is wrong on its own. js/03 is right to park the URL, js/66
is right to read it. The defect only exists in the order they happen to run in.

## Reproduced, deterministically, with no contention at all

CPU throttling only (`Emulation.setCPUThrottlingRate` over CDP), one page at a time, no
parallel load, no network delay. `4x` is roughly a mid-range Android phone, `6x` a low-end one.

| CPU throttle | today (as pushed) | with the fix below |
|---|---|---|
| 1x | `tab=contract` ✓ | `tab=contract` ✓ |
| 4x | **`tab=assets` ✗** (cycle 35 recorded ✓ here; re-measured round 58) | `tab=contract` ✓ |
| 6x | **`tab=assets` ✗** | `tab=contract` ✓ |
| 10x | **`tab=assets` ✗** | `tab=contract` ✓ |
| 20x | **`tab=assets` ✗** | `tab=contract` ✓ |

Per-request latency alone (up to 40 ms on every `/js/*` file) does **not** reproduce it — the
preload scanner fetches in parallel. It is script *execution* time that decides the race, which
is why a two-vCPU box running six QA probes at once reproduces it as reliably as a cheap phone.

This is also the whole of what six cycles wrote off as *"probe-generator-attacks: environmental,
red in a batch, green alone"*. It was never environmental. It was this, reported honestly by a
probe nobody believed.

## The fix (two lines, no behaviour change on a fast device)

**`js/03`** — publish the address the page actually opened at, right after `boot` is computed:

```js
  var boot=(function(){var h=String(location.hash||'');if(h.indexOf('#/')===0)return h.slice(1);return String(location.pathname||'/');})();
+ /* The address the page opened at, published for any later module that needs to read it.
+    location.pathname is NOT a safe substitute: restoreBoot below rewrites it to whatever
+    `current` is a few hundred ms into boot, which on a slow device is before the later
+    modules have even been evaluated. */
+ try{ window.__bootPath=boot; }catch(_){}
```

**`js/66`** — let the boot IIFE, and only the boot IIFE, fall back to it:

```js
- (function(){ var t=pathTab(); if(t){ DG.tab=t; DG.view='editor'; } })();
+ (function(){ var t=pathTab();
+   /* js/03 rewrites location.pathname on a 200ms timer once render+DB exist. This file is
+      ~40 scripts further down the page, so on a slow device that timer wins and the deep
+      link is already gone by the time we read it. js/03 publishes the address the page
+      actually opened at; fall back to it (boot only — urlSync must keep reading the live
+      pathname, or dgHome() could never leave the editor). */
+   if(!t){ var mb=String((window.__bootPath||'')).match(/^\/documents\/([a-zA-Z]+)\/?$/); if(mb&&TAB_IDS.indexOf(mb[1])>=0)t=mb[1]; }
+   if(t){ DG.tab=t; DG.view='editor'; } })();
```

`urlSync()` and the popstate listener must keep reading the **live** pathname — if they read
`__bootPath` too, `dgHome()` could never leave the editor. Boot only.

**Verified:** `probe-generator-attacks` under six-way parallel load is `113 passed, 1 failed`
against the tree as pushed and `114 passed, 0 failed` with the two lines above applied — same
load, same run, nothing else changed.

## Still open, deliberately not fixed here

`js/03`'s `restoreBoot()` writes `'/' + current` over the boot address whenever it fires before
sign-in, so **any** deep link — `/finance`, `/clients/lead/<id>` — is briefly rewritten to
`/today` on a slow device. js/03 re-applies the route from its own captured `boot` first, so
most pages recover; only a *sub-address* a later module has to read (the `/documents/<tab>`
suffix, which `buildPath()` does not reconstruct) is actually lost. Worth a look when someone
is next in js/03: parking the URL before the user is signed in buys nothing.
