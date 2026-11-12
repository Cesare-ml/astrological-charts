# Offscreen PNG export size validation

The Angular/Three.js renderer already exports chart canvases through
`GraficoRenderService.generaImmagine()`. This change protects the **existing
API** from invalid or excessively large offscreen allocations before creating
a WebGL context or joining the global scene-construction queue.

## Contract

`validateChartExportDimensions(dimensions, scale)` is an internal pure helper
in `src/lib/renderers/chart-export-dimensions.ts`, not an astronomical
calculation and not a new public chart interface.

- `dimensions.x` and `dimensions.y` must be positive safe **integers**
  describing the requested logical CSS drawing size.
- `scale` must be a finite positive number. Fractional pixel ratios such as
  `1.5` remain supported.
- The scaled pixel width/height must each be at least `1`, at most `8192`,
  and the total scaled pixel budget must not exceed `32 * 1024 * 1024`
  (33,554,432 pixels).
- Invalid inputs reject with `RangeError` from the existing async export
  method **before** allocating an offscreen canvas, a Three.js scene, or a
  WebGL context. The global queue remains available for other charts.
- The helper does not mutate a valid input, change the camera zoom, rescale
  planet symbols or adjust any existing output for valid requests.

Examples: `800×800 @ 2`, `1080×1080 @ 2`, and `4096×2048 @ 1.5`
continue to be permitted. `8192×4096 @ 1` is the edge of the pixel
budget. `8192×4097 @ 1`, non-finite dimensions, zero sizes and extreme
scales are rejected.

**GPU constraints still apply.** A particular GPU can have a
`MAX_RENDERBUFFER_SIZE` lower than the software limit or less available GPU
memory. Passing these guards does not guarantee export success on every device.
The bounds are conservative allocation limits, not a visual or performance
guarantee.

## Tests

Run in a clean checkout of the stacked branch:

```bash
npm ci
npm run test:export-dimensions
npm run check:types
npm run verify:angular
```

The Node test transpiles and executes the **actual TypeScript helper**, checks
representative sizes and invalid inputs, and confirms that the service calls
the guard before `runExclusive`. The test is included in `npm run preflight`.
It does not create a real WebGL context.

Manual browser checks (Chromium and Firefox) must additionally confirm
`800×800 @ 2` PNG export succeeds, remains visually correct, and produces
no canvas/context leaks. On an explicitly unsupported request, the demo host
should report a controlled failure rather than attempting resource allocation.
For Astrolabio, check the real headless exporter and supported device memory
before any production migration.

## Rollback and scope

This PR is stacked on draft interaction PR #22 to avoid modifying its moving
branch. The release remains on hold for full browser and production integration
validation. No font, image, ephemeris, production VirgoStars repository, hosted
service, GitHub Actions, npm publication or device is modified. Revert this
focused PR if an approved caller needs a different export budget, after
establishing its GPU/device contract.
