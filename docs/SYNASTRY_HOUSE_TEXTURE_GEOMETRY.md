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

`node --test tests/synastry-house-textures.test.mjs` runs seven deterministic geometry checks against the real TypeScript `CaseRender` method, using test doubles for Three.js primitives and synthetic house cusps. The harness compiles and injects the **real** `house-cusps.ts` helper introduced by parent PR #83. Extra checks verify mixed-frame cusp sectors, invalid data, unchanged source longitudes, and continued natal/latitude rendering.

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
