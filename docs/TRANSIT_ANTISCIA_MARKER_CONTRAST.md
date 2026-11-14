# Transit antiscia hover marker contrast

## Bug

`TransitiRender.getAntisci` previously drew the planet, antiscia and
counter-antiscia circular markers in **white** for every skin except `light`.
The white backgrounds of `light-bn`, `sun`, `astrolabio` and
`astrolabio-girasole` could hide these markers when an antiscia planet was
hovered. `dark` and `dark-bn` remain white.

## Change

The three markers now use black or white depending on the skin's existing
`bgColor`, with linear-light sRGB relative luminance and the black/white
contrast-ratio crossover. Supported palette colors are `#RGB` and `#RRGGBB`.
Unknown background color formats retain the legacy white fallback; no new
textures, assets, CSS, or public API are required.

**Expected before/after:** unchanged for `dark`, `dark-bn` and `light`;
white to black marker dots for `light-bn`, `sun`, `astrolabio` and
`astrolabio-girasole`. Planet positions, antiscia axes, aspect lines,
selection, chart geometry and camera zoom are unchanged.

## Synthetic verification

From a clean checkout with `npm ci`:

```bash
node --test tests/antisci-marker-contrast.test.mjs
npm run verify:angular
```

The isolated Node test transpiles the actual `SkinManager`, the contrast
helper and `TransitiRender` sources while substituting small Three.js,
image-renderer and planet-input stubs. It checks all seven skin background
colors, all three hover markers, and the no-hover path.

For visual acceptance, serve the synthetic Angular demo using
`docs/ANGULAR_DEMO.md`; select transits and enable antiscia hover for all
seven skins, inspecting dots on both light and dark backgrounds.
Repeat Chromium and Firefox with browser/version, canvas dimensions and
pixel ratio documented. Synthetic images do not prove real-artwork parity.
Separately verify PNG/mobile and Astrolabio browser/headless compatibility
before production integration.

This branch does not alter external VirgoStars or Astrolabio consumers,
ship artwork, activate GitHub Actions, or deploy.

## Legacy skin fallback and incomplete saved options (2026-11-14)

A review of the combined renderer found a regression in the new contrast
lookup: `SkinManager.skins[skin_id].bgColor` threw when a saved skin
identifier was removed, unknown, or when `settaggi` was absent. The old
antiscia implementation defaulted to white in these cases; the contrast
helper already specified white as the fallback for unsupported colors.

The renderer now safely reads the selected skin's `bgColor` and passes
an empty string to the helper when there is no known skin. The helper
returns legacy white instead of throwing. All seven current skins keep
their existing contrast-based choice, and geometry/longitude logic is
unchanged. A focused Node test now checks an unknown saved skin with
hover, and absent/empty settings on the no-hover axis-only path.

Regression evidence: before the guard, the GitHub-read renderer raised
`TypeError` for an unknown skin and missing settings in an isolated V8
harness; after the guard, **37/37 isolated synthetic checks pass**
(renderer blob `622fc2fbec6cda35df21a5642c3a819caff6d8fa`).
The branch contains **13 axis Node test definitions and 4 color test
definitions**; these test files have not been executed on a full clone.
Run both committed Node suites and `npm run verify:angular` in a clean
checkout, followed by Chromium/Firefox/PNG/Astrolabio checks before
merge. No benchmark, production integration, or browser parity claim.
