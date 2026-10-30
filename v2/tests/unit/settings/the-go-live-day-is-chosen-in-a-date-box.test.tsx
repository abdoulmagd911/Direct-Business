/**
 * The day the app went live (app.go_live_on) is chosen in the date box — with the real calendar behind it, never typed as
 * 2026-10-27 — and the card writes it the one way the app writes a date (27 Oct 2026; in Arabic its own month). Nothing
 * chosen yet reads as not set. Made-up day. Sabotages: tests/sabotage/go-live-day.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { SchemaEditor, SchemaValue } from '../../../src/modules/settings/screens/SchemaEditor';
import { DAY_PATTERN } from '../../../src/modules/settings/words';

const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={(locale === 'en' ? en : ar) as never} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );
const schema = { type: 'string', pattern: DAY_PATTERN } as never;

describe('the day the app went live', () => {
  it('is chosen in the date box, which keeps the value the database reads', () => {
    const html = draw(
      <SchemaEditor settingKey="app.go_live_on" schema={schema} value="2026-10-27" onChange={() => {}} label="Day" />,
    );
    expect(html).toContain('data-date-box');
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-27"');
    expect(html).toMatch(/data-date-text[^>]*>27 Oct 2026</);
  });
  it('is written 27 Oct 2026 on the card, and with the Arabic month in Arabic', () => {
    expect(draw(<SchemaValue settingKey="app.go_live_on" value="2026-10-27" />)).toBe('27 Oct 2026');
    expect(draw(<SchemaValue settingKey="app.go_live_on" value="2026-10-27" />, 'ar')).toMatch(/^27 \S+ 2026$/);
  });
  it('reads as not set while no day is chosen', () => {
    expect(draw(<SchemaValue settingKey="app.go_live_on" value="" />)).toBe(en.settings.setting.notSet);
    const html = draw(
      <SchemaEditor settingKey="app.go_live_on" schema={schema} value="" onChange={() => {}} label="Day" />,
    );
    expect(html).toContain('type="date"');
    expect(html).toContain('value=""');
  });
  it('leaves other text settings as plain text boxes', () => {
    const html = draw(
      <SchemaEditor
        settingKey="partner.id_format"
        schema={{ type: 'string', maxLength: 20 } as never}
        value="P-"
        onChange={() => {}}
        label="Format"
      />,
    );
    expect(html).not.toContain('data-date-box');
  });
});
