// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cellOf, exportList, ExportPhotoRefused, type ExportColumn, type ExportListInput } from '@/core/export';
import { sampleColumns, sampleRows, standIn, type SampleRow } from './list-tools';

/**
 * V493 (the owner's decision of 30 Sep 00:34): no export — CSV, Excel, PDF, PPTX, the KPI sheet — ever carries a
 * profile photo. A column named for a photo is refused by name before anything is read (a screen leaves it out with
 * `omit`, like its buttons), a picture that reaches a cell as data is refused, and no export or print code reads a
 * person's photo at all.
 * Sabotages: `export-writes-a-photo-column`, `export-writes-a-picture`, `export-code-reads-a-photo`
 * (tests/sabotage/export-lists.mjs).
 */
const V2 = path.resolve(import.meta.dirname, '../../..');
const at = new Date('2026-09-29T11:05:33Z');

const withPhoto = (key: string): ExportColumn<SampleRow>[] => [
  ...sampleColumns,
  { key, header: 'Photo', kind: 'text', value: () => 'https://example.test/p/r00001.png' },
];

const run = (columns: readonly ExportColumn<SampleRow>[], extra: Partial<ExportListInput<SampleRow>> = {}) => {
  const api = standIn(sampleRows(3), { count: true });
  const out = exportList<SampleRow>({
    list: 'People',
    columns,
    page: api.page,
    format: 'csv',
    lang: 'en',
    at,
    seesFinance: true,
    financeOnly: 'Finance only',
    ...extra,
  });
  return { out, api };
};

describe('V493 — no profile photo in any export', () => {
  for (const key of ['avatar', 'avatar_url', 'avatarUrl', 'photo', 'profile_photo', 'photo_url', 'picture'])
    it(`V493: refuses a "${key}" column by name, before reading anything`, async () => {
      const { out, api } = run(withPhoto(key));
      await expect(out, 'a photo column is refused (V493)').rejects.toBeInstanceOf(ExportPhotoRefused);
      expect(api.asked, 'nothing was read').toEqual([]);
    });

  it('V493: takes a photo the screen shows and leaves out with its reason, and writes the rest', async () => {
    const { out } = run(sampleColumns, {
      visible: ['avatar', 'number', 'partner'],
      omit: { avatar: 'a picture, not data' },
    });
    await expect(out).resolves.toMatchObject({ rows: 3, omitted: [{ key: 'avatar', reason: 'a picture, not data' }] });
  });

  it('V493: never writes a picture that reaches a cell as data', () => {
    const column = { key: 'notes', kind: 'text' as const };
    expect(() => cellOf(column, 'data:image/png;base64,iVBORw0KGgo='), 'a picture is refused (V493)').toThrow(
      ExportPhotoRefused,
    );
    expect(cellOf(column, 'Sent the photo of the made-up venue')).toEqual({
      t: 'text',
      v: 'Sent the photo of the made-up venue',
    });
  });

  it('V493: no export or print code reads a person’s photo', () => {
    const roots = ['src/core/export', 'src/core/print'].map((d) => path.join(V2, d)).filter((d) => fs.existsSync(d));
    const files = roots.flatMap((d) =>
      (fs.readdirSync(d, { recursive: true }) as string[])
        .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('photo.ts'))
        .map((f) => path.join(d, f)),
    );
    expect(files.length).toBeGreaterThan(5);
    const found = files.filter((f) =>
      /\bavatar\w*|\bphoto_?url\b|\bprofile_?photo\b|\bbadge_value\b/i.test(fs.readFileSync(f, 'utf8')),
    );
    expect(
      found.map((f) => path.relative(V2, f)),
      'no export code reads a photo (V493)',
    ).toEqual([]);
  });
});
