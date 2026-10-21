/**
 * The app never draws a raw key such as `profile.densityHint` (QA-574). Two layers:
 *  1. a message with no Arabic yet reads in English — `withEnglishFallback` lays the Arabic catalog over the English one;
 *  2. a key in neither catalog draws nothing — `noRawKey` is next-intl's getMessageFallback, and the missing key is still
 *     reported through next-intl's own error log, so the gap is found and filled instead of shown to a person.
 */
type Catalog = { [key: string]: string | Catalog };

const isCatalog = (v: unknown): v is Catalog => typeof v === 'object' && v !== null && !Array.isArray(v);

/** `base` with every line of `over` laid on top, block by block; a line `over` lacks keeps `base`'s. */
export function withEnglishFallback(base: Catalog, over: Catalog): Catalog {
  const out: Catalog = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const under = out[key];
    out[key] = isCatalog(value) && isCatalog(under) ? withEnglishFallback(under, value) : value;
  }
  return out;
}

/** What a message found in no catalog draws: nothing, never its key. */
export const noRawKey = () => '';
