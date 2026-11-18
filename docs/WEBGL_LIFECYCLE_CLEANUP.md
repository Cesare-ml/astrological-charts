# WebGL cleanup after redraw and PNG export

## Scope

The chart renderer creates temporary Three.js groups for redraw and a new
offscreen `WebGLRenderer` plus canvas for each PNG export. Normal redraws
already dispose scene geometry, materials, texture properties and registered
animations. Four gaps remained:

1. `WebGLRenderer.dispose()` releases Three.js internals but does not explicitly
   relinquish the offscreen canvas's underlying WebGL context.
2. `CartaAstraleCreaScena()` could throw after earlier modules had constructed
   groups. The incomplete chart was never returned to the render service, so
   its scene meshes and textures were not reachable by the normal disposer.
3. The latitude builder could leave its detached sign and natal groups behind
   when a later async module failed; its latitude-grid group could also be
   abandoned during glyph loading or indicator creation.
4. Nested zodiac, decan, decade, latitude-house and aspect-background modules
   could fail during asynchronous artwork loading, losing access to their
   already constructed groups before the parent scene received them.

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
- The latitude builder tracks sign and planet groups while they are detached,
  preserves the original rendering order (houses, background, transits, signs,
  natal planets), and joins them to the disposal tree on failure.
- The latitude planet/grid builder cleans up its own partially assembled group
  on failure. Each loaded glyph and indicator is attached immediately after
  creation so subsequent placement errors cannot orphan them.
- The principal zodiac, decan and decade rings (including the synastry ring),
  latitude-house module and aspect-background module dispose their own partial
  groups if their asynchronous construction fails. Loaded images are attached
  as soon as they are created; latitude house divider lines are tracked until
  their matching glyphs are ready, retaining the original draw order.
- Natal and synastry house rings, term glyphs, the enclosing house module and
  the main celestial ring now also release partially assembled resources on
  failure. Pending divider lines, detached completed house rings and planet
  glyphs not yet attached to the parent are tracked explicitly; the original
  paint order and the normal successful return path are preserved.
- A failed aspect-background child also causes the unfinished enclosing
  aspect-circle group to release its own resources.

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
- Five further tests cover failing first/second latitude glyphs, indicator
  creation, transit glyphs after a successful natal ring, and successful
  rendering order with disposal deferred until the caller finishes.
- Seventeen additional tests cover failures of zodiac glyphs, decan and decade
  glyphs, nested decan/decade assembly, synastry zodiac, latitude and natal
  house glyphs, synastry house dividers, term glyphs, the enclosing house
  module, main planetary glyphs/connectors, solar-resonator artwork and the
  enclosing aspect-circle group. Successful nested module construction retains
  resources until the owner explicitly disposes them.

These are lifetime *contracts*, not GPU-memory measurements. The actual
`WEBGL_lose_context` extension is optional in browsers; `forceContextLoss()`
does nothing if unsupported. Verify the real browser resource behavior and
repeated PNG exports on Windows, mobile and Astrolabio headless before adopting
the change in consumers. The browser test suite uses generated images and does
not establish parity with the VirgoStars original assets.

## Remaining limits

Other modules which throw **during their own asynchronous group assembly**
may still create individual textures/meshes never attached to a parent.
Lower-level image loader failures and advanced chart-mode paths outside the
covered groups still require dedicated auditing. The covered module paths
do not establish full lifecycle parity for all chart modes. Comprehensive
memory/GPU profiling remains separate work.
No production sites, device firmware, asset locations or public APIs change.
