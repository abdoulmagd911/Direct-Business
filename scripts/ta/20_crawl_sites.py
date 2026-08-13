#!/usr/bin/env python3
"""Stage 2: probe every known agency domain and harvest identifiers.

For each domain: GET the homepage (https, then http fallback), record
liveness, and regex-harvest Saudi identifiers straight from the HTML:
CR numbers, unified numbers, VAT numbers, MOT licence numbers, emails,
phones. Also tries /contact and /about style pages when the homepage is
thin. Nothing is guessed — only what the site itself publishes.

Usage: 20_crawl_sites.py <work.jsonl> <out.jsonl> [concurrency]
"""
import sys, json, re, ssl, gzip, io, urllib.request, urllib.error, socket
from concurrent.futures import ThreadPoolExecutor, as_completed

WORK, OUT = sys.argv[1], sys.argv[2]
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 20
TIMEOUT = 12
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.8', 'Accept-Encoding': 'gzip'}

domains = []
seen = set()
for line in open(WORK, encoding='utf-8'):
    rec = json.loads(line)
    for d in rec['_norm']['domains']:
        if d and d not in seen:
            seen.add(d)
            domains.append(d)

CR_CTX = re.compile(r'(?:سجل\s*(?:ال)?تجاري|C\.?\s?R\.?|commercial\s+reg\w*|رقم\s*الوثيقة|الرقم\s*الموحد|unified\s*(?:national\s*)?number)\D{0,40}(\d{10})', re.I)
UNIFIED = re.compile(r'\b(70\d{8})\b')
CR_BARE = re.compile(r'\b([12457]\d{9})\b')
VAT = re.compile(r'\b(3\d{13}3)\b|(?:الرقم\s*الضريبي|VAT|tax\s*number)\D{0,40}(3\d{14})', re.I)
LIC = re.compile(r'(?:ترخيص|licen[cs]e|رخصة)\D{0,50}(73\d{6}|\d{2}/\d{4,8})', re.I)
EMAIL = re.compile(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}')
PHONE = re.compile(r'(?:\+?966|00966|\b0)[\s\-()]*(?:5\d|1[1-9]|9200?|800)[\d\s\-()]{5,12}')
PARKED = re.compile(r'domain (?:is )?for sale|buy this domain|parked free|godaddy|sedoparking|hugedomains|هذا النطاق معروض', re.I)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE  # liveness probe only; identifiers are re-verified later

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
        raw = resp.read(600_000)
        if resp.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
            try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read(600_000)
            except OSError: pass
        enc = 'utf-8'
        m = re.search(rb'charset=["\']?([\w\-]+)', raw[:3000])
        if m:
            try: enc = m.group(1).decode()
            except Exception: pass
        return resp.status, str(resp.url), raw.decode(enc, errors='replace')

def harvest(html):
    out = {}
    crs = set(CR_CTX.findall(html)) | set(UNIFIED.findall(html))
    # bare 10-digit numbers only count when a CR-ish word is somewhere on the page
    if re.search(r'سجل|commercial|C\.R|توثيق|معروف|الرقم الموحد', html, re.I):
        crs |= set(CR_BARE.findall(html)) & set(re.findall(r'\d{10}', html))
    out['cr'] = sorted(crs)[:5]
    out['vat'] = sorted({a or b for a, b in VAT.findall(html)})[:3]
    out['licence'] = sorted(set(LIC.findall(html)))[:3]
    out['emails'] = sorted({e.lower() for e in EMAIL.findall(html)
                            if not re.search(r'\.(png|jpg|gif|webp|css|js)$', e, re.I)})[:6]
    out['phones'] = sorted({re.sub(r'[\s\-()]', '', p) for p in PHONE.findall(html)})[:6]
    return out

def probe(dom):
    res = {'domain': dom, 'status': 'dead', 'http': None, 'final_url': '', 'note': ''}
    html = None
    for url in (f'https://{dom}', f'https://www.{dom}', f'http://{dom}'):
        try:
            code, final, html = fetch(url)
            res['http'] = code
            res['final_url'] = final
            break
        except Exception as e:
            res['note'] = type(e).__name__
            html = None
    if html is None:
        return res
    if PARKED.search(html) or len(html) < 400:
        res['status'] = 'parked/thin'
    else:
        res['status'] = 'live'
    h = harvest(html)
    # if nothing found on homepage, try one contact-ish page
    if not (h['cr'] or h['vat']) and res['status'] == 'live':
        m = re.search(r'href=["\']([^"\']*(?:contact|about|عن|اتصل|تواصل)[^"\']*)["\']', html, re.I)
        if m:
            link = m.group(1)
            if link.startswith('/'):
                link = f'https://{dom}' + link
            if link.startswith('http'):
                try:
                    _, _, html2 = fetch(link)
                    h2 = harvest(html2)
                    for k in h:
                        h[k] = sorted(set(h[k]) | set(h2[k]))[:6]
                except Exception:
                    pass
    res.update({'site_' + k: v for k, v in h.items()})
    return res

results = []
with ThreadPoolExecutor(max_workers=CONC) as ex:
    futs = {ex.submit(probe, d): d for d in domains}
    done = 0
    for fut in as_completed(futs):
        try:
            results.append(fut.result())
        except Exception as e:
            results.append({'domain': futs[fut], 'status': 'error', 'note': type(e).__name__})
        done += 1
        if done % 50 == 0:
            print(f'{done}/{len(domains)}', flush=True)

with open(OUT, 'w', encoding='utf-8') as f:
    for r in results:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

live = sum(1 for r in results if r['status'] == 'live')
print(f'domains: {len(results)}  live: {live}  parked/thin: {sum(1 for r in results if r["status"]=="parked/thin")}  dead: {sum(1 for r in results if r["status"]=="dead")}')
print(f'sites publishing CR: {sum(1 for r in results if r.get("site_cr"))}')
print(f'sites publishing VAT: {sum(1 for r in results if r.get("site_vat"))}')
