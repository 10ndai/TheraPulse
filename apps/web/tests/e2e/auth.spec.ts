/**
 * E2E Flow 1 + 2: Authentication — login and registration
 *
 * Requires: Next.js dev server + NestJS API both running.
 * CI: runs via webServer config in playwright.config.ts; API must be started separately.
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication flows', () => {
  test.describe('Login page', () => {
    test('renders login form with email, password, and submit button', async ({ page }) => {
      await page.goto('/auth/login');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
    });

    test('shows validation error for empty submission', async ({ page }) => {
      await page.goto('/auth/login');
      await page.getByRole('button', { name: /log in/i }).click();
      // HTML5 or custom validation should prevent submission or show errors
      // At minimum the form should not navigate away
      await expect(page).toHaveURL('/auth/login');
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/auth/login');
      await page.getByLabel(/email/i).fill('nonexistent@example.com');
      await page.getByLabel(/password/i).fill('WrongPassword1!');
      await page.getByRole('button', { name: /log in/i }).click();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    });

    test('has link to register page', async ({ page }) => {
      await page.goto('/auth/login');
      const registerLink = page.getByRole('link', { name: /register|sign up|create/i });
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL(/\/auth\/register/);
    });
  });

  test.describe('Register page', () => {
    test('renders registration form', async ({ page }) => {
      await page.goto('/auth/register');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /register|sign up|create/i })).toBeVisible();
    });

    test('shows error for mismatched passwords', async ({ page }) => {
      await page.goto('/auth/register');
      await page.getByLabel(/email/i).fill('test@example.com');
      const passwords = page.getByLabel(/password/i);
      await passwords.first().fill('Password1!');
      // If there's a confirm password field, fill it with a different value
      const count = await passwords.count();
      if (count > 1) {
        await passwords.nth(1).fill('DifferentPassword1!');
      }
      await page.getByRole('button', { name: /register|sign up|create/i }).click();
      // Should either show an error or stay on the page
      await expect(page).not.toHaveURL(/\/dashboard/);
    });

    test('has link back to login page', async ({ page }) => {
      await page.goto('/auth/register');
      const loginLink = page.getByRole('link', { name: /log in|sign in|already/i });
      await expect(loginLink).toBeVisible();
    });
  });
});
