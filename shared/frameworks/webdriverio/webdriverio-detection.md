# WebdriverIO: Detection

How a WebdriverIO project is recognized. The fact is recorded in `.qa/context.md` by qa-init; this documents the signals and selection.

## Signals

| Signal | Evidence |
| --- | --- |
| Config | `wdio.conf.{ts,js}` (or `wdio.conf.*.ts` variants per environment) |
| Dependency | `@wdio/cli` in `package.json` |
| Layout | a `test/specs/` or configured `specs` directory |

The config file and `@wdio/cli` dependency are authoritative.

## Selection and conflict

Selection follows the shared rules: explicit intent, then the recorded framework, then monorepo scope, then a single clarifying question. WebdriverIO can drive web and mobile (via Appium); detection notes an Appium capability set, since mobile is a distinct, planning-only surface.

## Status

WebdriverIO is a **planned** framework for live execution and generation: detected and adapter-complete, with analysis reused from the shared JUnit parser. Live execution/generation is gated by the skills' current guardrails, whose flip needs no adapter change.
