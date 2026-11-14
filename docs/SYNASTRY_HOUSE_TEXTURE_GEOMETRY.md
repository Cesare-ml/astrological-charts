# Synastry house texture band geometry

## Problem and correction

In `CaseRender.renderAnelloCaseSinastria`, the textured outer house sector covers the radial interval from `diametroInterno / 2` to `diametroEsterno / 2`. The extra mini-arc was accidentally drawn from `diametroMiniArco / 2` to `diametroEsterno / 2`, duplicating the outer region instead of decorating the inner region.

The mini-arc now uses `diametroInterno / 2` through `diametroMiniArco / 2`, matching `renderAnelloCase`'s inner-annulus convention. The main house sector, glyph positioning, angular boundaries, texture selection, and z-depth behavior are unchanged.

For synthetic diameters 100 / 120 / 180, the expected radii are:

| Sector | Before | After |
| --- | --- | --- |
| Outer house texture | 50 to 90 | 50 to 90 |
| Mini house texture | 60 to 90 (overlap) | 50 to 60 |

## Verification

`node --test tests/synastry-house-textures.test.mjs` runs ten deterministic geometry checks against the real TypeScript `CaseRender` method, using test doubles for Three.js primitives and synthetic house cusps. The harness compiles and injects the **real** `house-cusps.ts` helper introduced by parent PR #83. Extra checks verify mixed-frame cusp sectors, invalid data, unchanged source longitudes, continued natal/latitude rendering, identical cusp-line angles in all three chart modes, and rejection of invalid cusps in all three entrypoints.

This tests the radius contract and inversion depth but **does not** verify screenshot parity, pixel rendering, antialiasing or host asset rights. Before integrating into VirgoStars or Astrolabio, check textured synastry on a browser canvas and e-ink/headless output, including the inverted southern setting. No assets or real natal records are included.

**Compatibility:** internal geometric correction only; no new public API, no changes to natal/transit/latitude paths, and no production deployment.

## Stacked PR integration (parent #83, related #81)

This branch was created from `fix/house-cusps-mixed-frames-20261114` (PR #83), then ports the small synastry radial geometry correction from PR #81. Its test harness explicitly resolves the parent PR's new `./house-cusps` import, which PR #81's original standalone harness does not know about. The standalone PR #81 and this stacked PR contain overlapping geometry and test files: **merge only one final reconciled implementation**, not both patches blindly.

To test this combination after a full checkout:

```bash
npm ci
node --test tests/house-cusps.test.mjs tests/synastry-house-textures.test.mjs
npm run verify:angular
```

The isolated in-memory V8 harness that exercised the two source versions returned 8/8 synthetic checks PASS, but did not perform TypeScript compilation, the full Node test suites, Angular builds, browser GPU/asset rendering, or shipped Astrolabio checks. These remain maintainer merge gates. No external artwork or production systems are modified.

## Isolated verification update (2026-11-14)

- `node --test --test-name-pattern='canonical|returns|reconciles|rejects' tests/house-cusps.test.mjs` **PASS 4/4** on Node 22.16.0 and TypeScript 5.8.3 using the exact GitHub blob bytes (helper `8606e879c8a24055ca9a96610a7f0e977d977828`, test `0ed391886acc135679c31d7424031ce200ea9858`). The fifth source-wiring case was not run in the isolated workspace without the complete case renderer file.
- `tsc --noEmit --strict --target ES2022 --module ESNext --skipLibCheck src/lib/renderers/moduli/house-cusps.ts` **PASS** in the same isolated workspace.
- **9/9 PASS** in an in-memory V8 harness running this PR's exact test source with lightweight TypeScript/CommonJS translation and mocked Three.js (not the official Node test runner). The new tests cover cross-mode mixed-frame angles and invalid inputs in all three entrypoints. A tenth test verifies the parent #83's one-revolution guard across all three chart modes.
- **NOT RUN**: full clean checkout, complete `node --test` suites, `npm ci`, full `npm run verify:angular`, real browser WebGL or actual Astrolabio.

### Integration status

PR #83 now fails early for normalized cusps spanning more than one zodiac revolution or overflowing to nonfinite angles (`RangeError`). The stacked #88 branch explicitly merges the updated #83 head and adds a cross-mode regression for this contract. Exact SHA verification of the helper and its unit tests against the isolated real Node workspace succeeded. The combined renderer is still pending a full Angular/browser/device validation gate.
