// Reading a CSV file in the browser: one small parser, no dependency.
//
// Direct's exports are CSV. A quoted field may hold a comma, a line break, or a doubled
// quote (""), and a file may end its lines with CRLF; a byte-order mark at the start is
// dropped. Anything else is kept as it stands — no trimming, no guessing — so the
// signature check and the normaliser see the file's own headers and values.
export function parseCsv(text: string): string[][] {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const c = src[i] as string;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
      continue;
    }
    if (c === '"' && field === '') {
      inQuotes = true;
      i += 1;
    } else if (c === ',') {
      endField();
      i += 1;
    } else if (c === '\r') {
      if (src[i + 1] === '\n') i += 1;
      endRow();
      i += 1;
    } else if (c === '\n') {
      endRow();
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
