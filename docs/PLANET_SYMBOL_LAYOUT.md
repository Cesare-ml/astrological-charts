# Celestial symbols — compact conjunction layout

## Changes

The old renderer displaced each glyph by running a forward-only 7° gap pass
twice; a compact group could drift far from its actual zodiac position and
crowded up at 0°/360°. The new `planet-symbol-layout.ts`:

1. unwraps zodiac positions at their largest empty arc (so 359° and 0° are neighbours);
2. uses two radial lanes when the available ring width allows it, with a single-lane fallback for narrow charts;
3. spreads glyphs within each lane by minimum-squared angular displacement, based on the actual glyph/label footprint;
4. anchors every thin connector to the **original longitude** at the ring boundary, rather than to the displaced glyph;
5. keeps the symbol and small degree label horizontal even where the radial connector bends.

The on-screen glyph *can* move to improve readability. The underlying `TemaRender`
planet longitudes, cusp positions, aspect calculations and other chart math are
unchanged. The badge reports the original degree within the zodiac sign,
**not** the glyph angle: e.g. 359.7° is `29°`, 46.8° is `16°`.

## Public option

`OpzioniGrafico.mostraGradiElementiCelesti?: boolean` controls degree labels
beside each celestial glyph. It is `true` in `defaultOpzioniGrafico`, and
omitting the property also enables it for older callers. Set it to `false`
to hide the labels and permit slightly tighter angular spacing. This affects
radix, transit and synastry symbol rings, not latitude markers or astrological
calculations.

Example:

```ts
const options = structuredClone(defaultOpzioniGrafico);
options.mostraGradiElementiCelesti = false;
```

The Angular demo exposes a **Show celestial degrees** checkbox and a
**Conjunction stress-test (synthetic)** checkbox. Its stress fixture uses only
illustrative positions around 359°/0° and no user's birth data.

## Verification / integration gate

- Geometry tests: `npm run test:planet-layout`. This covers both the pure
  collision algorithm and a Three.js scene assembled without WebGL using
  synthetic symbol meshes. It checks true-longitude anchors, glyph ring bounds,
  badge placement, original input immutability and default/disabled degree labels.
- Library/demo build: `npm run verify:angular` on a clean install.
- Visual smoke: with the generated local demo pack and both servers running,
  `npm run test:demo` in Chromium and Firefox; inspect
  `conjunction-degrees-on.png` / `conjunction-degrees-off.png` plus the mobile
  screenshot, and compare all four chart modes.
- The input option is additive. No asset path, public import, ephemeris or
  persistent data contract changes. The renderer uses `CanvasTexture` for the
  label, disposed with the scene as other material textures are.
- Only the extracted library is changed. Integration into VirgoStars web,
  native mobile PNG and Astrolabio still requires its own visual validation
  against approved artwork and headless/e-ink devices; this PR does not ship
  those consumers or alter the live website.
