#!/usr/bin/env python3
"""Stage 1: parse TravelAgencies_MASTER_v3.xlsx and normalize contacts.

Reads the Master sheet, keeps every original value untouched, and ADDS
normalized fields (typed phones, split emails, root domain). Output is
JSONL — one record per agency — consumed by the later stages.

Usage: 10_parse_normalize.py <v3.xlsx> <out.jsonl>
"""
import sys, json, re
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import split_phones, split_emails, valid_email, email_role, is_placeholder_phone
import openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]

wb = openpyxl.load_workbook(SRC, read_only=True)
ws = wb['Master']
rows = ws.iter_rows(values_only=True)
headers = [str(h) if h is not None else '' for h in next(rows)]

def root_domain(d):
    if not d: return ''
    d = re.sub(r'^https?://(www\.)?', '', str(d).strip().lower()).split('/')[0].split(':')[0]
    return d

records = []
for r in rows:
    rec = {headers[i]: r[i] for i in range(min(len(headers), len(r)))}
    if not any(v not in (None, '') for v in rec.values()):
        continue
    # --- phones: MOT Phones + SBC phones + Extra Phones + WhatsApp column
    ph = split_phones(rec.get('MOT Phones'), rec.get('SBC Official Phone'),
                      rec.get('SBC Support Phone'), rec.get('Extra Phones (TAS v2)'),
                      rec.get('WhatsApp'))
    # placeholders: re-scan raw parts so flagged fakes are visible, not silently dropped
    raw_parts = []
    for cell in (rec.get('MOT Phones'), rec.get('SBC Official Phone'),
                 rec.get('SBC Support Phone'), rec.get('Extra Phones (TAS v2)')):
        raw_parts += [p.strip() for p in re.split(r'[;,/|]', str(cell or '')) if p.strip()]
    placeholders = sorted({p for p in raw_parts
                           if re.sub(r'\D', '', p) and is_placeholder_phone(re.sub(r'\D', '', p))})
    # whatsapp: only ever a mobile
    wa = ''
    wa_raw = split_phones(rec.get('WhatsApp'))
    if wa_raw['mobile']:
        wa = wa_raw['mobile'][0]
    elif ph['mobile']:
        wa = ''  # unknown — a mobile exists but WhatsApp use is unconfirmed; never fake it
    # --- emails
    em = [e for e in split_emails(rec.get('Emails (All)'), rec.get('SBC Support Email'),
                                  rec.get('Extra Emails (TAS v2)')) if valid_email(e)]
    # --- domains
    doms = [root_domain(p) for p in re.split(r'[;,|\s]+', str(rec.get('Domains') or '')) if root_domain(p)]
    email_doms = sorted({e.split('@')[1] for e in em
                         if e.split('@')[1] not in ('gmail.com', 'hotmail.com', 'yahoo.com',
                                                    'outlook.com', 'windowslive.com', 'icloud.com',
                                                    'msn.com', 'live.com', 'hotmail.co.uk')})
    rec['_norm'] = {
        'mobiles': ph['mobile'], 'landlines': ph['landline'], 'hotlines': ph['hotline'],
        'intl': ph['intl'], 'placeholders': placeholders, 'whatsapp': wa,
        'emails': em, 'email_types': [email_role(e) for e in em],
        'domains': doms, 'email_domains': email_doms,
    }
    records.append(rec)

with open(OUT, 'w', encoding='utf-8') as f:
    for rec in records:
        f.write(json.dumps(rec, ensure_ascii=False, default=str) + '\n')

n = len(records)
print(f'rows: {n}')
print(f'with mobile: {sum(1 for r in records if r["_norm"]["mobiles"])}')
print(f'with landline only: {sum(1 for r in records if r["_norm"]["landlines"] and not r["_norm"]["mobiles"])}')
print(f'with any valid email: {sum(1 for r in records if r["_norm"]["emails"])}')
print(f'with domain: {sum(1 for r in records if r["_norm"]["domains"])}')
print(f'placeholder phones flagged: {sum(len(r["_norm"]["placeholders"]) for r in records)}')
print(f'with CR: {sum(1 for r in records if r.get("CR / Unified No. (SBC)"))}')
print(f'unique domains: {len({d for r in records for d in r["_norm"]["domains"]})}')
