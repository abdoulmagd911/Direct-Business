#!/usr/bin/env python3
"""Stage 2b: STRICT re-extraction of official identifiers, with context.

The first pass used a bare 10-digit fallback and swallowed Unix timestamps
(1.7 billion), INT_MAX and years. This pass:
  * requires an explicit CR/VAT/unified-number LABEL near the number,
  * rejects epoch-range values and other known junk,
  * saves the surrounding text so a human/agent can judge the evidence.

No value is accepted without a label. Output feeds the judging stage.

Usage: 21_recrawl_strict.py <crawl.jsonl> <out.jsonl> [concurrency]
"""
import sys, json, re, ssl, gzip, io, html as htmllib, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

CRAWL, OUT = sys.argv[1], sys.argv[2]
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 20
TIMEOUT = 15
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.8', 'Accept-Encoding': 'gzip'}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Labels that must appear immediately before/after the number.
CR_LAB = r'(?:رقم\s*)?(?:ال)?سجل\s*(?:ال)?تجاري|رقم\s*السجل|C\.?\s?R\.?\s*(?:No\.?|Number|#)?|commercial\s+registration(?:\s+number)?|CR\s*Number|الرقم\s*الموحد|unified\s*(?:national\s*)?number|رقم\s*الوثيقة'
VAT_LAB = r'الرقم\s*الضريبي|رقم\s*ضريبة\s*القيمة|VAT\s*(?:No\.?|Number|Reg)?|tax\s*(?:identification\s*)?number|TIN'
LIC_LAB = r'ترخيص|رخصة|licen[cs]e\s*(?:no\.?|number)?|تصريح'

TAG = re.compile(r'<(script|style)[^>]*>.*?</\1>', re.S | re.I)
def to_text(h):
    h = TAG.sub(' ', h)
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'[ \t\r\f\v]+', ' ', htmllib.unescape(h))

def is_epoch(n):
    return 1_600_000_000 <= int(n) <= 1_900_000_000
def is_junk_cr(n):
    s = str(n)
    if is_epoch(s): return True
    if s == '2147483647': return True                      # INT_MAX
    if re.match(r'^(19|20)\d{2}', s) and s[:4] != '2050': return True   # starts with a year
    if re.fullmatch(r'(\d)\1{9}', s): return True          # 1111111111
    if s.startswith('96'): return True                     # country code run-on
    if s.startswith('05') or s.startswith('01'): return True  # phone pasted as digits
    return False

def find_labeled(text, label_re, num_re, window=60):
    """Return [(number, context)] where a label sits within `window` chars."""
    out = []
    for m in re.finditer(num_re, text):
        num = m.group(0)
        lo, hi = max(0, m.start() - window), min(len(text), m.end() + window)
        around = text[lo:hi]
        if re.search(label_re, around, re.I):
            ctxs = re.sub(r'\s+', ' ', text[max(0, m.start()-90):min(len(text), m.end()+90)]).strip()
            out.append((num, ctxs))
    return out

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
        raw = resp.read(900_000)
        if resp.headers.get('Content-Encoding') == 'gzip' or raw[:2] == b'\x1f\x8b':
            try: raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read(900_000)
            except OSError: pass
        enc = 'utf-8'
        m = re.search(rb'charset=["\']?([\w\-]+)', raw[:3000])
        if m:
            try: enc = m.group(1).decode()
            except Exception: pass
        return str(resp.url), raw.decode(enc, errors='replace')

def pages_for(dom):
    yield f'https://{dom}'
    for p in ('/contact', '/contact-us', '/about', '/about-us', '/terms',
              '/privacy-policy', '/ar/contact', '/اتصل-بنا'):
        yield f'https://{dom}{p}'

def probe(dom):
    res = {'domain': dom, 'cr': [], 'vat': [], 'licence': [], 'pages_read': []}
    for url in pages_for(dom):
        if len(res['pages_read']) >= 4:
            break
        try:
            final, h = fetch(url)
        except Exception:
            continue
        t = to_text(h)
        res['pages_read'].append(final)
        for num, c in find_labeled(t, CR_LAB, r'\b\d{10}\b'):
            if not is_junk_cr(num) and not any(x['value'] == num for x in res['cr']):
                res['cr'].append({'value': num, 'context': c, 'page': final})
        for num, c in find_labeled(t, VAT_LAB, r'\b3\d{13}3\b|\b\d{15}\b'):
            if not any(x['value'] == num for x in res['vat']):
                res['vat'].append({'value': num, 'context': c, 'page': final})
        for num, c in find_labeled(t, LIC_LAB, r'\b\d{6,9}\b|\b\d{2}/\d{4,8}\b'):
            if not any(x['value'] == num for x in res['licence']):
                res['licence'].append({'value': num, 'context': c, 'page': final})
        if res['cr'] and res['vat']:
            break
    return res

doms = [json.loads(l)['domain'] for l in open(CRAWL, encoding='utf-8')
        if json.loads(l)['status'] in ('live', 'parked/thin')]
print(f'strict re-extraction over {len(doms)} reachable domains', flush=True)

results = []
with ThreadPoolExecutor(max_workers=CONC) as ex:
    futs = {ex.submit(probe, d): d for d in doms}
    done = 0
    for fut in as_completed(futs):
        try:
            results.append(fut.result())
        except Exception as e:
            results.append({'domain': futs[fut], 'cr': [], 'vat': [], 'licence': [],
                            'pages_read': [], 'error': type(e).__name__})
        done += 1
        if done % 50 == 0:
            print(f'{done}/{len(doms)}', flush=True)

with open(OUT, 'w', encoding='utf-8') as f:
    for r in results:
        f.write(json.dumps(r, ensure_ascii=False) + '\n')

print(f'domains probed: {len(results)}')
print(f'with labeled CR: {sum(1 for r in results if r["cr"])}')
print(f'with labeled VAT: {sum(1 for r in results if r["vat"])}')
print(f'with labeled licence: {sum(1 for r in results if r["licence"])}')
print(f'total CR candidates: {sum(len(r["cr"]) for r in results)}')
