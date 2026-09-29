/**
 * The catalog a person reads (V410): their language, with English beneath it — a key not yet written in Arabic shows
 * its English, never its key or an error. The catalog check keeps both files complete; this is what a person sees if
 * one slips through.
 */
export type Messages = { [key: string]: string | Messages };

export function withFallback(primary: Messages, fallback: Messages): Messages {
  const out: Messages = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    const under = fallback[key];
    out[key] =
      typeof value === 'object' && value !== null && typeof under === 'object' && under !== null
        ? withFallback(value, under)
        : value;
  }
  return out;
}
