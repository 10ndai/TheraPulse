/**
 * E2E Flow 7a: Client progress — client views their progress dashboard and timeline
 *
 * Requires: authenticated client session.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Client progress and timeline', () => {
  test('client progress dashboard unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/dashboard/client');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('client timeline page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/dashboard/client/timeline');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/client');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
