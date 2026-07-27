// Template: utility. qa-generate adds only the shared helpers a suite
// genuinely needs — not a speculative kitchen sink. Reuse the project's
// existing helpers first; generate a new one only when none covers the need.
import { Page, expect } from '@playwright/test';

/** Read a required environment variable, failing loudly if it is absent. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/** Assert the page settled on an expected path (web-first, auto-retrying). */
export async function expectPath(page: Page, path: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`${path}(?:[/?#]|$)`));
}
