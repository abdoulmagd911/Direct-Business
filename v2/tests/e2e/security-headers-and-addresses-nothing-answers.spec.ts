import { expect, test } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

// W31: every answer carries the security headers. W32: a signed-out /api address answers 401 in JSON, never the
// sign-in page; an address nothing answers is a real 404 for a signed-in person (inside the shell). Sabotages:
// tests/sabotage/e2e-headers-and-addresses.mjs.
test('every answer carries the security headers', async ({ request }) => {
  const res = await request.get('/sign-in', { maxRedirects: 0 });
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin);
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
});

test('signed out, an /api address answers 401 in JSON, never the sign-in page', async ({ request }) => {
  for (const path of ['/api', '/api/partners', '/api/made/up?x=1']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(401);
    expect(res.headers()['content-type'], path).toContain('application/json');
    expect(await res.json(), path).toEqual({
      ok: false,
      error: { kind: 'PermissionDenied', key: 'auth.not_signed_in' },
    });
  }
  // any other address still goes to the sign-in page, so an outsider learns nothing of which addresses exist
  const page = await request.get('/no-such-page', { maxRedirects: 0 });
  expect(page.status()).toBe(307);
  expect(page.headers()['location']).toContain('/sign-in?next=%2Fno-such-page');
});

test('signed in, an address nothing answers is a 404, drawn as Not found inside the shell', async ({ page }) => {
  const person = await makePerson();
  await signIn(page, person.email, '/my-day');
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.locator('[data-state="not-found"]')).toContainText('/no-such-page');
  expect((await page.goto('/my-day'))?.status(), 'a page that exists is still 200').toBe(200);
});
