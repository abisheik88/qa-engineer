// Template: api-helper. qa-generate adapts this when an API is under test.
// A thin, typed wrapper over Playwright's request context for API setup and
// API assertions. Base URL and auth come from the environment, never hardcoded.
import { APIRequestContext, request } from '@playwright/test';

export class ApiClient {
  private constructor(private readonly context: APIRequestContext) {}

  static async create(token = process.env.API_TOKEN): Promise<ApiClient> {
    const context = await request.newContext({
      baseURL: process.env.API_BASE_URL ?? process.env.BASE_URL,
      extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return new ApiClient(context);
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await this.context.get(path);
    if (!response.ok()) {
      throw new Error(`GET ${path} failed: ${response.status()} ${response.statusText()}`);
    }
    return (await response.json()) as T;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.context.post(path, { data: body });
    if (!response.ok()) {
      throw new Error(`POST ${path} failed: ${response.status()} ${response.statusText()}`);
    }
    return (await response.json()) as T;
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
