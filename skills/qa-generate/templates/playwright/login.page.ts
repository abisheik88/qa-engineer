// Template: page-object (example). qa-generate renames this to the target
// page and replaces the locators and actions. It demonstrates the pattern:
// role/label/text-first locators defined once, actions as intention-revealing
// methods.
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base-page';

export class LoginPage extends BasePage {
  private readonly username: Locator;
  private readonly password: Locator;
  private readonly submit: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }

  async login(user: string, pass: string): Promise<void> {
    await this.goto('/login');
    await this.username.fill(user);
    await this.password.fill(pass);
    await this.submit.click();
  }
}
