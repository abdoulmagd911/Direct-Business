#!/usr/bin/env python3
"""Stage 2c: build duplicate GROUPS using the locked match order, and emit
the evidence for each group so merges can be judged and audited.

Match order (strongest first): MOT licence -> root domain -> exact AR name
-> exact normalised EN name. Over-merge guard: a domain-only match must also
share a name token, and generic/shared hosts are never used as a key.

Nothing is merged here — this produces the plan; a later stage applies it.

Usage: 22_dedupe_plan.py <work.jsonl> <out.json>
"""
import sys, json, re, collections
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import norm_name

WORK, OUT = sys.argv[1], sys.argv[2]
recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]

# Hosts that many unrelated companies share — never a merge key.
SHARED_HOST = re.compile(r'^(www\.)?(wixsite|blogspot|wordpress|weebly|godaddysites|'
                         r'business\.site|sites\.google|facebook|instagram|linktr|'
                         r'salla\.sa|zid\.store|shopify)', re.I)

def ar_norm(s):
    s = re.sub(r'[ً-ْـ]', '', str(s or ''))       # harakat + tatweel
    s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ى', 'ي').replace('ة', 'ه')
    s = re.sub(r'\b(شركة|وكالة|مؤسسة|مكتب|للسفر|والسياحة|السياحة|السفر|و)\b', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def tokens(r):
    t = set(norm_name(r.get('Agency Name (EN)')).split()) | set(ar_norm(r.get('Agency Name (AR)')).split())
    return {x for x in t if len(x) > 2}

parent = list(range(len(recs)))
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]; a = parent[a]
    return a
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[max(ra, rb)] = min(ra, rb)

edges = collections.defaultdict(list)   # (i,j) -> [rules]

def link(idx, rule, guard_tokens=False):
    for key, members in idx.items():
        if len(members) < 2: continue
        for a in range(len(members)):
            for b in range(a + 1, len(members)):
                i, j = members[a], members[b]
                if guard_tokens and not (tokens(recs[i]) & tokens(recs[j])):
                    edges[(i, j)].append(f'{rule}:{key} (REJECTED - no shared name token)')
                    continue
                union(i, j)
                edges[(min(i, j), max(i, j))].append(f'{rule}:{key}')

by_lic = collections.defaultdict(list)
by_dom = collections.defaultdict(list)
by_ar = collections.defaultdict(list)
by_en = collections.defaultdict(list)
for i, r in enumerate(recs):
    for lic in re.findall(r'\b73\d{6}\b', str(r.get('License Numbers (MOT)') or '')):
        by_lic[lic].append(i)
    for d in r['_norm']['domains']:
        if d and not SHARED_HOST.match(d): by_dom[d].append(i)
    a = ar_norm(r.get('Agency Name (AR)'))
    if a and len(a) > 5: by_ar[a].append(i)
    e = norm_name(r.get('Agency Name (EN)'))
    if e and len(e) > 4: by_en[e].append(i)

link(by_lic, 'MOT licence')
link(by_dom, 'root domain', guard_tokens=True)
link(by_ar, 'exact AR name')
link(by_en, 'exact EN name', guard_tokens=True)

groups = collections.defaultdict(list)
for i in range(len(recs)):
    groups[find(i)].append(i)
multi = {k: v for k, v in groups.items() if len(v) > 1}

def contact_count(r):
    n = r['_norm']
    return len(n['mobiles']) + len(n['landlines']) + len(n['emails']) + len(n['domains'])

out = []
for root, members in sorted(multi.items(), key=lambda kv: -len(kv[1])):
    members = sorted(members)
    # survivor = most complete record (most contacts, then has CR, then lowest Row ID)
    survivor = max(members, key=lambda i: (contact_count(recs[i]),
                                           bool(recs[i].get('CR / Unified No. (SBC)')),
                                           -i))
    rules = sorted({r for a in members for b in members if a < b
                    for r in edges.get((a, b), [])})
    out.append({
        'survivor_row_id': recs[survivor].get('Row ID'),
        'member_row_ids': [recs[i].get('Row ID') for i in members],
        'names_en': [str(recs[i].get('Agency Name (EN)') or '') for i in members],
        'names_ar': [str(recs[i].get('Agency Name (AR)') or '') for i in members],
        'domains': sorted({d for i in members for d in recs[i]['_norm']['domains']}),
        'licences': sorted({l for i in members
                            for l in re.findall(r'\b73\d{6}\b', str(recs[i].get('License Numbers (MOT)') or ''))}),
        'rules': rules,
        'size': len(members),
    })

json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'rows: {len(recs)}')
print(f'duplicate groups: {len(out)}')
print(f'rows inside a group: {sum(g["size"] for g in out)}')
print(f'rows after merging: {len(recs) - sum(g["size"] - 1 for g in out)}')
print(f'rejected domain links (no shared name token): {sum(1 for v in edges.values() for x in v if "REJECTED" in x)}')
print()
print('largest groups:')
for g in out[:8]:
    print(f'  {g["size"]}x {g["survivor_row_id"]}: {g["names_en"][0][:34] or g["names_ar"][0][:34]} | rules={g["rules"][:2]}')
