import { docText } from '../text';

/**
 * The Translate helper (V76, V403, V302): Chrome's built-in, on-device Translator API, in either direction — staff
 * write a report line in Arabic or English, and the other language is drafted for them to correct. The text is
 * translated by a model on the person's own machine — nothing is sent anywhere, and no paid service is used. Where the
 * API does not exist (other browsers, Chrome on a phone, a Chrome without the feature) the helper reports
 * "unavailable" and the button is never drawn. This module calls no network API at all; a unit test holds it to that.
 *
 * Measured on 29 Sep with Chrome 154 (desktop build): `Translator.availability()` answers "downloadable" for English →
 * Arabic on a fresh profile; the first `create()` — which needs a click (user activation) — downloads the language
 * pack (about 106 MB for Arabic ⇄ English, once per machine), after which it answers "available".
 */

export type TranslatorState = 'unavailable' | 'downloadable' | 'downloading' | 'available';

/** The part of the API the app uses. */
interface OnDeviceTranslator {
  translate(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  destroy?(): void;
}
interface TranslatorApi {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
    signal?: AbortSignal;
  }): Promise<OnDeviceTranslator>;
}

export type Language = 'en' | 'ar';
const pair = (from: Language, to: Language) => ({ sourceLanguage: from, targetLanguage: to });
const STATES: readonly string[] = ['unavailable', 'downloadable', 'downloading', 'available'];

export class TranslatorUnavailable extends Error {
  constructor() {
    super('translate.unavailable');
    this.name = 'TranslatorUnavailable';
  }
}

/** The browser's Translator, or null. Feature detection only — nothing is loaded from anywhere. */
function translatorApi(scope: object = globalThis): TranslatorApi | null {
  const api = (scope as { Translator?: Partial<TranslatorApi> }).Translator;
  return api && typeof api.availability === 'function' && typeof api.create === 'function'
    ? (api as TranslatorApi)
    : null;
}

/** Whether `from` → `to` can run on this device. Any failure of the check reads as "unavailable". */
export async function translatorState(from: Language, to: Language, scope?: object): Promise<TranslatorState> {
  const api = translatorApi(scope);
  if (!api) return 'unavailable';
  try {
    const state = await api.availability(pair(from, to));
    return STATES.includes(state) ? (state as TranslatorState) : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** One translator per page and direction, made on first use. */
const made = new WeakMap<object, Map<string, Promise<OnDeviceTranslator>>>();

/**
 * `from` → `to` on the device. The first call may download the language pack (`onProgress` gets 0…1) and must come
 * from a click. The result is a draft for a person to correct (V76), with Latin digits (V40).
 */
export async function translateOnDevice(
  text: string,
  options: {
    from: Language;
    to: Language;
    onProgress?: (share: number) => void;
    signal?: AbortSignal;
    scope?: object;
  },
): Promise<string> {
  const scope = options.scope ?? globalThis;
  const api = translatorApi(scope);
  if (!api) throw new TranslatorUnavailable();
  const key = `${options.from}>${options.to}`;
  const mine = made.get(scope) ?? new Map<string, Promise<OnDeviceTranslator>>();
  made.set(scope, mine);
  let translator = mine.get(key);
  if (!translator) {
    translator = api.create({
      ...pair(options.from, options.to),
      signal: options.signal,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => options.onProgress?.((e as ProgressEvent).loaded));
      },
    });
    mine.set(key, translator);
    // A failed creation (cancelled download, no disk space) is not kept: the next click tries again.
    translator.catch(() => mine.delete(key));
  }
  const out = await (await translator).translate(text, { signal: options.signal });
  return docText(out);
}
