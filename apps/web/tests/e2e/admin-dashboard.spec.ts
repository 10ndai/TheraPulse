/**
 * E2E Flow 7b: Admin platform dashboard — admin views platform statistics
 *
 * Requires: authenticated admin session.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Admin platform dashboard', () => {
  test('admin dashboard unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('admin therapist management unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/admin/therapists');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/dashboard/admin');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
