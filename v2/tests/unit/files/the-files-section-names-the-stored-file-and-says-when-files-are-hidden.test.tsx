/**
 * F-B1-05 ("to.csv") + F-B6-02 (hidden files) + F-B1-09 (Review-on width): the Files section names a file
 * by its stored uploaded name in toasts — never the generated display name, whose empty pattern slots
 * collapse to "… · to" + ".csv" — says "files you cannot see" when the list is empty but files exist that
 * are hidden from this reader, and gives the Review-on date box room for "20 Nov 2026". Made-up values.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { FilesSection, toastFileName, type RecordFile } from '../../../src/ui/record/FilesSection';

const draw = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

const file = (over: Partial<RecordFile> = {}): RecordFile => ({
  id: 'f-1',
  link_id: 'l-1',
  kind: 'agreement',
  kind_en: 'Agreement',
  kind_ar: null,
  purpose: 'agreement',
  side: null,
  display_name_en: 'Agreement · to.csv',
  display_name_ar: null,
  original_name: 'agreement.pdf',
  mime: 'application/pdf',
  size_bytes: 1000,
  sensitivity: 'normal',
  status: 'stored',
  review_on: null,
  review_due: false,
  added_by: null,
  added_by_name: null,
  added_at: '2026-11-12T10:00:00+03:00',
  version: 1,
  ...over,
});

const section = (props: Partial<React.ComponentProps<typeof FilesSection>> = {}) =>
  draw(
    <FilesSection
      entity="partner"
      recordId="p-1"
      kinds={[{ kind: 'agreement', purpose: 'agreement', label: 'Agreement' }]}
      files={[]}
      mayWrite
      onDone={() => {}}
      title="Files"
      {...props}
    />,
  );

describe('a toast names the stored file, never the generated display name (F-B1-05)', () => {
  it('uses the stored uploaded name when there is one', () => {
    expect(toastFileName(file(), 'en')).toBe('agreement.pdf');
    expect(toastFileName(file(), 'ar')).toBe('agreement.pdf');
  });
  it('falls back to the generated name only when no stored name was kept', () => {
    const f = file({ original_name: null, display_name_ar: 'اتفاقية · إلى.csv' });
    expect(toastFileName(f, 'en')).toBe('Agreement · to.csv');
    expect(toastFileName(f, 'ar')).toBe('اتفاقية · إلى.csv');
  });
  it('says nothing rather than a made-up name when there is no name at all', () => {
    expect(toastFileName(file({ original_name: null, display_name_en: null }), 'en')).toBe('');
  });
  it('a row shows the stored name, not the collapsed generated one', () => {
    const html = section({ files: [file()] });
    expect(html).toContain('agreement.pdf');
    expect(html).not.toContain('Agreement · to.csv');
  });
});

describe('an empty Files section says when files are hidden from the reader (F-B6-02)', () => {
  it('says files exist but cannot be seen when the hidden count is above zero', () => {
    const html = section({ files: [], hiddenFiles: 2 });
    expect(html).toContain('There are files you cannot see');
    expect(html).not.toContain('No files yet');
  });
  it('says "No files yet" when nothing is hidden', () => {
    expect(section({ files: [], hiddenFiles: 0 })).toContain('No files yet');
    expect(section({ files: [] })).toContain('No files yet');
  });
  it('says nothing about hidden files once a file is visible', () => {
    const html = section({ files: [file()], hiddenFiles: 2 });
    expect(html).not.toContain('There are files you cannot see');
  });
});

describe('the Review-on date box fits the date as written (F-B1-09)', () => {
  it('is wide enough for "20 Nov 2026" and never squeezed by the row', () => {
    const html = section({
      kinds: [{ kind: 'agreement', purpose: 'agreement', reviewRequired: true, label: 'Agreement' }],
    });
    expect(html).toContain('sm:w-64');
    expect(html).toContain('sm:shrink-0');
    expect(html).not.toContain('sm:w-48');
  });
});
