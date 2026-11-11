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
