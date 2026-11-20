# Rendering architecture

## Chakra sector interaction (local integration)

An opt-in hover listener reports the selected chakra and numbered sector from
the wheel's transformed geometry. Picking covers the complete inner circle,
including the space outside the inscribed polygon. Subtle guides identify the
sectors and a single reusable mesh highlights the hovered wedge without a scene
rebuild. Pointer listeners are disposed with the renderer. The host owns any
descriptions displayed for a sector. Synthetic geometry tests do not replace a
visual check in each consuming application.

The desktop can opt into dotted partner axes and independent synastry pointer
picking. Supplied cross-aspects remain calculated by the host. The default
presentation for other consumers remains unchanged.

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

The nine Kleroi glyphs retain their dedicated colors across skins: Tyche,
Daimon, Basis and Ananke use the existing lot palette, while the five planetary
lots use their respective planet colors. Other celestial glyphs retain the
selected skin's tint. This changes presentation only, not calculations or the
host-owned asset contract.

When the host selects `kleros: 'visualizza sorti'`, aspects involving a Kleros
use the aspect's normal color; the other natal aspects and their endpoint
markers are gray and translucent. Other rendering modes are unchanged.

## Components and current coupling

The interactive canvas follows the display pixel ratio on initialization and
resize, capped at 2 to bound GPU memory. Line widths continue to use CSS
viewport dimensions; hit testing and chart geometry are unchanged. Export keeps
its separate explicit scale. This is a local renderer change, not a deployed
web, mobile or Astrolabio update.

- `src/public-api.ts` exports render service, models, skin manager and basic Three.js primitives.
- `GraficoRenderService` is a root Angular singleton that owns WebGL resources, canvas, camera and scene.
- Scene composition uses `CartaAstraleCreaScena`, `LatitudiniRender`, and modular ring renderers.
- Some visual configuration and dimensions are global. `GraficoRenderService` serializes scene construction and export across its instances, restores the dimensions at the start of each operation, and waits for its scene textures. Direct calls to lower-level renderer functions and concurrent changes to global configuration remain outside this protection.
- Symbols, textures and resonator images currently live outside this package in VirgoStars `public/assets/`.
- Astrolabio uses a separate headless bundling/resolution path and must be regression-tested before updates.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.
