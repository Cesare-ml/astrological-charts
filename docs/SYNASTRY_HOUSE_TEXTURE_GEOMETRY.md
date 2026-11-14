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

`node --test tests/synastry-house-textures.test.mjs` runs four deterministic geometry checks against the real TypeScript `CaseRender` method, using test doubles for Three.js primitives and synthetic house cusps.

This tests the radius contract and inversion depth but **does not** verify screenshot parity, pixel rendering, antialiasing or host asset rights. Before integrating into VirgoStars or Astrolabio, check textured synastry on a browser canvas and e-ink/headless output, including the inverted southern setting. No assets or real natal records are included.

**Compatibility:** internal geometric correction only; no new public API, no changes to natal/transit/latitude paths, and no production deployment.
