import fs from 'node:fs';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, vi } from 'vitest';
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import { listsOf, settingsGroups } from '../../src/modules/settings/groups';
import { SettingsGroup } from '../../src/modules/settings/screens/SettingsGroup';
import { OrgAccess } from '../../src/modules/org/screens/OrgAccess';
import { registrySettings } from './settings/arabic-words';
import { fx } from './zz-fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
const OUT = '/tmp/claude-0/s/site/pages';
const t = (loc: 'ar' | 'en', k: string) => k.split('.').reduce<any>((n, p) => n?.[p], loc === 'ar' ? ar : en) as string;
const css = fs.readdirSync('/tmp/claude-0/s/site/_next/static/chunks').filter((f) => f.endsWith('.css'));

function page(loc: 'ar' | 'en', current: string, title: string, body: string) {
  const nav = settingsGroups().map((g) => `<a href="#" class="inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-2 text-base md:min-h-0 ${g.slug === current ? 'bg-surface font-semibold text-text' : 'text-muted'}">${t(loc, g.label)}</a>`).join('');
  return `<!doctype html><html lang="${loc}" dir="${loc === 'ar' ? 'rtl' : 'ltr'}" data-theme="light" data-density="comfortable" style="--font-ui:fontUi;--font-display:fontDisplay;--font-data:fontData"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${css.map((c) => `<link rel="stylesheet" href="../_next/static/chunks/${c}">`).join('')}</head><body><main class="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 md:p-8"><div class="text-sm text-muted">${t(loc, 'settings.title')}</div><h1 class="font-display text-2xl font-semibold">${title}</h1><div class="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10"><nav class="flex flex-wrap gap-1 md:flex-col md:flex-nowrap">${nav}</nav><div class="flex min-w-0 flex-col gap-6 [&>*]:max-w-[880px]">${body}</div></div></main></body></html>`;
}

it('writes the pages', () => {
  for (const loc of ['ar', 'en'] as const) {
    const messages = loc === 'ar' ? ar : en;
    const wrap = (n: React.ReactNode) => renderToStaticMarkup(<NextIntlClientProvider locale={loc} messages={messages} timeZone="Asia/Riyadh">{n}</NextIntlClientProvider>);
    for (const g of settingsGroups()) {
      const mine = registrySettings().filter((s) => s.group === g.page);
      const body = wrap(
        g.slug === 'org' ? (
          <OrgAccess me={fx.me} tab="access" org={fx.org} people={fx.people} matrix={fx.matrix} settings={mine.map((s) => s.def)} canEdit today="2026-10-26" />
        ) : (
          <SettingsGroup settings={mine.map((s) => ({ ...s.def, rows: [...s.def.rows, { ...s.def.rows[0]!, id: 'd', department_id: 'dept-1', reason: null }] }))} canEdit departments={fx.departments} lists={listsOf(g.page).map((l) => ({ ...l, rows: fx.entries(l.key) }))} today="2026-10-26" />
        ),
      );
      fs.writeFileSync(`${OUT}/${loc}-${g.slug}.html`, page(loc, g.slug, t(loc, g.label), body));
      if (g.slug === 'org')
        for (const tab of ['people', 'teams']) {
          const b = wrap(<OrgAccess me={fx.me} tab={tab} org={fx.org} people={fx.people} matrix={fx.matrix} settings={[]} canEdit today="2026-10-26" />);
          fs.writeFileSync(`${OUT}/${loc}-org-${tab}.html`, page(loc, g.slug, t(loc, g.label), b));
        }
    }
  }
});
