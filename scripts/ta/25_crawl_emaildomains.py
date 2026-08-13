#!/usr/bin/env python3
"""Stage 2f: crawl corporate domains that appear ONLY inside email addresses.

The first pass (20_crawl_sites) only visited domains listed in the Domains
column. A company whose record carries `info@theircompany.com` but no website
field was therefore never checked — its site, its published CR and its real
name were all invisible. This closes that gap.

Reuses the same probes: liveness + first-pass contacts, strict labelled
identifiers, and the name signals.

Usage: 25_crawl_emaildomains.py <work.jsonl> <crawl.jsonl> <out-prefix> [conc]
"""
import sys, json, subprocess, os

WORK, CRAWL, PREFIX = sys.argv[1], sys.argv[2], sys.argv[3]
CONC = sys.argv[4] if len(sys.argv) > 4 else '20'
HERE = os.path.dirname(os.path.abspath(__file__))

FREEMAIL = {'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com',
            'msn.com', 'aol.com', 'mail.ru', 'yandex.com', 'protonmail.com', 'me.com',
            'qq.com', '163.com', 'rediffmail.com', 'windowslive.com'}

recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]
already = {json.loads(l)['domain'] for l in open(CRAWL, encoding='utf-8')}

new = set()
for r in recs:
    for d in r['_norm']['email_domains']:
        d = d.lower().strip()
        if d and d not in already and d not in FREEMAIL and '.' in d:
            new.add(d)
new = sorted(new)
print(f'corporate domains reachable only through an email address: {len(new)}')

# Feed them to the existing probes by writing a tiny stand-in crawl file.
stub = PREFIX + '-stub.jsonl'
with open(stub, 'w', encoding='utf-8') as f:
    for d in new:
        f.write(json.dumps({'domain': d, 'status': 'live'}) + '\n')

# 1. liveness + first-pass contacts: reuse 20_crawl_sites via a work-file shim
workshim = PREFIX + '-work.jsonl'
with open(workshim, 'w', encoding='utf-8') as f:
    for d in new:
        f.write(json.dumps({'Row ID': d, '_norm': {'domains': [d], 'email_domains': [d],
                                                   'emails': [], 'mobiles': [], 'landlines': [],
                                                   'hotlines': [], 'placeholders': [],
                                                   'whatsapp': ''}}) + '\n')
subprocess.run([sys.executable, f'{HERE}/20_crawl_sites.py', workshim, PREFIX + '-crawl.jsonl', CONC],
               check=True)
# 2. strict labelled identifiers over whatever answered
subprocess.run([sys.executable, f'{HERE}/21_recrawl_strict.py', PREFIX + '-crawl.jsonl',
                PREFIX + '-strict.jsonl', CONC], check=True)
# 3. name signals
subprocess.run([sys.executable, f'{HERE}/23_recover_names.py', workshim,
                PREFIX + '-names.jsonl', CONC], check=True)
print('done:', PREFIX + '-crawl.jsonl', PREFIX + '-strict.jsonl', PREFIX + '-names.jsonl')
