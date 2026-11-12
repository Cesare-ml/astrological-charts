# Development roadmap and milestones

This roadmap is for the **Astrological Charts** Angular 20 / TypeScript / Three.js renderer. It is a plan, not a claim that the software is released. Review [AGENTS.md](../AGENTS.md), [START_HERE.md](START_HERE.md), [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md) and the [open issues](https://github.com/Cesare-ml/astrological-charts/issues) before starting work.

## How to contribute to a milestone

1. Pick one small unchecked task below; search open issues and draft PRs first to avoid duplicate work.
2. Ask your coding assistant to explain the change in plain English, implement it on a branch and add focused tests.
3. Run `npm ci`, `npm run preflight`, `npm run build`, and `npm run build:demo` where available. For visual changes, also run the documented opt-in browser tests with an actual browser and report the exact environment.
4. Submit or update a **draft PR** with changed files, executed commands, results, screenshots where relevant, risks, and the next step. Do not claim tests passed without running them.
5. Never deploy, publish a package, enable GitHub Actions or merge to main without explicit maintainer approval.


- JSON v1 error-path regression: fixed four over-escaped `RegExp` fragments in `tests/validate-chart-input.test.mjs` so `vertex` and optional planet-number assertions match literal dotted field paths (and not a literal backslash plus wildcard). Verified 15 generated patterns with 30 positive/negative assertions using local Node.js; the repository's full `npm run test:validate-chart-input` and Angular/browser preflight remain pending.

- JSON v1 secondary-chart validation: added six browser-free regression cases covering invalid ascendant, midheaven and house-cusp numbers in optional transits/synastry objects even when natal mode is selected. Tests also assert caller-owned input identity and value preservation. Source inspection matches the existing validator; execute `npm run test:validate-chart-input` and full preflight in a complete checkout before treating this as passed.

## M0 — Public-release safety (blocking)

- [ ] Audit extracted source and Git history for redistribution rights, credentials, private data and third-party notices.
- [x] Prepare CPAL-1.0 licensing and visible VirgoStars attribution in the current draft PR; maintainer legal review remains required.
- [ ] Audit all public-facing documentation for accurate English wording, links, and release-status statements.
- [ ] Keep the Angular demo's launch-screen **Powered by VirgoStars** hyperlink and safe external-link attributes.
  - The browser-free metadata guard parses the credit anchor attributes independently of their order and requires `href`, `target="_blank"`, `noopener` and `noreferrer`; the guard also rejects duplicate HTML attributes that could make the official credit link ambiguous; real keyboard/screen-reader validation is still pending. The browser-free `test:release-metadata` test guards the inline template credit, but a real browser accessibility review is still required. The credit guard uses JavaScript RegExp tokens (`\s`, `\b`, `\w`) rather than double-escaped literal backslashes; keep the regression aligned with the real Angular template.
- [ ] Run `npm run test:release-metadata` as a lightweight guard for package `private: true`, CPAL Exhibit B/NOTICE attribution, the uncleared release checklist, and the continued presence of the roadmap and its manual preflight wiring. This test checks text contracts only; it does not establish legal rights or permission to publish.
- [ ] Verify external asset ownership, manifest, SHA-256 checksums and missing-resource behavior. Never copy unapproved images or fonts into this repository.
  - Source of truth: `Cesare-ml/astrological-assets/manifests/approved-assets.json` (schema v1). Its `source.repository` describes asset provenance, **not** permission to publish those files.
  - Review each selected asset's path, byte length, SHA-256 and permission basis; reject missing entries, mismatched bytes/hashes and unknown rights. Verify hashes against the **actual binary files** in a separately authorized checkout. Reading the JSON manifest alone is not a checksum validation.
  - Keep the private asset checkout separate from the public renderer. Never commit copied PNGs, fonts, manifest-derived private inventories or personal data here. Use generated synthetic assets for public examples and tests.
  - Record the checked asset repository revision, manifest revision, verification command, results and any unresolved permissions in the release review; do not mark this item complete from source inspection alone.
- [ ] Run a clean-checkout build and browser tests on Windows and at least one other platform.
- [ ] Resolve issue #20: GitHub reports public visibility while release documentation and rights gates remain incomplete.
- [ ] Obtain maintainer sign-off on every item in the [release checklist](PUBLIC_RELEASE_CHECKLIST.md).

**Exit criterion:** maintainer explicitly clears provenance, security, license and functional checks and resolves the currently public GitHub visibility discrepancy (issue #20). Repository visibility alone is not a release.


- JSON v1 CLI override regression now checks that selecting transits/synastry requires supplied secondary data even when the embedded mode is natal, preserves caller data, and does not rewrite the Angular import mode. Execute `npm run test:chart-input` in a complete checkout; source inspection is not an executed test.
- JSON v1 signed-angle regression coverage now checks Angular normalization of negative/multi-turn ascendant, midheaven, vertex, house cusps and planet longitude while Node prevalidation preserves the original input; execution of `npm run test:chart-input` remains pending.
- JSON v1 planet-identifier regression coverage now includes ASCII and Unicode-only whitespace, a valid 80-character boundary name, and names exceeding 80 characters in `tests/chart-input.test.mjs`. This checks rejection contracts for both Angular and CLI adapters; execute `npm run test:chart-input` in a complete checkout before relying on the tests.


- JSON v1 regression coverage now includes independent optional speed, signed-zero, and ±90° declination boundaries in secondary transit/synastry charts while natal mode is selected. Execute `npm run test:chart-input` before considering this verified; source readback is not test execution.

- [ ] Execute the explicit-null `vertex` parity regression in `tests/chart-input.test.mjs`: Angular now rejects `vertex: null` (natal/transits/synastry), matching Node validation, while an omitted vertex still falls back to ascendant + 140°. Run `npm run test:chart-input` on a full checkout; GitHub source readback alone is not an executed test. (2026-11-11)

## M1 — Reproducible standalone development

- [ ] Confirm `npm ci`, type checks, preflight, library build and Angular demo build on a fresh checkout.
- [ ] Make the beginner quickstart work without private VirgoStars credentials or production access.
- [ ] Keep deterministic, invented chart fixtures and clear test diagnostics.
- [ ] Document supported Node, npm and browser versions based on actual execution.

**Exit criterion:** a new contributor can follow English instructions and reproduce a synthetic chart locally.

## M2 — Reliable visual rendering

- [ ] Complete a real Chrome/browser run of natal, transits,
      synastry and latitude modes, including exactly 0° latitude.
      The four-mode PNG/JPEG matrix is now present in the manual
      `tests/render-bridge.browser.test.mjs`; execution and visual
      review of all four modes remain required.
- [ ] Test light/dark skins, PNG and JPEG exports, and compare reproducible screenshots.
  - A browser-free asset-request audit now rejects missing/failed
    local images before a PNG/JPEG is published; the mock tests do
    not prove all original VirgoStars assets exist on disk.
- [ ] Verify accessibility: labels, keyboard navigation, focus indicators, contrast and nonvisual status feedback.
- [ ] Measure WebGL resource disposal over repeated redraw/export and multiple canvases.

**Exit criterion:** repeatable browser-based visual regression evidence and no known critical rendering/lifecycle failures.

The JSON v1 contract regression suite now includes signed-zero latitude/speed preservation, valid ±90° declination boundaries, invalid declination and optional speed rejection, and caller-input immutability. Run `npm run test:chart-input` in a complete checkout before treating this as validated; the GitHub connector cannot execute repository tests.

- [ ] Run the valid-secondary-chart preservation regression in `tests/chart-input.test.mjs`: natal mode must retain supplied transits and synastry (including signed-zero latitude) without mutating caller input. Added in commit `4cb1297`; Node execution remains pending.
- [ ] Execute the JSON v1 optional-chart validation regressions in `tests/chart-input.test.mjs`: both adapters must reject malformed optional transits/synastry even in natal mode, plus invalid vertex and austral inversion values. Tests added in commit `21564c7`; full Node test execution remains pending.

- [ ] Execute the Angular/Node error-precedence regression for malformed planet objects combined with invalid `vertex` or `australInversion`. Node prevalidation now checks planet objects before those optional chart fields, matching Angular; the test is added but full `npm run test:chart-input` execution remains pending.

## M3 — Stable integrations

- [ ] Stabilize the versioned precomputed chart-input schema without duplicating astronomical calculations.
  - The Angular parser and Node prevalidator now reject whitespace-only celestial body identifiers while preserving legitimate multiword names (e.g. `North Node`). Regression coverage: `tests/chart-input.test.mjs`; execute `npm run test:chart-input` on a full checkout before merge.
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

- [x] Add explicit owner-local external asset options to the Node,
      CLI and Python render bridges with paired paths, full SHA-256
      binary verification and a fail-closed port-4177 policy (draft
      PR #19); browser-free tests were added. **Not yet verified**
      end to end with the actual external asset checkout and Chrome.
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

- [ ] Verify the JSON v1 invalid-planet-name error precedence regression: Angular now checks the identifier before parsing the planet object, matching Node validation even when the planet value is malformed. Added a focused test in `tests/chart-input.test.mjs`; run `npm run test:chart-input` in a complete checkout before considering it verified.

- [ ] Execute the secondary-chart angular-normalization regression (`tests/chart-input.test.mjs`): transits and synastry must normalize independently, preserve signed zero and caller inputs, and leave natal positions unchanged. Added in commit `15a2477`; execution in a full Node/TypeScript checkout remains pending.

- [ ] Execute the optional-secondary-chart planet-name regression in `tests/chart-input.test.mjs`: both Angular and Node must reject Unicode whitespace-only identifiers in supplied transits/synastry even when the selected mode is natal. Added on PR #19; Node execution pending.

- JSON v1 regression (draft PR #19): failed natal/transits/synastry house-cusp validation must leave caller-owned payloads unchanged, including signed zero; source test added, execution on a full checkout still pending (`npm run test:chart-input`).

- [ ] Run `npm run test:validate-chart-input` for browser-free explicit-null `vertex` parity and invalid optional transits/synastry planet identifiers (including Unicode whitespace and overlength names). Added in commit `d760dcf`; GitHub source readback is not an executed Node test. (2026-11-11)

- [ ] Execute `npm run test:chart-input` for explicit `null` optional planet numeric fields (`latitude`, `declination`, `longitudeSpeed`, `latitudeSpeed`) in natal, transit and synastry layers. Both adapters must reject these instead of treating them as omitted; regression added in commit `1750c61`, but full Node execution is pending. (2026-11-11)

- [ ] Execute Node-only JSON v1 regression for explicit `null` optional planet numbers across natal/transits/synastry (`tests/validate-chart-input.test.mjs`, 12 field/layer combinations). It verifies rejection and caller-input identity without requiring Angular/Chromium. Run `npm run test:validate-chart-input` on a full checkout; GitHub readback alone does not establish test success. (2026-11-12)

- [ ] Run the Node JSON v1 regression for malformed optional secondary charts while in natal mode (`tests/validate-chart-input.test.mjs`): null, array and invalid house-cusp count must fail for both transits and synastry without mutating caller input. Six new cases committed 2026-11-12; execution on a complete checkout remains pending.
