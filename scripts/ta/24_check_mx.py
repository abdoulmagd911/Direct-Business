#!/usr/bin/env python3
"""Stage 2e: check which email domains can actually receive mail (MX lookup).

An address on a domain with no MX record cannot be delivered to — that is the
difference between "we have an email" and "we can email them". Free, uses DNS
only. Falls back to an A record (some small hosts accept mail on the A host).

Usage: 24_check_mx.py <work.jsonl> <out.json> [concurrency]
"""
import sys, json, subprocess, shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

WORK, OUT = sys.argv[1], sys.argv[2]
CONC = int(sys.argv[3]) if len(sys.argv) > 3 else 24

recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]
doms = sorted({e.split('@')[1].lower() for r in recs for e in r['_norm']['emails'] if '@' in e})
print(f'email domains to check: {len(doms)}', flush=True)

# A real MX lookup is required. `dig`/`host` are absent in some sandboxes and the
# socket fallback only sees A records — which silently reports every domain as
# undeliverable. Refuse to run rather than emit that false result.
try:
    import dns.resolver
except ImportError:
    sys.exit('dnspython is required for a real MX check: pip install dnspython')

RES = dns.resolver.Resolver()
RES.lifetime = 6.0
RES.timeout = 3.0

def lookup(dom):
    try:
        ans = RES.resolve(dom, 'MX')
        hosts = sorted((r.preference, str(r.exchange).rstrip('.')) for r in ans)
        return dom, 'mx', hosts[0][1][:80]
    except dns.resolver.NoAnswer:
        try:
            RES.resolve(dom, 'A')
            return dom, 'a-only', 'resolves but publishes no MX'
        except Exception:
            return dom, 'none', ''
    except dns.resolver.NXDOMAIN:
        return dom, 'nxdomain', 'domain does not exist'
    except Exception as e:
        return dom, 'error', type(e).__name__

res = {}
with ThreadPoolExecutor(max_workers=CONC) as ex:
    futs = [ex.submit(lookup, d) for d in doms]
    done = 0
    for f in as_completed(futs):
        d, status, detail = f.result()
        res[d] = {'status': status, 'detail': detail}
        done += 1
        if done % 200 == 0:
            print(f'{done}/{len(doms)}', flush=True)

json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
c = {}
for v in res.values():
    c[v['status']] = c.get(v['status'], 0) + 1
print('by status:', c)
mailable = {d for d, v in res.items() if v['status'] == 'mx'}
tot = sum(1 for r in recs for e in r['_norm']['emails'])
ok = sum(1 for r in recs for e in r['_norm']['emails'] if e.split('@')[1].lower() in mailable)
print(f'email addresses: {tot}  deliverable domain: {ok}  undeliverable: {tot - ok}')
