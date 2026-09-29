// The preview gallery's camera (the oversight's ask of 29 Sep 15:59). For each made-up person of each role, every
// route at 1440 and at 390 wide, full page; the two are set side by side in one picture (desktop, then phone), so the
// gallery stays under the Artifact's file limit. QA_GALLERY_STATE says which pass this is: `filled` (every person,
// every route), `empty` (an admin on the list pages before any record exists), `error` (an admin while the data API
// is down — run.sh stops it), or `door` (the sign-in page, a wrong password, Choose a new password). Each picture is
// one line in manifest.jsonl for build-page.mjs. Made-up data only (rule 7); the local QA stack only.
import { execSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { fx, hydrated, signIn, tryDoor } from '../sweep/lib';
import { RUN_DIR } from '../sweep/paths.mjs';
import { PERSONAS, ROUTES, type Route } from './routes';

const OUT = process.env.QA_GALLERY_OUT || join(RUN_DIR, 'gallery');
const STATE = (process.env.QA_GALLERY_STATE || 'filled') as 'filled' | 'empty' | 'error' | 'door';
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

type Shot = { png: Buffer; state: string; url: string; status: number | null; errors: number };
type Line = {
  route: string;
  group: string;
  label: string;
  path: string;
  persona: string;
  state: string;
  pass: string;
  file: string;
  desktop: { state: string; url: string; errors: number };
  phone: { state: string; url: string; errors: number };
};

async function stateOf(page: Page, status: number | null): Promise<string> {
  const url = new URL(page.url());
  if (url.pathname === '/sign-in') return 'sign-in';
  if (url.pathname === '/set-password') return 'set-password';
  const body = await page
    .locator('body')
    .innerText({ timeout: 5_000 })
    .catch(() => '');
  // the app's own error page (its words and a Reload button) is a designed state; Next's bare error is a crash
  if (/This page couldn.t load/i.test(body) && (await page.getByRole('button', { name: /reload/i }).count()))
    return 'error-page';
  if ((status ?? 200) >= 500 || /Application error|server-side exception/i.test(body)) return 'crash';
  if (status === 404 || /This page could not be found/.test(body)) return 'not-found';
  if (await page.locator('[data-state="no-access"]').count()) return 'no-access';
  if (await page.locator('[data-state="error"], [data-state="failed"]').count()) return 'failed-read';
  if (await page.locator('[data-state="empty"]').count()) return 'empty';
  return 'renders';
}

/**
 * The shell scrolls inside its own frame (the page is one screen tall), so a full-page picture would stop at the
 * window. The window is made as tall as the page's content for the picture (the largest scrolling area's hidden
 * part is added), so the layout stays exactly as drawn and the picture holds the table's last row and the form's
 * last field; then the window goes back. Capped at 9,000 px.
 */
async function tallShot(page: Page): Promise<Buffer> {
  const vp = page.viewportSize() ?? { width: 1440, height: 900 };
  const extra = await page
    .evaluate(() => {
      let most = 0;
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
        if (el.clientHeight < window.innerHeight * 0.4) continue;
        most = Math.max(most, el.scrollHeight - el.clientHeight);
      }
      return Math.max(most, document.documentElement.scrollHeight - window.innerHeight);
    })
    .catch(() => 0);
  const height = Math.min(9_000, vp.height + Math.max(0, extra));
  if (height > vp.height) {
    await page.setViewportSize({ width: vp.width, height });
    await page.waitForTimeout(350);
  }
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  if (height > vp.height) await page.setViewportSize(vp);
  return png;
}

async function take(page: Page, path: string): Promise<Shot> {
  let errors = 0;
  const onError = (m: { type(): string }) => {
    if (m.type() === 'error') errors += 1;
  };
  page.on('console', onError);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => null);
  await hydrated(page, 15_000);
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const status = res?.status() ?? null;
  const state = await stateOf(page, status);
  const png = await tallShot(page);
  page.off('console', onError);
  return { png, state, url: new URL(page.url()).pathname + new URL(page.url()).search, status, errors };
}

/** Desktop and phone side by side, captioned, as one JPEG. */
async function compose(browser: Browser, d: Shot, p: Shot, title: string): Promise<Buffer> {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const img = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;
  await page.setContent(
    `<html><body style="margin:0;background:#e6e8eb;font:13px system-ui,sans-serif;color:#2b3036">
      <div style="padding:16px 24px 6px">${title.replace(/</g, '&lt;')}</div>
      <div style="display:flex;gap:24px;align-items:flex-start;padding:8px 24px 24px">
        <figure style="margin:0"><figcaption style="padding:0 0 6px">1440 · ${d.state}</figcaption>
          <img src="${img(d.png)}" style="display:block;width:1440px;box-shadow:0 1px 3px #0003"></figure>
        <figure style="margin:0"><figcaption style="padding:0 0 6px">390 · ${p.state}</figcaption>
          <img src="${img(p.png)}" style="display:block;width:390px;box-shadow:0 1px 3px #0003"></figure>
      </div></body></html>`,
  );
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  const jpg = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 62 });
  await ctx.close();
  return jpg;
}

function save(line: Omit<Line, 'file'>, jpg: Buffer): void {
  const dir = join(OUT, 'shots', line.route);
  mkdirSync(dir, { recursive: true });
  const name = `${line.persona}${line.pass === 'filled' ? '' : `.${line.pass}`}.jpg`;
  writeFileSync(join(dir, name), jpg);
  appendFileSync(join(OUT, 'manifest.jsonl'), JSON.stringify({ ...line, file: `shots/${line.route}/${name}` }) + '\n');
}

async function signedIn(browser: Browser, key: string, viewport: typeof DESKTOP): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    locale: 'en-GB',
    timezoneId: 'Asia/Riyadh',
  });
  const page = await ctx.newPage();
  await signIn(page, key, '/my-day');
  await page.close();
  return ctx;
}

async function shoot(browser: Browser, key: string, routes: Route[], down = false): Promise<void> {
  const desk = await signedIn(browser, key, DESKTOP);
  const phone = await signedIn(browser, key, PHONE);
  // the error pass: the data API stops after signing in (the door itself needs it) and starts again at the end
  const api = `supabase_rest_${process.env.QA_STACK_PROJECT || 'direct-commercial-qa'}`;
  if (down) execSync(`docker stop ${api}`, { stdio: 'ignore' });
  try {
    const dp = await desk.newPage();
    const pp = await phone.newPage();
    const persona = PERSONAS.find((p) => p.key === key)?.label ?? key;
    for (const r of routes) {
      const path = r.path(fx(), key);
      const d = await take(dp, path);
      const p = await take(pp, path);
      const state = d.state === p.state ? d.state : `${d.state} / ${p.state}`;
      const jpg = await compose(
        browser,
        d,
        p,
        `${r.label} · ${persona} · ${path}${STATE === 'filled' ? '' : ` · ${STATE}`}`,
      );
      save(
        {
          route: r.id,
          group: r.group,
          label: r.label,
          path,
          persona: key,
          state,
          pass: STATE,
          desktop: { state: d.state, url: d.url, errors: d.errors },
          phone: { state: p.state, url: p.url, errors: p.errors },
        },
        jpg,
      );
    }
  } finally {
    if (down) execSync(`docker start ${api}`, { stdio: 'ignore' });
  }
  await desk.close();
  await phone.close();
}

test.describe.configure({ mode: 'parallel' });

if (STATE === 'filled') {
  for (const persona of PERSONAS) {
    test(`gallery · ${persona.key}`, async ({ browser }) => {
      test.setTimeout(900_000);
      await shoot(browser, persona.key, ROUTES);
    });
  }
}

if (STATE === 'empty' || STATE === 'error') {
  test(`gallery · admin · ${STATE}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const routes = ROUTES.filter((r) => r.list || r.id === 'profile' || r.id === 'settings-people');
    await shoot(browser, 'admin', routes, STATE === 'error');
  });
}

if (STATE === 'door') {
  test('gallery · the door', async ({ browser }) => {
    test.setTimeout(300_000);
    const views: { id: string; label: string; run: (page: Page) => Promise<void> }[] = [
      { id: 'sign-in', label: 'Sign in', run: async (page) => void (await page.goto('/sign-in')) },
      {
        id: 'sign-in-wrong',
        label: 'Sign in · a wrong password',
        run: async (page) => {
          await page.goto('/sign-in');
          await hydrated(page);
          await tryDoor(page, fx().users.member!.email, 'Not-the-password-2026');
        },
      },
      {
        id: 'set-password',
        label: 'Choose a new password (first sign-in)',
        run: async (page) => {
          const env = process.env;
          const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
          }).auth.admin;
          const who = fx().users.mustchange!;
          const list = await admin.listUsers({ perPage: 1000 });
          const u = list.data.users.find((x) => x.email === who.email);
          if (u) await admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, must_change_password: true } });
          await page.goto('/sign-in');
          await hydrated(page);
          await tryDoor(page, who.email, fx().password);
          await page.waitForURL(/\/set-password/, { timeout: 20_000 }).catch(() => undefined);
        },
      },
    ];
    for (const v of views) {
      const shots: Shot[] = [];
      for (const vp of [DESKTOP, PHONE]) {
        const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: vp.width < 500 });
        const page = await ctx.newPage();
        await v.run(page);
        await hydrated(page, 10_000);
        await page.waitForTimeout(400);
        shots.push({
          png: await tallShot(page),
          state: await stateOf(page, 200),
          url: new URL(page.url()).pathname,
          status: 200,
          errors: 0,
        });
        await ctx.close();
      }
      const [d, p] = shots as [Shot, Shot];
      save(
        {
          route: v.id,
          group: 'Signing in',
          label: v.label,
          path: d.url,
          persona: 'signed-out',
          state: d.state,
          pass: 'door',
          desktop: { state: d.state, url: d.url, errors: 0 },
          phone: { state: p.state, url: p.url, errors: 0 },
        },
        await compose(browser, d, p, v.label),
      );
    }
  });
}
