<!-- synced-from: shared/generation/template-selection.md — do not edit; edit the source and run: node scripts/sync-shared.mjs --write -->
# Template Selection

How generation chooses a template and adapts it to the project. Templates are the starting point, never the finished product: generation adapts a category's template to the detected conventions, so the output fits the repository rather than importing the template's own style. This module also defines the template-category contract that lets any framework plug into generation.

## The template-category contract

Every generated framework provides the same set of categories. The platform selects and adapts them identically for any framework; only the category's contents are framework-specific.

| Category | What it scaffolds |
| --- | --- |
| Configuration | The framework's config file |
| Page object | The page-object pattern the suite uses |
| Fixture | Shared setup and state, including authenticated sessions |
| API helper | Typed request helpers for an API under test |
| Test data | Data factories or fixtures, dependency-light |
| Utility | Shared helper functions |
| Example test | A test wiring the above together |
| Environment | An environment-variable example (names, never values) |
| README | How to run and extend the framework |

Playwright fills these categories today, as files carried by the `qa-generate` skill. Selenium, Cypress, and WebdriverIO fill the same categories later and gain generation for free, because selection and adaptation are framework-neutral. This is the generation counterpart to the execution adapter contract.

## Selecting

- **Mode and strategy choose the categories.** A bootstrap needs most categories; a "new page" request needs only the page-object category and perhaps an example test. Generate the categories the strategy requires, no more.
- **The convention profile chooses the variant.** When the suite already demonstrates a category (its own page-object shape), that observed pattern is the template — the framework's default template is used only when the project has no established pattern of its own.

## Adapting

A template is adapted, not copied. Adaptation applies, in order:

1. **The project's version of the pattern**, when the analysis found one — its page-object shape, its fixture style — overrides the template's default structure.
2. **The detected code style** (the code-style module) — formatting, quotes, async idiom, assertion library.
3. **The detected naming** (the naming-conventions module) — file names, class names, test titles.
4. **The concrete specifics** of the request — the page, the feature, the endpoints.

The template's placeholders are replaced with real, project-appropriate values; no placeholder token ever survives into generated output.

## Rules

- **No orphan placeholders.** Generated files contain no unfilled template tokens; an unresolved placeholder is a generation failure, not a stylistic blemish.
- **Adapt to the project, not the template to itself.** When the project's convention and the template's default conflict, the project wins every time.
- **One category, one source.** A category has one template per framework; generation does not blend two templates for one file.

## Output

Each generated file records the template category it came from, so the generation result is traceable — a reviewer can see that the login page object came from the page-object category adapted to the project's observed pattern.
