// Template: page-object (base). qa-generate adapts this to the project's
// existing page-object pattern when one exists; otherwise it is the base
// every generated page object extends. Locators are defined in subclasses,
// never inline in tests.
import { Page } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to a path relative to the configured baseURL. */
  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }
}
