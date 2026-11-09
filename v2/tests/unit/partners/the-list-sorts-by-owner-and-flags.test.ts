import { describe, expect, it } from 'vitest';
import { byAddedAt, compareFlags, compareOwner } from '@/modules/partners/sort';
import type { PartnerRow } from '@/modules/partners/types';

// FIX-01 (D28): the partners list's Owner and Flags columns sort on their values, and two rows that sort the same
// keep their order by added-at, then id. Every value is made up (rule 7).
const partner = (over: Partial<PartnerRow>): PartnerRow => ({
  id: 'p1',
  number: 'DK-P-0001',
  trade_name_en: 'Made-up org',
  trade_name_ar: null,
  type: null,
  status: null,
  owner_id: null,
  sides: [],
  priority_id: null,
  key_partner: false,
  logo_file_id: null,
  last_activity_on: null,
  flags: [],
  archived: false,
  version: 1,
  created_at: '2026-10-01T06:00:00Z',
  ...over,
});

describe('the partners list sorts stably (FIX-01, D28)', () => {
  it('added-at, newest first, then id', () => {
    const a = partner({ id: 'p2', created_at: '2026-10-02T06:00:00Z' });
    const b = partner({ id: 'p1', created_at: '2026-10-02T06:00:00Z' });
    const c = partner({ id: 'p3', created_at: '2026-10-01T06:00:00Z' });
    expect([a, b, c].sort(byAddedAt).map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('owner by name, then added-at, then id', () => {
    const names: Record<string, string> = { o1: 'Sara', o2: 'Sara', o3: 'Omar' };
    const rows = [
      partner({ id: 'p2', owner_id: 'o1', created_at: '2026-10-01T06:00:00Z' }),
      partner({ id: 'p1', owner_id: 'o2', created_at: '2026-10-02T06:00:00Z' }),
      partner({ id: 'p3', owner_id: 'o3', created_at: '2026-10-03T06:00:00Z' }),
    ];
    const nameOf = (r: PartnerRow) => names[r.owner_id ?? ''] ?? '';
    expect([...rows].sort((a, b) => compareOwner(a, b, nameOf)).map((r) => r.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('flags by their joined words, then added-at, then id', () => {
    const rows = [
      partner({ id: 'p2', flags: ['stale'], created_at: '2026-10-01T06:00:00Z' }),
      partner({ id: 'p1', flags: ['stale'], created_at: '2026-10-02T06:00:00Z' }),
      partner({ id: 'p3', flags: ['key'], created_at: '2026-10-03T06:00:00Z' }),
    ];
    expect([...rows].sort(compareFlags).map((r) => r.id)).toEqual(['p3', 'p1', 'p2']);
  });
});
