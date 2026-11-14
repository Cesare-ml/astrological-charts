# House cusp unwrapping contract

The renderer uses `caseObj.house` (twelve ecliptic longitudes) to place house boundaries, ring textures and house labels. Natal, synastry and latitude house rings previously repeated the same angle-unwrapping loop. Its single `+360` correction assumes mixed input frames never differ by more than one revolution. If a provider combines an already-unwrapped first cusp with normalized following cusps, some boundaries can become nonmonotonic.

`unwrapHouseCusps()` is a pure function shared by all three house rings:

- Requires an array of exactly twelve finite numeric values. Sparse arrays, missing cusps, NaN and Infinity throw `TypeError` before WebGL geometry construction.
- Preserves the first longitude's input frame, then adds the minimum nonnegative multiple of 360° required for a nondecreasing result. Never mutates the caller's array.
- For conventional twelve cusps (including a single 360° wrap), returned values match the previous renderer; ring layout, labels, skin textures and camera remain unchanged.
- Handles differently wrapped numerical input in a deterministic way. It does **not** independently validate astronomical house systems or guarantee strictly positive arc spans. Zero-width or physically inconsistent intervals still require upstream validation.

## Tests and release gates

```sh
node --test tests/house-cusps.test.mjs
npm run check:types
npm run verify:angular
```

The Node test loads the real TypeScript helper using `typescript.transpileModule`, exercises canonical and synthetic mixed-frame cusp sets, rejects malformed arrays and checks that all three rendering methods call the shared helper. Browser screenshot baselines (all chart modes/skins), Chromium/Firefox, host PNG export and actual Astrolabio headless rendering remain necessary before integration. These checks are not implied by a standalone helper test.

No changes to astronomical ephemeris calculations, original artwork, assets, release rights, real user data, GitHub Actions, deployment or the shipped VirgoStars/Astrolabio code.
