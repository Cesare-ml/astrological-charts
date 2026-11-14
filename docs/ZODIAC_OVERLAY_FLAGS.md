# Zodiac overlay argument consistency

The zodiac ring renderer accepts explicit decan and decade visibility arguments
in `SegniRender.getAnelloSegni(asc, scale, inner, outer, inversion, mostraDecani, mostraDecadi, opzioni)`.
Before this change it ignored both explicit arguments and instead read
`opzioni.mostraDecani` and `opzioni.mostraDecadi`. A caller could therefore request a
specific overlay state for one render but unexpectedly receive a different one
from stale/shared options.

The renderer now uses the two arguments passed to the current call. The natal
and latitude callers already pass their corresponding option values, so ordinary
bundled demo rendering remains unchanged. This does not alter planetary
positions, zodiac rotation, glyph assets, Three.js geometry or exported APIs.
The incidental debug console output on texture-free skins was also removed.

## Regression test

From a complete checkout with dependencies installed:

```bash
node --test tests/zodiac-overlay-flags.test.mjs
npm run verify:angular
```

The Node test transpiles and runs the actual TypeScript renderer method with
lightweight Three.js/asset stubs. It checks all four argument combinations,
contradictory `opzioni` fields, retained baseline geometry, and the absence
of debug logging. No real WebGL context or third-party artwork is needed.

The test is **not** a visual baseline. Browser rendering of all modes/skins,
Chromium/Firefox PNG comparisons, and VirgoStars/Astrolabio compatibility
remain separate review gates. No automatic deployment or publication follows.
