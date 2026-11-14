# House cusp unwrapping contract

The renderer uses `caseObj.house` (twelve ecliptic longitudes) to place house boundaries, ring textures and house labels. Natal, synastry and latitude house rings previously repeated the same angle-unwrapping loop. Its single `+360` correction assumes mixed input frames never differ by more than one revolution. If a provider combines an already-unwrapped first cusp with normalized following cusps, some boundaries can become nonmonotonic.

`unwrapHouseCusps()` is a pure function shared by all three house rings:

- Requires an array of exactly twelve finite numeric values. Sparse arrays, missing cusps, NaN and Infinity throw `TypeError` before WebGL geometry construction.
- Preserves the first longitude's input frame, then adds the minimum nonnegative multiple of 360° required for a nondecreasing result. Never mutates the caller's array.
- For conventional twelve cusps (including a single 360° wrap), returned values match the previous renderer; ring layout, labels, skin textures and camera remain unchanged.
- Handles differently wrapped numerical input in a deterministic way, but refuses unwrapped results spanning more than one 360° zodiac revolution or producing nonfinite angles (`RangeError`). It does **not** independently validate astronomical house systems or guarantee strictly positive arc spans; zero-width sectors and other physically inconsistent inputs still require upstream validation.

## Tests and release gates

```sh
node --test tests/house-cusps.test.mjs
npm run check:types
npm run verify:angular
```

The Node test loads the real TypeScript helper using `typescript.transpileModule`, exercises canonical and synthetic mixed-frame cusp sets, rejects malformed arrays and checks that all three rendering methods call the shared helper. Browser screenshot baselines (all chart modes/skins), Chromium/Firefox, host PNG export and actual Astrolabio headless rendering remain necessary before integration. These checks are not implied by a standalone helper test.

No changes to astronomical ephemeris calculations, original artwork, assets, release rights, real user data, GitHub Actions, deployment or the shipped VirgoStars/Astrolabio code.

## Additional regression gate (2026-11-14)

The original helper accepted finite inputs that normalized to an impossible multi-revolution ring or overflowed to nonfinite output. The two new focused tests fail against the old helper and pass with the one-revolution guard. Verified on Node v22.16.0 / TypeScript v5.8.3 in a minimal workspace: **6/6 runnable helper tests PASS**, isolated strict TypeScript check PASS. The renderer-source wiring test and complete Angular/WebGL build were not run in that workspace.

## Ascendant input validation

All three house-ring entrypoints also reject an absent, non-numeric, infinite or NaN `caseObj.ascendant` before creating line/texture/glyph geometry. A finite longitude (including numerically equivalent wrapped values) keeps the exact legacy chart placement. This prevents malformed upstream input from generating NaN angles passed to Three.js. The guard intentionally does not change astrological calculations or select a canonical 0–360° frame.

Source-level regression coverage checks that each renderer invokes the cusp helper and validates the Ascendant. Behavioral checks for each renderer live in the stacked synastry integration PR #88. A complete Angular/browser integration run remains a separate gate.
