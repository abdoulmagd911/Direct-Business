import { expect, test } from '@playwright/test';

// The skeleton's one promise: the built app answers and draws its name. Builder B replaces this with the shell's
// specs in P3-3. Sabotage: tests/sabotage/e2e-first-page-draws-nothing.patch.
test('the app serves its first page with the workspace name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Commercial Workspace' })).toBeVisible();
});
