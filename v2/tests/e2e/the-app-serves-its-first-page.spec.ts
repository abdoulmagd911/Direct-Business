import { expect, test } from '@playwright/test';

// The built app answers a signed-out visitor with the sign-in page and its name (the shell's own specs: shell.spec.ts).
// Sabotage: tests/sabotage/e2e-sign-in.mjs "e2e-first-page-draws-nothing".
test('the app serves its first page with the workspace name', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in\?next=%2F$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Commercial Workspace' })).toBeVisible();
});
