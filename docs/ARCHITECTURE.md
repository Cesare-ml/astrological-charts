# Rendering architecture

Source: `Cesare-ml/virgo-stars/docs/graphics/` (reference documentation, Aug 2026). The original repo remains authoritative for production.

```text
              Precomputed positions and house cusps
             (Node.js, Python, Rust bindings in future)
                                |
                JSON v1 -> TemaRender adapter
                                |
             Angular / TypeScript / Three.js renderer
                                |
             +------------------+-----------------+
             |                  |                 |
     VirgoStars frontend   Node.js helper    Astrolabio adapter
     Angular service       Chromium demo     Offline Firefox/file://
     Browser/UI + PNG      PNG/JPEG          PNG/e-ink pipeline
```

Node.js or Python can pass computed positions and house cusps through JSON v1 (`demo/chart-input.ts`), then use the local Chromium bridge (`scripts/render-chart.mjs`) for the existing Angular renderer's PNG/JPEG output. The Node programmatic wrapper is `node/index.mjs`. This is an
adapter, not a second graphics or astronomical implementation. It currently requires a browser/WebGL runtime; a true headless native/WASM-only drawing backend is not implemented.

The library does not independently calculate the full astronomical ephemeris or interpretation. It depends on precomputed planetary positions and house inputs. Some aspect selection and derived visual elements are computed during rendering.

## Components and current coupling

- `src/public-api.ts` exports render service, models, skin manager and basic Three.js primitives.
- `GraficoRenderService` is a root Angular singleton that owns WebGL resources, canvas, camera and scene.
- Scene composition uses `CartaAstraleCreaScena`, `LatitudiniRender`, and modular ring renderers.
- Some visual configuration and dimensions are global. `GraficoRenderService` serializes scene construction and export across its instances, restores the dimensions at the start of each operation, and waits for its scene textures. Direct calls to lower-level renderer functions and concurrent changes to global configuration remain outside this protection.
- Symbols, textures and resonator images currently live outside this package in VirgoStars `public/assets/`.
- Astrolabio uses a separate **Node.js-driven, headless Firefox,
offline `file://`** bundling/resolution path, directly calling
`CartaAstraleCreaScena` with patched image loading. The new
Chromium developer helper must not silently replace that path.
See `docs/NODE_INTEGRATION.md` and `docs/INTEGRATION_PLAN.md`.
Actual device and e-ink compatibility must be regression-tested before updates.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.
