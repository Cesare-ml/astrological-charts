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
