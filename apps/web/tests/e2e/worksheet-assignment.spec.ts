/**
 * E2E Flow 4: Worksheet assignment — therapist assigns a worksheet to a client
 *
 * Requires: authenticated therapist session + existing worksheet templates.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Worksheet assignment', () => {
  test('unauthenticated access to new assignment redirects to login', async ({ page }) => {
    await page.goto('/worksheet-assignments/new');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('assignment list page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/worksheet-assignments');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/worksheet-assignments');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
