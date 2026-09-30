# What a session can reach — the live app and database

Moved word for word out of `CLAUDE.md` ("What this session can and cannot reach") on 2026-09-30, to keep that file
under the docs gate's 22,000 characters (`scripts/qa/check-docs-moved.mjs`). `CLAUDE.md` keeps a pointer here.

> **2026-09-21 — the last two rows of this table describe the CHAT sandbox. A Claude Code session
> running in the remote container reaches BOTH.** Measured the same day: `https://www.directksab2b.com/`
> answers `200`, and `https://vkxoeeoauexyfpzqufqd.supabase.co/rest/v1/` answers `401` — refused for
> want of a key, which is a reply, not a block. That difference is worth a lot: it is what lets a
> session drive **the real app against the real database** instead of trusting the harness, and the
> harness serves fake data (the warning at the top of this file). The recipe, learned the hard way:
> - run node with the proxy variables stripped — `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy node …`;
> - launch Chromium with `proxy:{server:'direct://'}` and `args:['--no-proxy-server']`;
> - serve the repo from a tiny local HTTP server and `page.route()` the Supabase host to a node
>   `fetch(REAL + pathname + search)`, passing the headers through;
> - **block only table writes and `save_state`/`save_state_patch` — never all non-GET.** The app
>   LOADS through POST rpcs, so blocking every POST gives you an app with no data and a day lost.
>   **And block the rpc `log_page_denied` too** (2026-09-24, Build lane sweep): driving the app as a
>   restricted role makes js/64 log every refused page as an audit row — a read-only walk of twenty
>   pages as a team member wrote 16 "Page access · Refused" rows to the live log before this line
>   existed. Those rows are harmless and the Activity page names them as refusals, but a sweep that
>   promises "read-only" must not be the thing writing.
> - drive the live site itself with `curl` and a cache-buster (`?cb=$(date +%s%N)`) when confirming
>   a deploy: the CDN will otherwise hand you the previous file and you will "prove" a push failed.
>
> Everything a session writes this way must still respect rule 7: real names, amounts and invoice
> numbers stay in the database and in the scratchpad, never in a commit.
>
> **2026-09-27 — reach depends on the ENVIRONMENT, not on being Claude Code.** A second builder session measured the
> opposite of the note above: its environment's network policy refused `vkxoeeoauexyfpzqufqd.supabase.co`,
> `cdn.jsdelivr.net`, `assets.directksa.com` and `www.directksab2b.com` (the proxy answers 403). Test with `curl` first;
> where they are refused, the DirectFont, download and live probes go red for that reason alone — compare against the
> base before calling a red yours. The fix is the environment's Network access setting (the owner's click).
