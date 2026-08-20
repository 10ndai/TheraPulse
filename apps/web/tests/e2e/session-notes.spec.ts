/**
 * E2E Flow 6: Session notes — therapist creates and manages session notes
 *
 * Requires: authenticated therapist session.
 * Unauthenticated requests redirect to /auth/login.
 */
import { test, expect } from '@playwright/test';

test.describe('Session notes', () => {
  test('session history page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/session-notes');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('new session note page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/session-notes/new');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('session note edit page unauthenticated redirects to login', async ({ page }) => {
    await page.goto('/session-notes/nonexistent-id/edit');
    await expect(page).toHaveURL(/\/auth\/login|\/$/);
  });

  test('page renders without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/session-notes');
    expect(errors.filter((e) => !e.includes('ChunkLoadError'))).toHaveLength(0);
  });
});
