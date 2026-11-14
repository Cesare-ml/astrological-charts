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
- 12 textured sectors with unchanged 30-degree boundaries and signed z-depth,
  for both inversion values;
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

## Isolated executable source check (2026-11-14)

Using the actual source of `segni.renderer.ts` fetched from GitHub, an isolated
JavaScript V8 harness stripped imports and TypeScript-only annotations, then
executed the real class with synthetic Three.js and skin/image stubs:

- **PASS 5/5** on branch source blob `e9e7b4b2bf599c59d6f6f4600ad86a5ba0cd6963`:
  four synastry cases (textured/untextured × both inversion modes) and the
  baseline natal geometry + no-debug case.
- **RED 0/5** on original `main` source blob
  `f50fff1c12d0edc57a80a7fc6b962e546d186d2f`: old code still creates
  72 synastry lines in every case and logs the unwanted natal message.
- The committed `node --test` suite and `npm run verify:angular` were
  **NOT RUN** in a complete checkout. The isolated harness validates class
  behavior, but not the Node fixture itself, GPU allocation or image pixels.

**Call-site caveat:** on current `main`, `SinastriaRender.getAnelloSinastria`
passes a literal `false` for `australInversion` when it invokes
`SegniRender.getAnelloSegniSinastria`. This PR forwards its *existing method
argument* correctly, but does **not** enable southern hemisphere inversion
in the full synastry UI by itself. A separate, reviewed end-to-end decision
would be required to change that behavior consistently for houses, planets
and signs.

**PR coordination:** draft PR #73 also edits the natal untextured debug-log
line in `segni.renderer.ts`. After either PR merges, the other must be rebased
and its duplicate hunk reconciled; don't merge both blindly. All published
and consumer integration gates remain unchanged.
