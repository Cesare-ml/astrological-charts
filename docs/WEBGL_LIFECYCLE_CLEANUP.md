# WebGL cleanup after redraw and PNG export

## Scope

The chart renderer creates temporary Three.js groups for redraw and a new
offscreen `WebGLRenderer` plus canvas for each PNG export. Normal redraws
already dispose scene geometry, materials, texture properties and registered
animations. Two gaps remained:

1. `WebGLRenderer.dispose()` releases Three.js internals but does not explicitly
   relinquish the offscreen canvas's underlying WebGL context.
2. `CartaAstraleCreaScena()` could throw after earlier modules had constructed
   groups. The incomplete chart was never returned to the render service, so
   its scene meshes and textures were not reachable by the normal disposer.

## Implementation

- `GraficoRenderService.generaImmagineInterna()` still serializes export with
  other chart operations and preserves the PNG result. Its existing `finally`
  disposes the scene and renderer, then calls `offRenderer.forceContextLoss()`.
  This is **only for a private export canvas**; the interactive canvas is not
  explicitly context-lost, because it may be reused on the page.
- The existing deduplicating scene cleanup moved unchanged into
  `src/lib/renderers/scene-resources.ts` and is now called by both the render
  service and the natal chart builder's error path.
- A successfully constructed scene is still owned by the service; the chart
  builder never disposes it on the normal return path.

## Reproducible regression tests

```bash
npm run test:webgl-lifecycle
npm run verify:angular
```

The Node tests run the *actual* TypeScript export method, chart builder and
disposal helper with deterministic Three.js meshes and fake WebGL methods:

- Twelve consecutive successful exports dispose all generated resources and
  close all twelve independent WebGL contexts.
- Texture-loading, renderer and PNG-encoding failures still release the
  offscreen context in the correct order.
- A chart builder failure in a later module disposes the previously attached
  group, shared texture, material and geometry **once**, as well as stopping
  animations. Successful construction does not dispose those resources early.

These are lifetime *contracts*, not GPU-memory measurements. The actual
`WEBGL_lose_context` extension is optional in browsers; `forceContextLoss()`
does nothing if unsupported. Verify the real browser resource behavior and
repeated PNG exports on Windows, mobile and Astrolabio headless before adopting
the change in consumers. The browser test suite uses generated images and does
not establish parity with the VirgoStars original assets.

## Remaining limits

Modules which throw **during their own asynchronous group assembly** may
create individual textures/meshes never attached to a parent. Those must be
addressed within the modules themselves. The latitude chart builder's partial
failure path and comprehensive memory/GPU profiling remain separate work.
No production sites, device firmware, asset locations or public APIs change.
