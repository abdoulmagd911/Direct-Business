#!/usr/bin/env python3
"""Stage 3: merge crawl results into the records, fill what can be derived
honestly, and write TravelAgencies_MASTER_v4.xlsx (+ phone-readable preview).

Rules honoured: never invent a value (blank = unknown); every added field
carries a source; original v3 columns are preserved untouched; new data goes
in NEW columns.

Usage: 30_enrich_build_v4.py <work.jsonl> <crawl.jsonl> <out.xlsx> <preview.txt>
"""
import sys, json, re
sys.path.insert(0, '/root/.claude/skills/synced/contact-data-consolidation/scripts')
from normalize import write_master_workbook, valid_email, maps_url, priority_score, completeness

WORK, CRAWL, OUT, PREVIEW = sys.argv[1:5]

crawl = {}
for line in open(CRAWL, encoding='utf-8'):
    c = json.loads(line)
    crawl[c['domain']] = c

# Saudi landline area codes -> administrative region
AREA = {'11': 'Riyadh', '12': 'Makkah', '13': 'Eastern Province',
        '14': 'Madinah / Tabuk / North', '16': 'Qassim / Hail',
        '17': 'Asir / Jazan / Najran / Baha'}

records = [json.loads(l) for l in open(WORK, encoding='utf-8')]

CR10 = re.compile(r'^\d{10}$')

rows = []
for rec in records:
    nm = rec['_norm']
    r = {k: ('' if v is None else v) for k, v in rec.items() if k != '_norm'}

    # --- crawl results for this agency's domains
    cres = [crawl[d] for d in nm['domains'] if d in crawl]
    live = [c for c in cres if c['status'] == 'live']
    site_cr = sorted({x for c in cres for x in c.get('site_cr', [])})
    site_vat = sorted({x for c in cres for x in c.get('site_vat', [])})
    site_lic = sorted({x for c in cres for x in c.get('site_licence', [])})
    site_em = sorted({x for c in cres for x in c.get('site_emails', [])})
    site_ph = sorted({x for c in cres for x in c.get('site_phones', [])})
    if cres:
        statuses = {c['status'] for c in cres}
        r['Website Live Check 2026-08-13'] = ('live' if 'live' in statuses
                                              else 'parked/thin' if 'parked/thin' in statuses
                                              else 'dead')
    else:
        r['Website Live Check 2026-08-13'] = ''
    r['Site CR Found'] = ' | '.join(site_cr)
    r['Site VAT Found'] = ' | '.join(site_vat)
    r['Site Licence Found'] = ' | '.join(site_lic)
    r['Site Emails Found'] = ' | '.join(site_em[:4])
    r['Site Phones Found'] = ' | '.join(site_ph[:4])

    # --- CR reconciliation: SBC value vs what the site publishes
    sbc_cr = re.sub(r'\D', '', str(rec.get('CR / Unified No. (SBC)') or ''))
    cr_final, cr_source = '', ''
    if sbc_cr and CR10.match(sbc_cr):
        cr_final, cr_source = sbc_cr, 'SBC eAuthenticate (July)'
        if site_cr and sbc_cr not in site_cr:
            cr_source += ' — SITE DISAGREES: ' + site_cr[0]
    elif len(site_cr) == 1 and CR10.match(site_cr[0]):
        cr_final, cr_source = site_cr[0], 'company website (2026-08-13 crawl)'
    elif len(site_cr) > 1:
        cr_source = 'ambiguous — site shows multiple: ' + ' | '.join(site_cr)
    r['CR (best)'] = cr_final
    r['CR Source'] = cr_source

    # --- verification level per the confirmation standard
    has_licence = bool(rec.get('License Numbers (MOT)'))
    if cr_final and cr_source.startswith(('SBC', 'company website')) and 'DISAGREES' not in cr_source:
        level = 'confirmed'
    elif has_licence or live or nm['emails'] or nm['mobiles']:
        level = 'candidate'
    else:
        level = 'unverified'
    r['Verification Level'] = level

    # --- typed contacts
    mob = nm['mobiles']
    r['Mobile 1'] = mob[0] if mob else ''
    r['Mobile 2'] = mob[1] if len(mob) > 1 else ''
    r['Landline 1'] = nm['landlines'][0] if nm['landlines'] else ''
    r['Hotline'] = nm['hotlines'][0] if nm['hotlines'] else ''
    r['WhatsApp (confirmed)'] = nm['whatsapp']
    em = nm['emails']
    r['Email 1'] = em[0] if em else ''
    r['Email 2'] = em[1] if len(em) > 1 else ''
    r['Email 3'] = em[2] if len(em) > 2 else ''
    r['Placeholder Phones (ignored)'] = ' | '.join(nm['placeholders'][:4])

    # --- region: keep existing; else derive from landline area code
    region = str(rec.get('HQ Region') or '').strip()
    rsrc = 'v3' if region else ''
    if not region:
        for ll in nm['landlines']:
            code = ll[4:6]  # +966XX...
            if code in AREA:
                region, rsrc = AREA[code], f'landline area code 0{code}'
                break
    r['Region (best)'] = region
    r['Region Source'] = rsrc

    name = str(rec.get('Agency Name (EN)') or rec.get('Agency Name (AR)') or '')
    city = str(rec.get('HQ City') or '').strip()
    r['Google Maps Search'] = maps_url(name, city) if name else ''

    r['Priority Score'] = priority_score(
        bool(em and valid_email(em[0])), bool(mob),
        'riyadh' in (city + ' ' + region).lower(), bool(live),
        has_licence, bool(nm['whatsapp']))
    r['Completeness %'] = completeness(
        {'n': name, 'm': r['Mobile 1'], 'l': r['Landline 1'], 'e': r['Email 1'],
         'w': r['Website Live Check 2026-08-13'] == 'live' and 'y' or '',
         'c': cr_final, 'lic': rec.get('License Numbers (MOT)'),
         'city': city, 'reg': region},
        ['n', 'm', 'l', 'e', 'w', 'c', 'lic', 'city', 'reg'])
    rows.append(r)

ORIG = [h for h in records[0] if h != '_norm']
NEW = ['Verification Level', 'CR (best)', 'CR Source',
       'Mobile 1', 'Mobile 2', 'Landline 1', 'Hotline', 'WhatsApp (confirmed)',
       'Email 1', 'Email 2', 'Email 3', 'Placeholder Phones (ignored)',
       'Website Live Check 2026-08-13', 'Site CR Found', 'Site VAT Found',
       'Site Licence Found', 'Site Emails Found', 'Site Phones Found',
       'Region (best)', 'Region Source', 'Google Maps Search',
       'Priority Score', 'Completeness %']
COLS = ['Row ID', 'Agency Name (EN)', 'Agency Name (AR)'] + NEW + \
       [c for c in ORIG if c not in ('Row ID', 'Agency Name (EN)', 'Agency Name (AR)')]

DEFS = [
    ('Verification Level', 'confirmed = official ID (CR) backed by SBC or the company\'s own website; candidate = real signals (licence / live site / working contact) but no official ID yet; unverified = nothing checkable yet'),
    ('CR (best)', 'The single best commercial-registration / unified number we have. Blank = unknown (never guessed)'),
    ('CR Source', 'Where the CR came from. "SITE DISAGREES" means the website shows a different number — check by hand'),
    ('Mobile 1 / Mobile 2', 'Clean Saudi mobiles in international format, fakes removed. Safe for SMS/WhatsApp campaigns'),
    ('Landline 1 / Hotline', 'Office numbers (11=Riyadh, 12=Makkah, 13=Eastern...). Hotline = 920/800 numbers'),
    ('WhatsApp (confirmed)', 'Filled ONLY when a source explicitly said this number is WhatsApp'),
    ('Email 1-3', 'Format-validated emails, best first'),
    ('Placeholder Phones (ignored)', 'Fake-looking numbers found in sources (111111..., 123456...) — kept visible, never counted'),
    ('Website Live Check 2026-08-13', 'We visited every website today: live / parked-thin / dead / blank = no website known'),
    ('Site CR / VAT / Licence Found', 'Identifiers the company publishes on its own website (harvested today) — strong verification'),
    ('Site Emails / Phones Found', 'Contacts published on the website — use to fill gaps or cross-check'),
    ('Region (best) + Region Source', 'Region from v3, or derived from the landline area code (source says which)'),
    ('Google Maps Search', 'Click to find the office on Google Maps (search link, no API needed)'),
    ('Priority Score', '0-100: who to work first (reachability + Riyadh + live site + licence)'),
    ('Completeness %', 'How much of the 9 key fields are filled for this row'),
    ('All other columns', 'Carried unchanged from v3 (the July consolidation) — nothing was overwritten'),
]

live_n = sum(1 for r in rows if r['Website Live Check 2026-08-13'] == 'live')
conf = sum(1 for r in rows if r['Verification Level'] == 'confirmed')
cand = sum(1 for r in rows if r['Verification Level'] == 'candidate')
QUAL = [
    ('Total agencies', len(rows)),
    ('Verification: confirmed (official ID)', conf),
    ('Verification: candidate', cand),
    ('Verification: unverified', len(rows) - conf - cand),
    ('CR known (best)', sum(1 for r in rows if r['CR (best)'])),
    ('CR found on company website today', sum(1 for r in rows if r['Site CR Found'])),
    ('VAT found on company website today', sum(1 for r in rows if r['Site VAT Found'])),
    ('Websites checked today', sum(1 for r in rows if r['Website Live Check 2026-08-13'])),
    ('  of which live', live_n),
    ('  of which parked/thin', sum(1 for r in rows if r['Website Live Check 2026-08-13'] == 'parked/thin')),
    ('  of which dead', sum(1 for r in rows if r['Website Live Check 2026-08-13'] == 'dead')),
    ('With clean mobile (campaign-safe)', sum(1 for r in rows if r['Mobile 1'])),
    ('With valid email', sum(1 for r in rows if r['Email 1'])),
    ('With any region (incl. derived)', sum(1 for r in rows if r['Region (best)'])),
    ('Region newly derived from area code', sum(1 for r in rows if str(r['Region Source']).startswith('landline'))),
    ('Placeholder phones flagged', sum(1 for r in rows if r['Placeholder Phones (ignored)'])),
    ('CR conflicts (site vs SBC)', sum(1 for r in rows if 'DISAGREES' in str(r['CR Source']))),
]

top = sorted(rows, key=lambda r: (-r['Priority Score'], -r['Completeness %']))[:20]
prev = ['TRAVEL AGENCIES MASTER v4 — 2026-08-13',
        f'{len(rows)} agencies | {conf} confirmed | {cand} candidates',
        f'{live_n} live websites | {sum(1 for r in rows if r["Mobile 1"])} clean mobiles | {sum(1 for r in rows if r["Email 1"])} emails',
        '', 'TOP 20 TO WORK FIRST (priority score):']
for r in top:
    nm20 = str(r.get('Agency Name (EN)') or r.get('Agency Name (AR)'))[:34]
    prev.append(f'{r["Priority Score"]:>3} | {nm20:<34} | {r["Mobile 1"] or r["Landline 1"] or "-":<13} | {(r["Email 1"] or "-")[:28]}')

TEXT = ['CR (best)', 'Mobile 1', 'Mobile 2', 'Landline 1', 'Hotline', 'WhatsApp (confirmed)',
        'Site CR Found', 'Site VAT Found', 'Site Phones Found', 'MOT Phones', 'IBAN',
        'CR / Unified No. (SBC)', 'SBC Verification No.', 'SBC Official Phone', 'SBC Support Phone']
write_master_workbook(OUT, COLS, rows, DEFS, QUAL, text_cols=TEXT,
                      preview_path=PREVIEW, preview_lines=prev)
print('wrote', OUT)
for k, v in QUAL:
    print(f'{k}: {v}')
