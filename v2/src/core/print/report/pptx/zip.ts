import JSZip from 'jszip';

/**
 * The last step of every PPTX (V301): one file per report, whenever it is made. pptxgenjs stamps the moment of
 * writing into `docProps/core.xml` and into every zip entry; both become the report's own date here, so the same
 * snapshot always gives the same bytes (plan P6-2). This is also the door the template path goes through (JSZip:
 * open, edit the XML, write back).
 */
export async function openPptx(bytes: Uint8Array | ArrayBuffer): Promise<JSZip> {
  return JSZip.loadAsync(bytes);
}

/**
 * One `<a:pPr>` per paragraph, as its first child. pptxgenjs writes a paragraph's settings before every run of a
 * paragraph made of several runs (a tile's figure and its "ريال"), which the file format does not allow — PowerPoint
 * may offer to repair such a deck. The paragraph keeps its first settings (its direction among them); later copies are
 * dropped.
 */
export function oneSettingsPerParagraph(xml: string): string {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (paragraph: string, body: string) => {
    let first = true;
    const kept = body.replace(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, (ppr: string, at: number) => {
      const keep = first && at === 0;
      first = false;
      return keep ? ppr : '';
    });
    return kept === body ? paragraph : `<a:p>${kept}</a:p>`;
  });
}

/**
 * `rtl`: an Arabic deck — every text box is marked right to left as well as its paragraphs (`rtlCol`, which
 * pptxgenjs always writes as "0").
 */
export async function writePptx(zip: JSZip, stamp: Date, opts: { rtl?: boolean } = {}): Promise<Uint8Array> {
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    const xml = await zip.file(name)!.async('string');
    let fixed = oneSettingsPerParagraph(xml);
    if (opts.rtl) fixed = fixed.replace(/(<a:bodyPr\b[^>]*?)\srtlCol="0"/g, '$1 rtlCol="1"');
    if (fixed !== xml) zip.file(name, fixed);
  }
  // The package lists only parts it holds: pptxgenjs lists slide masters it never writes, and a template slide can
  // leave with its notes page (QA-81).
  const typesFile = zip.file('[Content_Types].xml');
  if (typesFile) {
    const types = await typesFile.async('string');
    const kept = types.replace(/<Override PartName="\/([^"]+)"[^>]*\/>/g, (tag: string, part: string) =>
      zip.file(part) ? tag : '',
    );
    if (kept !== types) zip.file('[Content_Types].xml', kept);
  }
  const core = zip.file('docProps/core.xml');
  if (core) {
    const iso = stamp.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const xml = (await core.async('string'))
      .replace(/(<dcterms:created[^>]*>)[^<]*(<\/dcterms:created>)/, `$1${iso}$2`)
      .replace(/(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/, `$1${iso}$2`);
    zip.file('docProps/core.xml', xml);
  }
  const out = new JSZip();
  // Entries in a fixed order with a fixed date: `[Content_Types].xml` first, as Office expects, then by name.
  const names = Object.keys(zip.files)
    .filter((n) => !zip.files[n]?.dir)
    .sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const data = await zip.file(name)!.async('uint8array');
    out.file(name, data, { date: stamp, createFolders: false });
  }
  return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
