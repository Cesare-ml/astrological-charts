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

## Aspect stroke subdivision safety (proposed)

`OggettiSempliciRender.getLineaGrossaTratteggiata` and `getLineaGrossaPuntoLinea` construct line geometries synchronously. A zero or non-finite `passo` previously allowed an unbounded loop (and could stall a browser). The renderer now rejects non-positive/non-finite step values and non-finite distances, and limits requested stroke primitives to **20,000 per call**. This is a safety bound, not a visual quality setting.

Existing non-negative integer line/point counts and non-negative finite spacing remain supported. An empty line/point pattern produces an empty group. A dot-only pattern (`nLinee: 0, nPunti: 2, rateoLineaSpazio: 1`) no longer divides by zero. For normal configured aspect patterns (quinconce, quintiles, semiquadrate, parallels), subdivision and line positions should remain unchanged; rendering parity still requires browser comparison.

Focused source-method tests: `node --test tests/line-stroke-safety.test.mjs` (requires installed `typescript`). These use a minimal Three.js test double, not a WebGL renderer or approved artwork. Before integration, run the complete Angular verification and Chromium/Firefox natal/transit/synastry/latitude tests with approved fixtures. This does not modify live VirgoStars or Astrolabio.
