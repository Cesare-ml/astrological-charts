# Non-finite zoom guard — renderer service

The public `GraficoRenderService.setZoom()` previously applied `Math.min/Math.max`
without validating the input. A runtime `NaN` therefore propagated into
`zoomValue` and `camera.zoom`, producing an invalid Three.js projection.
This can occur even with a TypeScript `number` signature when JavaScript
consumers, integrations or an arithmetic operation supply bad values.

## Behavior

- **Valid finite numbers:** unchanged clamp to `0.05…5`, update camera
  projection and render once when a camera exists.
- **NaN, +/-Infinity, non-numbers at runtime:** ignored; no state, projection
  or render mutation. This is a defensive difference for infinite inputs,
  which previously saturated the zoom at the nearest bound.
- **zoomIn/zoomOut:** delegate to the validated setter, including custom steps.
- **Before camera initialization:** finite inputs still update the stored zoom;
  invalid inputs leave the original value intact.

The guard does not change chart geometry, assets, skins, zoom limits,
public method signatures, wheel behavior or default controls. The same
method is used by VirgoStars browser and any Astrolabio consumer of this
service; the latter still requires independent headless/e-ink validation.

## Regression check

```sh
npm ci
npm run test:zoom-inputs
npm run verify:angular
```

`tests/zoom-inputs.test.mjs` extracts the actual TypeScript methods using
the TypeScript AST and runs them in an isolated service with a fake camera.
It tests NaN/Infinity/wrong types, clamping, render/projection calls,
zoomIn/zoomOut and pre-initialization. This is a deterministic method-level
test, **not** a WebGL screenshot, mobile PNG or Astrolabio hardware test.

No production integration or deployment accompanies this change.
