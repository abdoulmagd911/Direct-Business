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

export async function writePptx(zip: JSZip, stamp: Date): Promise<Uint8Array> {
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
