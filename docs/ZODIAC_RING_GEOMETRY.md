# Zodiac sign ring: synastry separators and austral glyphs

## Scope

The untextured synastry zodiac ring renders **12 sign boundaries** at 30-degree
intervals. Previously, it iterated over 72 positions at five-degree intervals
and created 60 additional **zero-length** Three.js line objects. This change
creates only the 12 visible separators. Their angular placement, line length
and order remain unchanged.

The synastry ring's 12 zodiac glyphs now forward the existing
`australInversion` argument to `OggettiSempliciRender.getImg`, instead of
always supplying `false`. Northern/default views retain their prior
orientation; southern-inverted synastry views can now use the same image
orientation contract as other chart rings.

The untextured *natal* ring no longer emits the accidental `asd` console
message. Its **72 five-degree** tick lines and all 12 sign glyphs remain
unchanged.

## Synthetic regression check

Run after `npm ci`:

```bash
node --test tests/zodiac-ring-renderer.test.mjs
```

The test transpiles the actual TypeScript `SegniRender` class and uses
synthetic Three.js geometry/image spies. It checks:

- 12 nonzero synastry separators, at the original angles, instead of 72;
- 12 image requests and the correct `australInversion` flag in both modes;
- unchanged 72 natal tick lines and 12 natal symbols;
- no debug console output from the untextured natal path.

This is **not** a pixel comparison, WebGL buffer allocation measurement, or
proof that specific licensed glyph textures have the correct artwork. Test
only uses synthetic inputs and has no network or original-asset dependency.

## Required review before integration

1. `npm ci` and `node --test tests/zodiac-ring-renderer.test.mjs`
   in a clean checkout (record Node/npm versions and exit codes).
2. `npm run verify:angular`, library and demo builds.
3. Chromium and Firefox synthetic chart screenshots for natal and
   synastry with `australInversion` false/true, across seven skins.
4. With owner-authorized approved images, compare actual glyph orientation
   and colors in both hemispheres. Verify PNG export and the Astrolabio
   headless/e-ink adapter before a production consumer migration.

**Compatibility:** No public method name, parameter list, asset URL, image
file, package dependency, ephemeris calculation, build script or export
format changes. Only the redundant scene objects, inversion forwarding,
and log behavior change. No deployment, auto-merge or release is included.
