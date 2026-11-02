/**
 * No profile photo in any export (V493, the owner's decision of 30 Sep): CSV, Excel, PDF, PPTX and the KPI sheet carry
 * names, never pictures. A column named for a photo is refused before anything is read, and a picture that reaches a
 * cell as data is refused there — a screen leaves its photo column out with `omit`, like its buttons (OA23).
 */
const PHOTO_KEY = /(^|[_.-])(avatar|photo|picture)s?([_.-]|$)|avatarurl|photourl/i;

/** A picture's bytes written as text: `data:image/png;base64,…`. */
const PICTURE = /^\s*data:image\//i;

export class ExportPhotoRefused extends Error {
  constructor(readonly column: string) {
    super(`export: column "${column}" would carry a profile photo — no export ever does (V493)`);
    this.name = 'ExportPhotoRefused';
  }
}

export function isPhotoColumn(key: string): boolean {
  return PHOTO_KEY.test(key);
}

export function isPicture(value: string): boolean {
  return PICTURE.test(value);
}
