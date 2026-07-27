# Generation Strategy

The two decisions that shape every generation: which **mode** applies, and which **strategy** the request calls for. Mode is determined by what exists; strategy is determined by what is asked.

## The mode decision

After the framework (and on bootstrap, language) is selected:

| Finding | Mode |
| --- | --- |
| A usable automation setup for the framework exists (config, tests, page objects, and/or step defs) | Mode 1 — extend (suite-extension) |
| No automation for the framework exists | Mode 2 — bootstrap (project-bootstrap) after framework + language intake |
| A partial or broken setup exists | Mode 1, cautiously — extend what is sound; never silently rebuild |

## Strategies

| Strategy | Produces |
| --- | --- |
| New project | A complete framework (Mode 2 only) |
| New feature | Tests, page objects, and step defs as needed for a feature |
| New module | Cohesive tests and page objects for a module |
| New page | Page object (and starter test / steps) with locators from the real site when available |
| New API | Request helpers and API tests |
| Regression expansion | Additional coverage over existing areas |
| Smoke / critical-path suite | Tagged fast or high-risk journeys |
| Single test / scenario | One test or one Gherkin scenario + glue |
| Bulk generation | Many tests across a stated scope |

## Decision tree

```text
  discover repo + .qa/context.md
  automation exists for a framework?
    yes → select that framework (ask once if multiple)
         → Mode 1 extend
         → review suite; harvest live locators when URL available
         → add specs and/or features + step defs + page methods
    no  → framework picker (Playwright / Selenium / Other)
         → language picker (TS / JS / Python / Java / Other)
         → Mode 2 bootstrap (senior-SDET quality bar)
  scope unclear? → ask one question, then proceed
```

## Inputs and outputs

- **Inputs:** selected framework (and language on bootstrap), mode, strategy, convention profile, optional live URL for locator harvest.
- **Outputs:** generation plan → bootstrap or extension → generation result contract.
