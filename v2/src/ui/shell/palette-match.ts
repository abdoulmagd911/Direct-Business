/**
 * Finding 6 (26 Oct): the palette finds an entry by the words it shows, typed the way they read. Case, the dot between
 * words (Create · Capture), dashes and spaces count for nothing, so "create · capture", "Create Capture" and "capture"
 * all find "Create · Capture".
 */
const fold = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/[·•|:,\-–—/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Whether `label`, as shown, answers what was typed; nothing typed answers everything. */
export const paletteMatches = (label: string, typed: string): boolean => {
  const want = fold(typed);
  return !want || fold(label).includes(want);
};
