#!/usr/bin/env python3
"""Stage 2h: enrich from the official MOT licence registry extract.

`SAUDI-TRAVEL-TRADE-DATABASE__Saudi_Travel_Trade.csv` (3,725 rows) is the raw
Ministry of Tourism registry export. v3 carried its licence numbers across but
dropped most of its other columns: office type, licence status, city, official
phone, Direct's own pipeline stage, and the social links.

Matching is by MOT LICENCE NUMBER only — the strongest official key in the
locked match order — so nothing can attach to the wrong company.

Usage: 27_mot_registry.py <registry.csv> <work.jsonl> <out.json>
"""
import sys, csv, json, re
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import split_phones, split_emails, valid_email, split_socials

REG, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

reg = list(csv.DictReader(open(REG, encoding='utf-8-sig')))
by_lic = {}
for r in reg:
    for f in ('Official Licence #', 'All Licences'):
        for lic in re.findall(r'\b73\d{6}\b', str(r.get(f) or '')):
            by_lic.setdefault(lic, r)

recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]

PLACEHOLDER = {'unknown', 'n/a', 'na', 'none', 'null', 'tbd', '-', '--', 'not set',
               'not available', 'unspecified', 'insufficient_data', 'not_enough_data',
               'no_data', 'undetermined', 'pending', ''}
def v(r, k):
    x = r.get(k)
    x = str(x).strip() if x not in (None, '') else ''
    return '' if x.lower() in PLACEHOLDER else x

out = {}
for rec in recs:
    lics = re.findall(r'\b73\d{6}\b', str(rec.get('License Numbers (MOT)') or ''))
    src = next((by_lic[l] for l in lics if l in by_lic), None)
    if not src:
        continue
    ph = split_phones(v(src, 'Official Phone'), v(src, 'Other Phones'))
    wa = split_phones(v(src, 'Mobile / WhatsApp'))
    em = [e for e in split_emails(v(src, 'Best Email'), v(src, 'All Emails')) if valid_email(e)]
    soc = split_socials(v(src, 'LinkedIn'), v(src, 'Instagram'), v(src, 'Other Social'))
    out[rec.get('Row ID')] = {
        'registry_row': v(src, 'Row ID'),
        'entity_en': v(src, 'Entity (EN)'),
        'entity_ar': v(src, 'Entity (AR)'),
        'activity': v(src, 'Type / Activity'),
        'office_type': v(src, 'Office type'),
        'licence_status': v(src, 'Licence status'),
        'city': v(src, 'City'),
        'mobiles': wa['mobile'],
        'landlines': ph['landline'] + ph['hotline'],
        'other_mobiles': ph['mobile'],
        'emails': em,
        'website': v(src, 'Website'),
        'socials': soc,
        'decision_maker': v(src, 'Decision-Maker'),
        'our_stage': v(src, 'Our Stage'),
        'notes': v(src, 'Notes')[:200],
        'flags': v(src, 'Data flags')[:120],
    }

json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'registry rows: {len(reg)}')
print(f'company rows matched by licence: {len(out)}')
for k, label in (('office_type', 'office type'), ('licence_status', 'licence status'),
                 ('city', 'city'), ('our_stage', "Direct's own stage"),
                 ('decision_maker', 'decision maker'), ('website', 'website')):
    print(f'  with {label}: {sum(1 for x in out.values() if x[k])}')
print(f"  with a phone: {sum(1 for x in out.values() if x['mobiles'] or x['landlines'] or x['other_mobiles'])}")
print(f"  with an email: {sum(1 for x in out.values() if x['emails'])}")
