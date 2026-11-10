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

## Latitude chart selection boundary

`LatitudiniRender.getElementiCelesti` receives **precomputed** ecliptic latitude values in `TemaRender.planets`. A latitude of exactly `0` or `-0` is a valid position on the ecliptic and must remain visible when the body's `elementi_celesti[nome].att` option is enabled. Missing, non-numeric or non-finite latitude values are not chartable and are skipped. This is a rendering filter only; it does not calculate astronomical coordinates.

The lightweight `npm run test:latitude` regression uses the TypeScript compiler to extract and execute the **actual** selection method with purely synthetic inputs. It covers `0`, `-0`, positive/negative values (including `Number.MIN_VALUE` and its negative), disabled/missing bodies, `NaN`, positive/negative infinity, strings, null and undefined. It also runs under `npm run preflight`. This isolated method test needs no images or browser. A separate `npm run test:demo` Playwright regression renders **real Three.js PNGs** with the generated, manifest-verified synthetic pack. It compares an enabled Sun at `latitude: 0` with the same Sun disabled, the same enabled Sun at `latitude: -0`, **and** the enabled Sun at `latitude: +2`. The 0°/disabled and 0°/+2° comparisons must each change more than 30 color channels (ignoring per-channel differences of at most two levels), demonstrating presence and visual movement. The 0°/-0° comparison must remain identical within the repeated-render tolerance (at most 0.01% of channels differing by more than two levels). The test saves four ignored local PNGs: `latitude-zero-sun-enabled.png`, `latitude-negative-zero-sun-enabled.png`, `latitude-zero-sun-disabled.png` and `latitude-positive-two-sun-enabled.png` for review. Start `npm run demo:pack`, `npm run demo:assets` and `npm run demo` before the browser suite; use the synthetic pack only for functional verification. Neither test establishes artwork fidelity or Astrolabio compatibility; check production-approved assets, all skins and actual headless hardware separately before consumer integration.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.
