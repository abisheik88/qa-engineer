# WebdriverIO: Conventions

The structural conventions the pack reads to locate, select, and generate WebdriverIO tests.

## Layout

| Concern | Convention |
| --- | --- |
| Specs | `test/specs/**/*.{ts,js}` (or the config's `specs`) |
| Page objects | `test/pageobjects/` |
| Config | `wdio.conf.ts` at the root (variants per environment) |
| Suites | named suites defined in the config's `suites` map |

The authoritative spec location comes from `.qa/context.md`, confirmed against the config's `specs`.

## Selection surface

- Spec paths via `--spec`.
- Named suites via `--suite`.
- Capability selection for browser/device.

Tagged and smoke strategies map to suites or spec globs; when a strategy depends on a convention the project lacks, the platform stops and explains rather than running an empty selection.

## Waiting and assertions

- **Auto-retrying matchers.** `expect-webdriverio` retries assertions; **framework requirement** to use over manual polling.
- **`waitUntil` for conditions.** Explicit condition waits over fixed pauses — the waiting-strategies discipline.
- **Page Object Model.** `$`/`$$` selectors in page-object getters; the pack reads page objects as the reuse surface.

## Boundary

This documents conventions the platform reads and generation follows; deeper WebdriverIO authoring guidance belongs with the generation and review skills.
