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

## Independent Astrolabio defaults

`settaggiAstrolabioDefault` is a legacy exported **mutable object**. For independent
Astrolabio views or devices, use the additive public factory
`createDefaultSettaggiAstrolabio()`. It reproduces the existing default values
while cloning aspect toggles/orbs, individual celestial-body settings, and the
local/manual position (including its city identifier). Every call returns new
model instances, so modifying one chart's settings cannot mutate another
chart or the legacy default object. The factory does **not** automatically
migrate existing callers or change the default values in production.

Run `npm run test:astrolabio-defaults` for an isolated TypeScript-model regression.
The test compiles the actual model with the project's TypeScript compiler; full
`npm run verify:angular`, Chromium/Firefox renderer checks, Astrolabio hardware,
and offline/headless compatibility remain separate acceptance gates.
