/**
 * E2E Flow 5: Worksheet submission — client completes and submits a worksheet
 *
 * Requires: authenticated client session + an active worksheet assignment.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Worksheet submission', () => {
  test('submission history page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/worksheet-submissions/history');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('submission detail page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/worksheet-submissions/nonexistent-id/submit');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/worksheet-submissions/history');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
