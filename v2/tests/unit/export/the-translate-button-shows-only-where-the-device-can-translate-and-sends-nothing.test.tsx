// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateButton } from '@/core/print/translate/TranslateButton';
import { translatorState } from '@/core/print/translate/onDevice';

/**
 * The Translate helper (V76, V403, V302): the button exists only where the browser can translate on the device —
 * absent, not disabled, anywhere else (other browsers, phones, a Chrome without the feature); a click drafts the other
 * language (either direction) with Latin digits; and the text never leaves the device — the helper calls no network
 * API, at run time or in its source.
 * Sabotages: `translate-shows-without-a-translator`, `translate-sends-the-text-away` (tests/sabotage/export.mjs).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** A stand-in for Chrome's Translator: availability as given, translation into a fixed Arabic sentence. */
function fakeTranslator(availability: string | Error, output = 'تم توقيع ١٤ عقداً تجريبياً بقيمة ٢٬٤٠٠ ريال') {
  const translate = vi.fn(async (text: string) => (text ? output : ''));
  const create = vi.fn(async (opts: { monitor?: (m: EventTarget) => void }) => {
    const m = new EventTarget();
    opts.monitor?.(m);
    m.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded: 1 }));
    return { translate };
  });
  const api = {
    availability: vi.fn(async () => {
      if (availability instanceof Error) throw availability;
      return availability;
    }),
    create,
  };
  return { scope: { Translator: api }, api, translate };
}

async function draw(
  scope: object,
  source = 'Signed 14 test contracts worth 2,400 SAR',
  onDraft = vi.fn(),
  dir: { from: 'en' | 'ar'; to: 'en' | 'ar' } = { from: 'en', to: 'ar' },
) {
  await act(async () => {
    root.render(
      <TranslateButton source={source} {...dir} onDraft={onDraft} label="Translate to Arabic" scope={scope} />,
    );
  });
  await act(async () => {}); // the availability check resolves
  return { button: host.querySelector('button'), onDraft };
}

describe('the Translate to Arabic button', () => {
  it('is absent where the browser has no Translator', async () => {
    expect(await translatorState('en', 'ar', {})).toBe('unavailable');
    const { button } = await draw({});
    expect(button, 'no button at all — not a disabled one').toBeNull();
    expect(host.textContent).toBe('');
  });

  it('is absent where the Translator cannot do English to Arabic, or its check fails', async () => {
    expect((await draw(fakeTranslator('unavailable').scope)).button).toBeNull();
    expect((await draw(fakeTranslator(new Error('policy')).scope)).button).toBeNull();
  });

  it('is absent while there is no English text to translate', async () => {
    expect((await draw(fakeTranslator('available').scope, '   ')).button).toBeNull();
  });

  it('shows where the language pack can be downloaded or is there, and gives an Arabic draft with Latin digits', async () => {
    for (const availability of ['downloadable', 'available']) {
      const t = fakeTranslator(availability);
      const { button, onDraft } = await draw(t.scope);
      expect(button?.textContent).toBe('Translate to Arabic');
      await act(async () => button?.click());
      expect(t.api.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceLanguage: 'en', targetLanguage: 'ar' }),
      );
      expect(t.translate).toHaveBeenCalledWith('Signed 14 test contracts worth 2,400 SAR', expect.anything());
      expect(onDraft).toHaveBeenCalledWith('تم توقيع 14 عقداً تجريبياً بقيمة 2,400 ريال');
    }
  });

  it('drafts English from Arabic too, asking the Translator for that direction', async () => {
    const t = fakeTranslator('available', 'Signed 14 test contracts worth 2,400 SAR');
    const { button, onDraft } = await draw(t.scope, 'تم توقيع 14 عقداً تجريبياً', vi.fn(), { from: 'ar', to: 'en' });
    await act(async () => button?.click());
    expect(t.api.availability).toHaveBeenCalledWith({ sourceLanguage: 'ar', targetLanguage: 'en' });
    expect(t.api.create).toHaveBeenCalledWith(expect.objectContaining({ sourceLanguage: 'ar', targetLanguage: 'en' }));
    expect(onDraft).toHaveBeenCalledWith('Signed 14 test contracts worth 2,400 SAR');
  });

  it('sends nothing anywhere while it translates', async () => {
    const fetchSpy = vi.fn(async () => new Response(''));
    vi.stubGlobal('fetch', fetchSpy);
    const openSpy = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    const ws = vi.fn();
    vi.stubGlobal('WebSocket', ws);
    const t = fakeTranslator('available');
    const { button, onDraft } = await draw(t.scope);
    await act(async () => button?.click());
    expect(onDraft).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(ws).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('holds no network call in its source', () => {
    const dir = path.resolve(import.meta.dirname, '../../../src/core/print/translate');
    const NETWORK = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|@\/core\/db|supabase|https?:\/\//;
    for (const f of fs.readdirSync(dir)) {
      const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(code.match(NETWORK)?.[0], `${f} reaches the network`).toBeUndefined();
    }
  });

  it('reports a failed download and tries again on the next click', async () => {
    const t = fakeTranslator('downloadable');
    t.api.create.mockRejectedValueOnce(new Error('download cancelled'));
    const onError = vi.fn();
    const onDraft = vi.fn();
    await act(async () => {
      root.render(
        <TranslateButton
          source="Hello"
          from="en"
          to="ar"
          onDraft={onDraft}
          onError={onError}
          label="Translate to Arabic"
          scope={t.scope}
        />,
      );
    });
    await act(async () => {});
    const button = host.querySelector('button');
    await act(async () => button?.click());
    expect(onError).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector('button')?.click());
    expect(t.api.create).toHaveBeenCalledTimes(2);
    expect(onDraft).toHaveBeenCalledTimes(1);
  });
});
