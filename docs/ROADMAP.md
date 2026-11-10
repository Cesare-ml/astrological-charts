# Development roadmap and milestones

This roadmap is for the **Astrological Charts** Angular 20 / TypeScript / Three.js renderer. It is a plan, not a claim that the software is released. Review [AGENTS.md](../AGENTS.md), [START_HERE.md](START_HERE.md), [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md) and the [open issues](https://github.com/Cesare-ml/astrological-charts/issues) before starting work.

## How to contribute to a milestone

1. Pick one small unchecked task below; search open issues and draft PRs first to avoid duplicate work.
2. Ask your coding assistant to explain the change in plain English, implement it on a branch and add focused tests.
3. Run `npm ci`, `npm run preflight`, `npm run build`, and `npm run build:demo` where available. For visual changes, also run the documented opt-in browser tests with an actual browser and report the exact environment.
4. Submit or update a **draft PR** with changed files, executed commands, results, screenshots where relevant, risks, and the next step. Do not claim tests passed without running them.
5. Never deploy, publish a package, enable GitHub Actions or merge to main without explicit maintainer approval.

## M0 — Public-release safety (blocking)

- [ ] Audit extracted source and Git history for redistribution rights, credentials, private data and third-party notices.
- [x] Prepare CPAL-1.0 licensing and visible VirgoStars attribution in the current draft PR; maintainer legal review remains required.
- [ ] Audit all public-facing documentation for accurate English wording, links, and release-status statements.
- [ ] Verify external asset ownership, manifest, SHA-256 checksums and missing-resource behavior. Never copy unapproved images or fonts into this repository.
  - Source of truth: `Cesare-ml/astrological-assets/manifests/approved-assets.json` (schema v1). Its `source.repository` describes asset provenance, **not** permission to publish those files.
  - Review each selected asset's path, byte length, SHA-256 and permission basis; reject missing entries, mismatched bytes/hashes and unknown rights. Verify hashes against the **actual binary files** in a separately authorized checkout. Reading the JSON manifest alone is not a checksum validation.
  - Keep the private asset checkout separate from the public renderer. Never commit copied PNGs, fonts, manifest-derived private inventories or personal data here. Use generated synthetic assets for public examples and tests.
  - Record the checked asset repository revision, manifest revision, verification command, results and any unresolved permissions in the release review; do not mark this item complete from source inspection alone.
- [ ] Run a clean-checkout build and browser tests on Windows and at least one other platform.
- [ ] Obtain maintainer sign-off on every item in the [release checklist](PUBLIC_RELEASE_CHECKLIST.md).

**Exit criterion:** maintainer explicitly approves public visibility after provenance, security, license and functional checks. Repository visibility alone is not a release.

## M1 — Reproducible standalone development

- [ ] Confirm `npm ci`, type checks, preflight, library build and Angular demo build on a fresh checkout.
- [ ] Make the beginner quickstart work without private VirgoStars credentials or production access.
- [ ] Keep deterministic, invented chart fixtures and clear test diagnostics.
- [ ] Document supported Node, npm and browser versions based on actual execution.

**Exit criterion:** a new contributor can follow English instructions and reproduce a synthetic chart locally.

## M2 — Reliable visual rendering

- [ ] Test natal, transits, synastry and latitude modes, including exactly 0° latitude.
- [ ] Test light/dark skins, PNG and JPEG exports, and compare reproducible screenshots.
- [ ] Verify accessibility: labels, keyboard navigation, focus indicators, contrast and nonvisual status feedback.
- [ ] Measure WebGL resource disposal over repeated redraw/export and multiple canvases.

**Exit criterion:** repeatable browser-based visual regression evidence and no known critical rendering/lifecycle failures.

## M3 — Stable integrations

- [ ] Stabilize the versioned precomputed chart-input schema without duplicating astronomical calculations.
- [x] Add browser-free `--validate-only` to the chart CLI and
      early JSON-file validation in both Node input APIs; added tests
      for malformed input, duplicate flags and output preservation.
      A real clean-checkout Node execution is still required.
- [x] Keep CLI help and invalid-input diagnostics independent of browser
      dependencies, with opt-in-free tests in
      `tests/chart-cli-validation.test.mjs` (pending clean-checkout run).
- [x] Add early JSON v1 shape validation for Node.js/Python, with
      browser-independent rejection tests and Angular-parser parity
      fixtures in draft PR #19. **Still required:** execute full
      repository tests, browsers and contributor acceptance checks.

- [ ] Verify the Node.js image-export API, Python wrapper and failure handling with actual browser exports.
- [ ] Document the separation between this developer bridge and the existing offline Astrolabio Firefox integration.
- [ ] Validate cross-platform paths, concurrent process limitations and clean shutdown.
  - A single-process FIFO queue now covers both Node APIs and a mixed
    object/file order test in draft PR #19. Real multi-process locking,
    native Windows/macOS shutdown and stress tests remain unverified.
- [ ] Plan compatibility checks with `astrological-functions` and `VirgoStars-Ephemeris` without embedding astronomy algorithms here.

**Exit criterion:** documented, tested consumer contracts and versioned examples.

## M4 — Release candidate and controlled adoption

- [ ] Review public API, semantic versioning, documentation, licensing notices and VirgoStars credits.
- [ ] Test packaging from a clean checkout; keep release/publishing manual.
- [ ] Plan an opt-in, reversible integration into VirgoStars and Astrolabio, including offline tests and rollback.
- [ ] Obtain explicit maintainer approval for any merge, publication or production change.

**Exit criterion:** release candidate approved by the maintainer; no automatic production rollout.

## Non-goals and permanent boundaries

- No planetary position or house-cusp calculations in this renderer; consume computed values.
- No bundled or duplicated third-party artwork. Approved assets live in `Cesare-ml/astrological-assets` and require manifest and checksum validation.
- No production credentials, real natal records, unapproved fonts, GitHub Actions or automatic deployment.
- Keep the software free and retain the VirgoStars project name and link in the required credits/about surfaces.

Milestones may overlap during development, but **M0 must be cleared before public release**. Update this file and related issues whenever acceptance criteria change.
