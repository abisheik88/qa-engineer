import { test, expect } from '@playwright/test';

// The kind of test the pack's /qa-generate produces: role- and testid-based
// locators (never positional XPath), web-first assertions (never hard waits),
// and one behavior per test. Tagged @smoke so `/qa-run smoke` can select them.

test.describe('login @smoke', () => {
  test('accepts valid credentials and shows the dashboard', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('email').fill('demo@example.com');
    await page.getByTestId('password').fill('correct-horse');
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveText('Welcome back');
  });

  test('rejects invalid credentials with an error message', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('email').fill('demo@example.com');
    await page.getByTestId('password').fill('wrong-password');
    await page.getByTestId('submit').click();

    await expect(page.getByTestId('error')).toHaveText('Invalid email or password.');
    await expect(page.getByTestId('dashboard')).toBeHidden();
  });
});
