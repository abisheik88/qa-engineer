# Detection Guide

What `qa-init` detects and the direct signals that establish each fact. The rule throughout: read the signal, do not infer from adjacency. A dependency in a lockfile is evidence; a folder name that merely suggests a framework is not. When only weak signals exist, record the fact at low confidence and note it as an assumption rather than asserting it.

This guide covers *detection* — recognizing what a project uses. Deeper knowledge of how each framework actually works — how to use it, not identify it — arrives in the pack's shared framework knowledge in a later milestone; this guide is only about identification.

## Language and runtime

| Fact | Primary signal | Secondary signal |
| --- | --- | --- |
| JavaScript / TypeScript | `package.json` present; `tsconfig.json` for TypeScript | `.ts`/`.js` source predominance |
| Java | `pom.xml` or `build.gradle` | `src/test/java` layout |
| Python | `pyproject.toml`, `setup.py`, or `requirements.txt` | `.py` source predominance |
| C# | a `.csproj` or `.sln` | `.cs` source predominance |
| Runtime version | engine constraints in the manifest (`engines`, `.nvmrc`, `<java.version>`) | CI setup steps |

## Package manager and build tool

| Tool | Signal |
| --- | --- |
| npm / pnpm / yarn | the matching lockfile: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` |
| Maven / Gradle | `pom.xml` / `build.gradle` |
| pip / Poetry | `requirements.txt` / `poetry.lock` |
| NuGet | `packages.lock.json` or `<PackageReference>` entries |

The lockfile is the authoritative signal for a JavaScript package manager; when several are present, the one committed most recently and referenced by CI wins, and the ambiguity is noted.

## Test and browser-automation frameworks

Detect from dependencies and config files — not from a folder that happens to be named after a tool.

| Framework | Config-file signal | Dependency signal |
| --- | --- | --- |
| Playwright | `playwright.config.{ts,js}` | `@playwright/test`, `playwright` |
| Cypress | `cypress.config.{ts,js}` | `cypress` |
| WebdriverIO | `wdio.conf.{ts,js}` | `@wdio/cli` |
| Selenium | none canonical | `selenium-webdriver`, `org.seleniumhq.selenium`, `selenium` (Python) |
| Cucumber | `cucumber.{json,js}`, `.feature` files | `@cucumber/cucumber`, `io.cucumber`, `behave` |
| Unit frameworks | framework config | `vitest`, `jest`, `mocha`, `pytest`, `junit`, `nunit`, `xunit` |

Selenium has no canonical config file — the dependency is the signal, and its absence from dependencies means "not detected" even if a folder is named `selenium`.

## API styles

| Style | Signal |
| --- | --- |
| REST | HTTP client usage in tests (`supertest`, `rest-assured`, `requests`); OpenAPI/Swagger files |
| GraphQL | `.graphql`/`.gql` files; a GraphQL client dependency; a schema file |
| WebSocket | WebSocket client usage in tests or app config |

API styles are additive — a project may be both REST and GraphQL, and both are recorded.

## CI provider

| Provider | Signal |
| --- | --- |
| GitHub Actions | `.github/workflows/*.yml` |
| Jenkins | `Jenkinsfile` |
| GitLab CI | `.gitlab-ci.yml` |
| Azure DevOps | `azure-pipelines.yml` |

Record every provider found and the paths to its configuration; multiple are possible.

## Monorepo and conventions

- **Monorepo:** workspace declarations (`workspaces` in `package.json`, `pnpm-workspace.yaml`, Nx/Turbo config, a Gradle multi-project build). When detected, profile each package's language and test framework separately.
- **Test directory and spec glob:** the directory holding the most test files, and the glob that matches them (`e2e/**/*.spec.ts`, `src/test/java/**/*Test.java`). Report the dominant convention, not every stray file.
- **Config files:** the paths to the test and tool configuration discovered above, so later skills can read them directly.

## Browser-automation MCP

Record whether a relevant MCP server (Playwright, Chrome DevTools) is configured in the agent environment, since its presence changes what later skills can do. Its absence is not a defect — skills degrade to command-line and analyzer paths — but it is worth recording.

## Confidence

Set overall `confidence` from the strength of the signals: `high` when frameworks, language, and conventions are established by direct config/dependency reads; `medium` when key facts rest on inference; `low` when the repository is sparse or contradictory. Whatever the level, every low-confidence fact is named in the context file's assumptions section.
