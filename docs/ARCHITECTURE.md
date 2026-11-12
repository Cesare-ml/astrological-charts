# Rendering architecture

Source: `Cesare-ml/virgo-stars/docs/graphics/` (reference documentation, Aug 2026). The original repo remains authoritative for production.

```text
Astrology calculation result (TemaRender)
              |
       GraficoRenderService (Angular)
              |
      carta-astrale / latitudini
              |
  sign, planet, house, aspect,
  transit and synastry modules
              |
       primitive Three.js scenes
              |
   browser canvas / browser PNG
              |
  Astrolabio headless adapter (external)
```

The library does not independently calculate the full astronomical ephemeris or interpretation. It depends on precomputed planetary positions and house inputs. Some aspect selection and derived visual elements are computed during rendering.

## Components and current coupling

- `src/public-api.ts` exports render service, models, skin manager and basic Three.js primitives.
- `GraficoRenderService` is a root Angular singleton that owns WebGL resources, canvas, camera and scene.
- Scene composition uses `CartaAstraleCreaScena`, `LatitudiniRender`, and modular ring renderers.
- Some visual configuration and dimensions are global. `GraficoRenderService` serializes scene construction and export across its instances, restores the dimensions at the start of each operation, and waits for its scene textures. Direct calls to lower-level renderer functions and concurrent changes to global configuration remain outside this protection.
- Symbols, textures and resonator images currently live outside this package in VirgoStars `public/assets/`.
- Astrolabio uses a separate headless bundling/resolution path and must be regression-tested before updates.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.


## Render-only planetary collision layout extraction (draft PR #22)

`src/lib/renderers/planet-layout.ts` now contains the **historical
two-pass 7-degree glyph collision algorithm**, independent of Angular,
Three.js and astronomical computations. `ElementiCelestiRender.ciclo`
and `getRenderPosPianeti` remain available as compatibility methods
but delegate to the shared primitive. No existing rendered chart
positions, southern-hemisphere geometry, skin or collision ordering
should change. The helper takes upstream planetary coordinates and
returns a fresh layout map, preserving the source object's values.
Use `npm run test:planet-layout` (also part of `npm run preflight`):
the regression compares the new helper against a self-contained copy
of the previous algorithm across edge cases and 200 deterministic
synthetic charts. This extraction is a **prerequisite only** for future
incremental coordinate patches; existing `disegnaScena()` still
regenerates dependent planet labels, tick lines, houses and aspects.
Moving glyph meshes alone would produce an incorrect chart.


### Shared true longitude and collision-adjusted glyph angle

`chartBodyRenderAngles()` is a pure rendering helper shared with
`layoutChartGlyphLongitudes()`. The live wheel renderer uses its
`tickDegrees` for original planet tick/leader lines and native
true-angle metadata used by focused aspect guides. Its
`glyphDisplacementDegrees` is used only to separate symbols to
prevent visual overlap; `glyphDegrees` records the combined
rendered direction for a future coordinated atomic update.
Historical floating-point expression order is retained.

The helper does not calculate ephemerides/aspects, change the
source longitude, alter scene hierarchy or glyph sizing, or enable
a partial coordinate patch yet. Run `npm run test:planet-layout`
and visual parity in Chromium/Firefox before approval.


### Per-body visual ownership without changing transforms (draft PR #22)

`ElementiCelestiRender.getAnelloElementiCelesti()` now uses its
previously unused `elGroup` as an **identity-transform owner** for
each rendered body. `elGroup.userData.chartPlanetBody` identifies
`{layer,name}` for natal/transit/synastry and the body owns its
glyph, original-longitude inner/outer leader ticks, Moon marker,
optional dodecatemore glyph and arc, plus per-body GSAP animations.
Its children have `chartBodyVisualRole` tags when applicable.

The wrapper has zero position/rotation and unit scale: the existing
visual transform operations remain on each child, including
anti-collision glyph displacement and true-angle radial leaders.
The `chartPlanet` pointer tag remains on the glyph mesh, so the
interaction controller still traverses/picks the original target.
The original transit-ring radius and aspect-angle metadata remain
unchanged. Nested per-body animations and partial geometry now get
cleaned up if `getAnelloElementiCelesti()` itself rejects.

This makes linked parts discoverable for a future coordinated
incremental coordinate update. **No live position updating** is
enabled: complex house, native-aspect and derived decoration
dependencies still require a full scene reconstruction.
`npm run test:planet-body-groups` performs source AST checks.
The synthetic transit-spoke Playwright fixture now wraps bodies
the same way and checks world-space parity for normal and
mirrored views, alongside existing radius/guide regressions.
