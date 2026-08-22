#!/usr/bin/env python3
"""Stage 2i: enrich from MASTER_DB_v1.98 — the raw pre-dedup collection.

This is the fullest raw file (5,139 rows, 12 July) before any dedup ran. v3 kept
its contacts but dropped the whole commercial-intelligence layer, which is
exactly what the brief says matters per agency: whether they have their own app,
which direction of market they serve, Direct's own fit tier, preferred channel,
services offered.

Matched on the locked key order — MOT licence > root domain > email > exact
normalised English name — and every row records WHICH key matched, so a weak
name-only match is visible rather than silently trusted.

Usage: 28_predup_master.py <master.csv> <work.jsonl> <out.json>
"""
import sys, csv, json, re
csv.field_size_limit(10_000_000)
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import norm_name, split_phones, split_emails, valid_email, split_socials

SRC, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
rows = list(csv.DictReader(open(SRC, encoding='utf-8')))
recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]

def v(r, k):
    x = r.get(k)
    return str(x).strip() if x not in (None, '') else ''
def rootdom(d):
    return re.sub(r'^https?://(www\.)?', '', str(d or '').strip().lower()).split('/')[0]

by_lic, by_dom, by_em, by_nm = {}, {}, {}, {}
for r in rows:
    for lic in re.findall(r'\b73\d{6}\b', v(r, 'official_licence_number')):
        by_lic.setdefault(lic, r)
    d = rootdom(v(r, 'website'))
    if d: by_dom.setdefault(d, r)
    for fld in ('email_primary', 'email_secondary', 'contact_1_email'):
        for x in re.findall(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', v(r, fld)):
            by_em.setdefault(x.lower(), r)
    n = norm_name(v(r, 'entity_en'))
    if n and len(n) > 4: by_nm.setdefault(n, r)

YESNO = {'true': 'yes', 'yes': 'yes', '1': 'yes', 'y': 'yes',
         'false': 'no', 'no': 'no', '0': 'no', 'n': 'no'}
# The raw file writes UNKNOWN / N/A / TBD as literal text. Blank must mean
# unknown, so those never reach the sheet looking like an answer.
PLACEHOLDER = {'unknown', 'n/a', 'na', 'none', 'null', 'tbd', '-', '--', 'not set',
               'not available', 'unspecified', 'insufficient_data', 'not_enough_data',
               'no_data', 'undetermined', 'pending', ''}
def clean(x):
    return '' if str(x).strip().lower() in PLACEHOLDER else str(x).strip()

out = {}
for rec in recs:
    src, why = None, ''
    for lic in re.findall(r'\b73\d{6}\b', str(rec.get('License Numbers (MOT)') or '')):
        if lic in by_lic: src, why = by_lic[lic], 'MOT licence'; break
    if not src:
        for d in rec['_norm']['domains']:
            if d in by_dom: src, why = by_dom[d], 'website domain'; break
    if not src:
        for e in rec['_norm']['emails']:
            if e.lower() in by_em: src, why = by_em[e.lower()], 'email address'; break
    if not src:
        n = norm_name(rec.get('Agency Name (EN)'))
        if n and len(n) > 4 and n in by_nm:
            src, why = by_nm[n], 'exact English name (weakest key)'
    if not src:
        continue

    app = YESNO.get(clean(v(src, 'has_mobile_app')).lower(), clean(v(src, 'has_mobile_app')))
    ph = split_phones(v(src, 'official_phone'), v(src, 'landline'))
    mob = split_phones(v(src, 'mobile_primary'), v(src, 'mobile_secondary'))
    wa = split_phones(v(src, 'whatsapp'))
    em = [e for e in split_emails(v(src, 'email_primary'), v(src, 'email_secondary'),
                                  v(src, 'contact_1_email')) if valid_email(e)]
    out[rec.get('Row ID')] = {
        'matched_by': why,
        'entity_type': clean(v(src, 'entity_type')),
        'activity': clean(v(src, 'type_activity')),
        'office_type': clean(v(src, 'office_type')),
        'has_mobile_app': app,
        'direct_fit_tier': clean(v(src, 'direct_fit_tier')),
        'market_direction': clean(v(src, 'market_direction')),
        'preferred_channel': clean(v(src, 'preferred_channel')),
        'services_offered': clean(v(src, 'services_offered'))[:160],
        'gds_systems': clean(v(src, 'gds_systems')),
        'hq_city': clean(v(src, 'hq_city')),
        'hq_region': clean(v(src, 'hq_region')),
        'google_maps_url': v(src, 'google_maps_url'),
        'decision_maker': clean(v(src, 'decision_maker')),
        'contact_1_name': clean(v(src, 'contact_1_name')),
        'contact_1_role': clean(v(src, 'contact_1_role')),
        'stage': clean(v(src, 'stage')),
        'mobiles': mob['mobile'] + wa['mobile'],
        'landlines': ph['landline'] + ph['hotline'],
        'emails': em,
        'website': rootdom(v(src, 'website')),
        'socials': split_socials(v(src, 'linkedin'), v(src, 'social_links')),
        'notes': v(src, 'notes')[:220],
        'is_saudi_hq': YESNO.get(clean(v(src, 'is_saudi_hq')).lower(), clean(v(src, 'is_saudi_hq'))),
    }

json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'source rows: {len(rows)} | matched to my rows: {len(out)}')
import collections
print('matched by:', dict(collections.Counter(x['matched_by'] for x in out.values())))
for k in ('entity_type', 'direct_fit_tier', 'has_mobile_app', 'market_direction',
          'preferred_channel', 'services_offered', 'hq_city', 'hq_region', 'contact_1_name'):
    print(f'  carries {k}: {sum(1 for x in out.values() if x[k])}')
