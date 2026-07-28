# Release process

How a release is cut, by whom, and what must be true first. The release manager
([MAINTAINERS.md](../../MAINTAINERS.md)) owns the go/no-go call and is accountable
for having run this, not for having written the code.

Versioning policy is [versioning-and-releases.md](versioning-and-releases.md);
contract rules are [ADR-0003](../architecture/ADR-0003-versioning-strategy.md).

## Principles

1. **Nothing ships that CI has not proven.** Every gate runs in the release
   workflow, not only on pull requests.
2. **The tarball is the product.** A checkout passing its tests says nothing about
   what users receive; the release gate inspects the packed artifact.
3. **Release notes state what regressed and what remains unproven.** A release note
   that lists only additions is marketing.
4. **Publishing is deliberate.** The publish step is gated behind an explicit
   maintainer action, so no automation can ship on its own.

## Before the release

```bash
# 1. Everything green, from a clean checkout
npm ci
npm test
python3 shared/analysis/lib/run_tests.py
PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib python3 -m unittest discover -s shared/diagnostics/lib/tests
PYTHONPATH=shared/analysis/lib:shared/diagnostics/lib python3 -m unittest discover -s tests/seams
python3 scripts/check-python-floor.py
python3 scripts/bundle_python.py --check
npm run validate:evals && npm run eval:live

# 2. Every structural and documentation gate
for gate in skills sync keywords knowledge matrix registry architecture \
            spec-sync doc-claims docs-commands context release; do
  npm run --silent "validate:$gate" || echo "FAILED: $gate"
done

# 3. Lint
npx --yes markdownlint-cli2 "**/*.md"
npx --yes editorconfig-checker
```

Then the checks a checkout cannot make:

```bash
# 4. The real artifact, installed into a real project
npm pack
mkdir /tmp/rel && cd /tmp/rel && npm init -y
npm install /path/to/qa-engineer-<version>.tgz
npx qa-engineer --version          # must print <version>, not 0.0.0
npx qa-engineer install --yes --project .
npx qa-engineer verify --project .
npx qa-engineer self-test --project .
npx qa-engineer uninstall --project .
```

`npm run validate:release` covers version/tag consistency, tarball completeness
against the bundle manifests, and the absence of build artifacts — but running the
install by hand once per release is cheap and catches what schemas cannot.

## Cutting the release

1. **Set the version** in `package.json` **and** `packages/installer/package.json`.
   They must match; release validation fails otherwise.
2. **Convert `## [Unreleased]`** in [CHANGELOG.md](../../CHANGELOG.md) to
   `## [<version>] — <date>`, and open a fresh `## [Unreleased]` above it. Release
   validation requires `## [Unreleased]` to exist.
3. **Generate the release notes** from the changelog section:

   ```bash
   node scripts/release/release-notes.mjs --version <version> > /tmp/notes.md
   node scripts/release/release-notes.mjs --version <version> --check
   ```

   The generator reads the changelog rather than the git log, because the changelog
   is curated. `--check` fails if the section is missing, empty, or still carries
   `[Unreleased]`.

4. **Record the integrity digest** so the artifact is verifiable:

   ```bash
   node scripts/release/release-notes.mjs --version <version> --checksums
   ```

5. **Commit, then tag:**

   ```bash
   git commit -am "release: v<version>"
   git tag -a v<version> -m "v<version>"
   git push origin main --follow-tags
   ```

   The tag must be `v<version>`; release validation compares them and fails on a
   mismatch.

6. **Watch the release workflow.** It re-runs the installer tests, the Python
   suites, the evals, the validators, and release validation, then packs and uploads
   the tarball.

7. **Publish** — deliberately. `npm publish` is gated behind `if: false` in
   [.github/workflows/release.yml](../../.github/workflows/release.yml) plus a
   `TODO`. Flipping it requires a confirmed package name and an `NPM_TOKEN`.

8. **Verify what the registry actually serves**, from a clean directory:

   ```bash
   npx qa-engineer@<version> --version
   ```

## Reproducibility

`npm pack` on the same commit produces the same file list and byte count; the
release gate asserts the contents rather than a digest, because npm embeds
timestamps in the tarball wrapper. To confirm the *contents* match a published
release, compare the unpacked file digests:

```bash
node scripts/release/release-notes.mjs --version <version> --checksums
```

Anyone can re-run that on the tag and compare it to the published notes.

## Rolling back

The pack ships no service, so a rollback is a version change plus the installer's
own recovery:

1. **Do not unpublish.** `npm deprecate qa-engineer@<bad> "<reason>"` and
   ship a fixed version. Unpublishing breaks anyone who pinned it.
2. **Users recover in place** — the installer is transactional and the lockfile
   records every file:

   ```bash
   npx qa-engineer@<previous> install --yes --force --project .
   npx qa-engineer verify --project .
   ```

   Overwritten files are in `.qa/backups/<timestamp>/` from the install that
   replaced them.
3. **Record it.** A rollback gets a changelog entry saying what was wrong and how it
   was found. Silent rollbacks destroy the trust the pack is built on.

## Post-release

- Update [docs/capability-matrix.md](../capability-matrix.md) if any level changed.
- Note anything the release *did not* prove in `docs/release/`.
- Open the next `## [Unreleased]` section if step 2 did not already.
