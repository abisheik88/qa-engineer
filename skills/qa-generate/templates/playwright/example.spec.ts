// Template: example-test. qa-generate adapts this to the target scenario.
// It demonstrates the conventions a generated suite follows: import `test`
// from the fixtures file, drive the page through a page object, and assert
// with web-first assertions. Tests are independent and tagged for suites.
import { test, expect } from './fixtures';
import { makeUser } from './data';

test('signs in and lands on the dashboard @smoke', async ({ loginPage, page }) => {
  const user = makeUser();

  await loginPage.login(user.email, user.password);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
