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

The latitude ring draws a directional speed marker **only when `latitudeSpeed` is a finite, nonzero number**. Missing, nonnumeric, infinite and zero speed values do not prevent the planet symbol from rendering when its ecliptic latitude is finite; they simply omit the direction marker. This avoids generating Three.js line geometry with `NaN` coordinates or zero-length direction segments. A Node unit test executes the actual ring method with WebGL primitives stubbed, verifies six eligible symbols and two directional markers, and rejects any non-finite line endpoint. Full browser/WebGL output still requires local validation.


`LatitudiniRender.getElementiCelesti` receives **precomputed** ecliptic latitude values in `TemaRender.planets`. A latitude of exactly `0` or `-0` is a valid position on the ecliptic and must remain visible when the body's `elementi_celesti[nome].att` option is enabled. Missing, non-numeric or non-finite latitude values are not chartable and are skipped. **Longitude must also be finite**, because latitude-ring symbols rotate using longitude: missing, string, `NaN` or infinite longitude would produce invalid Three.js geometry. Longitude `0`, `-0` and `360` remain valid. The browser-free ring-level stub test verifies that every image rotation, radial position and speed-marker transform is finite, and that bodies with invalid longitude never request symbol geometry, alongside valid zero-longitude bodies. The renderer skips malformed bodies without calculating or normalizing their astronomical coordinates. The selector also tolerates an absent `TemaRender.planets` record and null per-body enablement entries by returning no corresponding symbols; required `OpzioniGrafico` structure is still expected. This is not a promise that an entirely missing theme can render a complete chart. This is a rendering filter only; it does not calculate astronomical coordinates.

The lightweight `npm run test:latitude` regression uses the TypeScript compiler to extract and execute the **actual** selection method with purely synthetic inputs. It covers `0`, `-0`, positive/negative values (including `Number.MIN_VALUE` and its negative), disabled/missing bodies, `NaN`, positive/negative infinity, strings, null and undefined. It also runs under `npm run preflight`. This isolated method test needs no images or browser. A third source-AST contract assertion checks that `LatitudiniRender.creaScena` passes the natal and transit themes into `getAnelloElementiCelesti` with their respective `false`/`true` ring flags, and that the shared ring builder still invokes `getElementiCelesti(temaRender, opzioni)`. This catches structural bypass of the latitude filter independently of the PNG tests, but cannot prove the output of WebGL. A fourth browser-free source-AST contract test verifies the transit PNG fixture itself: all three comparisons must retain the same transit theme/ring and vary only the Sun latitude from `0` to `Number.NaN` (filtered symbol) to `+2`. This prevents a future test refactor from accidentally reintroducing the false-positive control without relying on WebGL. A separate `npm run test:demo` Playwright regression renders **real Three.js PNGs** with the generated, manifest-verified synthetic pack. It compares an enabled Sun at `latitude: 0` with the same Sun disabled, the same enabled Sun at `latitude: -0`, **and** the enabled Sun at `latitude: +2`. The 0°/disabled and 0°/+2° comparisons must each change more than 30 color channels (ignoring per-channel differences of at most two levels), demonstrating presence and visual movement. The 0°/-0° comparison must remain identical within the repeated-render tolerance (at most 0.01% of channels differing by more than two levels). The test additionally keeps the natal Sun fixed at +2° while checking the transit Sun at 0° versus the **same transit theme with only the Sun latitude filtered** (`NaN`), and then at +2°; this preserves the transit grid and prevents false positives from merely adding/removing the transit ring; each transit presence/movement comparison must also differ by more than 30 color channels. The test saves seven ignored local PNGs **before decoding and comparing pixels**, so they remain available for diagnosis if an image assertion fails: `latitude-zero-sun-enabled.png`, `latitude-negative-zero-sun-enabled.png`, `latitude-zero-sun-disabled.png`, `latitude-positive-two-sun-enabled.png`, `latitude-transit-zero-sun-enabled.png`, `latitude-transit-sun-filtered.png` and `latitude-transit-positive-two-sun-enabled.png` for review. Start `npm run demo:pack`, `npm run demo:assets` and `npm run demo` before the browser suite; use the synthetic pack only for functional verification. Neither test establishes artwork fidelity or Astrolabio compatibility; check production-approved assets, all skins and actual headless hardware separately before consumer integration. The local `npm run preflight` also runs `npm run check:demo-syntax` (checking **both** Playwright `.mjs` test files) and `npm run test:latitude-bundle` (esbuild bundles `tests/fixtures/latitude-zero-render-harness.ts` and asserts that it includes the actual service, latitude renderer and synthetic fixtures). These checks need neither running Angular/asset servers nor a WebGL driver, but **do** need the project's installed npm dependencies. A passing syntax/bundle check is not a passing Playwright test or proof of visual accuracy.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.
