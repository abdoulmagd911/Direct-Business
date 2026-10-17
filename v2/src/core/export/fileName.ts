import { clockText, riyadhClock } from './columns';

/**
 * An export's file name: the list's name and the export time in Riyadh (D20), in the importer's own pattern
 * (`<name>_YYYY-MM-DD_HH-MM-SS.<ext>`, spec §3.11), e.g. `Clients_2026-09-29_14-05-33.csv`. Arabic names stay Arabic;
 * characters no system allows in a file name are dropped and spaces become "-".
 */
export function exportFileName(list: string, at: Date, ext: 'csv' | 'xlsx'): string {
  const name =
    Array.from(
      list
        .normalize('NFC')
        .replace(/[<>:"/\\|?*\u{0000}-\u{001F}\u{007F}]/gu, ' ')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/^[.-]+|[.-]+$/g, ''),
    )
      .slice(0, 80)
      .join('') || 'export';
  const stamp = clockText(riyadhClock(at)).replace(' ', '_').replace(/:/g, '-');
  return `${name}_${stamp}.${ext}`;
}
