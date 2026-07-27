// Template: fixture. qa-generate adapts this to the project's shared setup.
// It provides page objects and an authenticated page via stored session
// state, so tests reuse login rather than repeating it. Extend `test` here;
// tests import from this file instead of '@playwright/test'.
import { test as base, expect, Page } from '@playwright/test';
import { LoginPage } from './pages/login.page';

type Fixtures = {
  loginPage: LoginPage;
  authedPage: Page;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  // An authenticated page. Prefer a project dependency that saves storageState
  // once; this fixture reuses it. Replace with the project's real auth if present.
  authedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
