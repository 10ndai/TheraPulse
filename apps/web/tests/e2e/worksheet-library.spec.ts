/**
 * E2E Flow 3: Worksheet library browsing
 *
 * Requires: authenticated therapist session.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Worksheet library', () => {
  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/worksheet-templates');
    // Should redirect to login
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/worksheet-templates');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
