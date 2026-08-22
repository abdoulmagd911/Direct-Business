#!/usr/bin/env python3
"""Stage 2g: recover the "TAS v2 leftovers" sheet that v3 parked.

v3 set 243 rows aside as "empty shells". They are not empty: 175 carry a company
name, 140 an email, 47 a phone. This reads them, works out which are already in
the master (so they only add data) and which are companies missing from it
entirely, and writes them in the same normalised shape as everything else.

Usage: 26_recover_leftovers.py <v3.xlsx> <work.jsonl> <out.jsonl>
"""
import sys, json, re
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import split_phones, split_emails, valid_email, norm_name
import openpyxl

SRC, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

FREEMAIL = {'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'live.com',
            'msn.com', 'aol.com', 'mail.ru', 'yandex.com', 'protonmail.com', 'me.com'}

recs = [json.loads(l) for l in open(WORK, encoding='utf-8')]
known_names = {}
known_emails = {}
known_doms = {}
for r in recs:
    n = norm_name(r.get('Agency Name (EN)'))
    if n and len(n) > 4: known_names.setdefault(n, r.get('Row ID'))
    for e in r['_norm']['emails']: known_emails.setdefault(e.lower(), r.get('Row ID'))
    for d in r['_norm']['domains']: known_doms.setdefault(d.lower(), r.get('Row ID'))

wb = openpyxl.load_workbook(SRC, read_only=True)
ws = wb['TAS v2 leftovers']
rows = list(ws.iter_rows(values_only=True))
hdr = [str(h) if h else '' for h in rows[0]]
data = [dict(zip(hdr, r)) for r in rows[1:]]

def g(d, *keys):
    for k in keys:
        v = d.get(k)
        if v is not None and str(v).strip() and str(v).strip().lower() not in ('none', 'nan'):
            return str(v).strip()
    return ''

out = []
dup_name = dup_email = dup_dom = new = 0
for d in data:
    en = g(d, 'entity_en')
    ar = g(d, 'entity_ar')
    emails = [e for e in split_emails(g(d, 'contact_1_email'), g(d, 'email_primary'),
                                      g(d, 'email_secondary')) if valid_email(e)]
    ph = split_phones(g(d, 'contact_1_phone'), g(d, 'official_phone'),
                      g(d, 'mobile_primary'), g(d, 'mobile_secondary'))
    doms = sorted({e.split('@')[1].lower() for e in emails
                   if e.split('@')[1].lower() not in FREEMAIL})

    # does this already exist in the master?
    match = None
    why = ''
    for e in emails:
        if e.lower() in known_emails:
            match, why = known_emails[e.lower()], f'same email {e}'
            break
    if not match:
        for dm in doms:
            if dm in known_doms:
                match, why = known_doms[dm], f'same domain {dm}'
                break
    if not match:
        n = norm_name(en)
        if n and len(n) > 4 and n in known_names:
            match, why = known_names[n], f'same name "{en}"'
    if match:
        if 'email' in why: dup_email += 1
        elif 'domain' in why: dup_dom += 1
        else: dup_name += 1
    else:
        new += 1

    if not (en or ar or emails or ph['mobile'] or ph['landline']):
        continue        # genuinely empty — skip

    out.append({
        'Row ID': 'L' + str(g(d, 'row_id') or len(out)),
        'Agency Name (EN)': en,
        'Agency Name (AR)': ar,
        'Domains': ' | '.join(doms),
        'Emails (All)': ' | '.join(emails),
        'Contact Names': g(d, 'contact_1_name'),
        'License Numbers (MOT)': g(d, 'official_licence_number'),
        'IATA Number': g(d, 'iata_wakeel_number'),
        'HQ City': g(d, 'hq_city'),
        'Lead Sources': 'TAS v2 leftovers (recovered 2026-08-13)' +
                        (' | ' + g(d, 'lead_source') if g(d, 'lead_source') else ''),
        'Notes': g(d, 'notes')[:300],
        'Needs Manual Confirmation': not bool(match),
        '_existing_match': match or '',
        '_match_reason': why,
        '_norm': {
            'mobiles': ph['mobile'], 'landlines': ph['landline'], 'hotlines': ph['hotline'],
            'intl': ph['intl'], 'placeholders': [], 'whatsapp': '',
            'emails': emails, 'email_types': [], 'domains': doms, 'email_domains': doms,
        },
    })

with open(OUT, 'w', encoding='utf-8') as f:
    for r in out:
        f.write(json.dumps(r, ensure_ascii=False, default=str) + '\n')

print(f'leftover rows read: {len(data)}')
print(f'usable (have a name or a contact): {len(out)}')
print(f'already in the master — will only ADD data: {dup_email + dup_dom + dup_name}'
      f'  (by email {dup_email}, by domain {dup_dom}, by name {dup_name})')
print(f'companies MISSING from the master entirely: {new}')
print(f'  of the usable rows: with email {sum(1 for r in out if r["_norm"]["emails"])}, '
      f'with phone {sum(1 for r in out if r["_norm"]["mobiles"] or r["_norm"]["landlines"])}, '
      f'with name {sum(1 for r in out if r["Agency Name (EN)"] or r["Agency Name (AR)"])}')
