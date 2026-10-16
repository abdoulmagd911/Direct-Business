import { expect, type Page } from '@playwright/test';

/**
 * Opens Quick capture the way a person does (daily use 11): Create in the top bar on a PC, the + on a phone (< 640 px),
 * then Capture — or straight away when Capture is the only item, which opens without a menu (V217).
 */
export async function openCapture(page: Page) {
  const phone = (page.viewportSize()?.width ?? 1440) < 640;
  const trigger = page.locator(phone ? '[data-create-bar]' : '[data-create]');
  await trigger.click();
  if ((await trigger.getAttribute('data-create-direct')) !== 'capture')
    await page.locator('[data-create-item="capture"]').click();
  await expect(page.locator('[data-quick-capture]')).toBeVisible();
}
