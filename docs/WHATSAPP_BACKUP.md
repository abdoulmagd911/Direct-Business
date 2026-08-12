# WhatsApp backup folder — what's in it (read 2026-08-12)

Drive folder **"WhatsApp backup"** (`10cAZZpnZVJe4XRjKTLSXomNHHqNHqMLH`), uploaded by
Abdulrahman on 2026-08-12. It holds **14 zip files**, each one a WhatsApp *chat export*:
the full conversation as a text file, plus any contact cards (.vcf) and media that were
shared in that chat.

## What was opened and extracted (8 of 14)

Everything 5.5 MB or smaller could be read here. Result:

| Zip | Chat | Covers | Size of chat | Extras |
|---|---|---|---|---|
| WA0088 | **Direct Ahmed Salah** | Jul 2024 → Aug 2026 | 6,760 lines | 33 contact cards |
| WA0084 | **Direct Mohammed Altwijri** | Apr 2025 → Aug 2026 | 10,559 lines | 34 contact cards |
| WA0086 | **Direct Kareem Medhat** | Jul 2025 → Aug 2026 | 1,814 lines | 23 contact cards |
| WA0089 | **دايركت X حجز وتذكرة** (group) | Nov 2025 → Aug 2026 | 4,182 lines | — |
| WA0082 | **Direct Products Saif Amer** | Nov 2025 → Aug 2026 | 941 lines | ~80 images/PDFs |
| WA0083 | **Direct Abdelrahman Sadek** | May 2026 → Aug 2026 | 357 lines | bank statements, Mola app agreement PDF, tax invoice DPIN-299709, `White list.xlsx` |
| WA0077 | **Corporate & Products** (group) | Jun 2026 → Aug 2026 | 191 lines | tax invoice DPIN-305582 |
| WA0080 | **بديل مدفوعات مولا** | — | small | 1 contact card |

These are **internal / operational chats** — Direct staff and the working groups — not
customer conversations. Their value is (a) the contact cards, (b) the operational history
(supplier deals, Amadeus agreement talk, Mola payment-alternative discussion, invoices).

## The contact cards → one sheet, done

All **92 contact cards** were pulled out into one Google Sheet in the same folder:

**`WA-CONTACTS-EXTRACTED`** (`1MY5oW6Cpb6c5YZ9_Hh9i3hbkeLnmLYYLkkWQnWVADfQ`)
— name · phone(s) · email · which card · which zip. 93 unique phone numbers.

What it contains, broadly: **supplier and partner contacts** —
airlines (flyadeal ×2, flynas, طيران ناس), bed banks and consolidators (Hotelbeds,
RateHawk ×2, Webbeds, TBO), hotels (Pullman ZamZam Madina, Sheraton Jeddah,
Le Méridien Riyadh, Dar AlEman, Sofotil Shahd Madina, بريرا الرس / حفر الباطن),
ground transport in KSA, Jordan, Bali, Washington DC, eSIM providers (Simly + نجم الدخيل),
study-abroad partners (Kaplan ×4, Pathways, LCI), Neom, Riyadh Chamber, and Direct's own
staff. Four Arabic names arrived garbled from the export and were reconstructed — they are
marked "(name garbled in export)" in the sheet.

## Still locked: 6 of 14 (too big to read from here)

The Drive connector refuses files over 10 MB, and these are chat exports **with media**:

| Zip | Size |
|---|---|
| WA0070 | 460 MB |
| WA0079 | 238 MB |
| WA0075 | 55 MB |
| WA0076 | 47 MB |
| WA0087 | 41 MB |
| WA0078 | 12 MB |

We don't know which chats these are. The conversation text itself is always tiny —
the size is photos, voice notes and videos.

**The fix (one step, on the phone):** open each of those chats in WhatsApp →
⋮ menu → *More* → *Export chat* → choose **"Without media"** → save to the same Drive
folder. Each export will be well under 1 MB and can then be read and mined here.

## What to do with the chats themselves — parked

The chat texts are not yet mined. Possible uses, none started:

- Pull supplier terms/prices mentioned in the ops chats into the Suppliers area.
- Cross-check the contact sheet against `businesses`/`contacts` before any import —
  the locked matching rule applies (CR number > domain > exact name > phone prefix);
  most of these are **suppliers, not leads**, so they belong on the supplier side,
  not in the pipeline.
- The Mola agreement PDF and the two DPIN tax invoices in WA0083/WA0077 are documents
  worth filing properly in Drive rather than living inside a chat export.
