#!/usr/bin/env python3
"""Stage 2d: recover company names for rows that have a corporate domain but
no name, by reading what the site calls itself (<title>, og:site_name, h1).

Only corporate domains are used — free-mail domains (gmail/hotmail/yahoo…)
identify a PERSON, never a company, so those rows are left alone and marked
as individuals instead.

Usage: 23_recover_names.py <work.jsonl> <out.jsonl> [concurrency]
"""
import sys, json, re, ssl, gzip, io, html as htmllib, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

WORK, OUT = sys.argv[1], sys.argv[2]
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 20

FREEMAIL = {'gmail.com', 'gmail.coma', 'hotmail.com', 'hotmail.co.uk', 'yahoo.com', 'yahoo.fr',
            'yahoo.co.uk', 'yahoo.con', 'yahoo.coma', 'outlook.com', 'outlook.sa', 'icloud.com',
            'live.com', 'msn.com', 'windowslive.com', 'aol.com', 'mail.ru', 'yandex.com',
            'rediffmail.com', 'protonmail.com', 'me.com', 'qq.com', '163.com'}

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.8', 'Accept-Encoding': 'gzip'}
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE

BAD_TITLE = re.compile(r'^(home|الرئيسية|index|untitled|welcome|مرحبا|coming soon|'
                       r'under construction|default|page not found|404|error|'
                       r'domain|parked|for sale)\b', re.I)

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
        raw = resp.read(400_000)
        if resp.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
            try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read(400_000)
            except OSError: pass
        enc = 'utf-8'
        m = re.search(rb'charset=["\']?([\w\-]+)', raw[:3000])
        if m:
            try: enc = m.group(1).decode()
            except Exception: pass
        return raw.decode(enc, errors='replace')

def name_from(dom):
    out = {'domain': dom, 'title': '', 'og_site': '', 'h1': ''}
    html = None
    for url in (f'https://{dom}', f'https://www.{dom}', f'http://{dom}'):
        try:
            html = fetch(url); break
        except Exception:
            continue
    if not html:
        return out
    m = re.search(r'<title[^>]*>(.*?)</title>', html, re.S | re.I)
    if m:
        t = re.sub(r'\s+', ' ', htmllib.unescape(re.sub(r'<[^>]+>', '', m.group(1)))).strip()
        if t and not BAD_TITLE.match(t): out['title'] = t[:160]
    m = re.search(r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if m: out['og_site'] = htmllib.unescape(m.group(1)).strip()[:120]
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.S | re.I)
    if m:
        h = re.sub(r'\s+', ' ', htmllib.unescape(re.sub(r'<[^>]+>', '', m.group(1)))).strip()
        if h and len(h) < 120: out['h1'] = h
    return out

recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]
targets = set()
for r in recs:
    has_name = bool(str(r.get('Agency Name (EN)') or '').strip() or str(r.get('Agency Name (AR)') or '').strip())
    if has_name:
        continue
    for d in r['_norm']['domains'] + r['_norm']['email_domains']:
        if d and d.lower() not in FREEMAIL:
            targets.add(d)

targets = sorted(targets)
print(f'nameless rows needing a name; corporate domains to read: {len(targets)}', flush=True)

res = []
with ThreadPoolExecutor(max_workers=CONC) as ex:
    futs = {ex.submit(name_from, d): d for d in targets}
    done = 0
    for f in as_completed(futs):
        try: res.append(f.result())
        except Exception: res.append({'domain': futs[f], 'title': '', 'og_site': '', 'h1': ''})
        done += 1
        if done % 50 == 0: print(f'{done}/{len(targets)}', flush=True)

with open(OUT, 'w', encoding='utf-8') as fh:
    for r in res:
        fh.write(json.dumps(r, ensure_ascii=False) + '\n')
got = sum(1 for r in res if r['title'] or r['og_site'] or r['h1'])
print(f'domains read: {len(res)}  with a usable name signal: {got}')
