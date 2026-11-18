# WebGL cleanup after redraw and PNG export

## Scope

The chart renderer creates temporary Three.js groups for redraw and a new
offscreen `WebGLRenderer` plus canvas for each PNG export. Normal redraws
already dispose scene geometry, materials, texture properties and registered
animations. Several gaps remained:

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
5. Synastry, transit/antiscia and ASC/MC marker builders could similarly
   abandon already constructed meshes after a later module or glyph failed.
6. The lower-level asynchronous texture loader could reject while retaining an
   unreturned Three.js texture; setup exceptions could orphan the loaded map.
7. Some lower-level composite shapes (textured arcs, dashed/dotted fat lines,
   arrow arcs) and multi-theme aspect groups could throw after generating
   shapes without returning their unfinished groups to the owner.
8. The shared thick-line geometry/material constructors could throw between
   allocation and returning a line, leaving objects unreachable even when the
   calling composite disposed its previously attached segments.
9. Basic circle, ring, quadrilateral, triangle and arc factories could also
   abort after allocating a geometry but before handing the primitive to its
   parent scene.

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
- The synastry wrapper tracks its house ring while it is detached, and disposes
  both it and completed planets if a later module fails. Transit/antiscia
  wrappers dispose their own partial groups; antiscia dots and lines are added
  in original order as they are created.
- The ASC/MC marker builder releases existing stems, terminal dots, arrows and
  text textures if the planetary-hour image or later geometry fails.
- The async texture loader disposes textures on failure, including callbacks
  triggered before the loader returns. Material setup and image mesh creation
  also release their already acquired texture/material on synchronous failure.
- Textured arcs now clean their geometry and texture if setup aborts. Dashed,
  dotted and arrow-arc composites clean already assembled children when a later
  segment fails; the arrow's existing final layer order is preserved.
- Aspect line groups and the multi-theme wrapper clean already returned child
  groups after an exception. Shared endpoint-disc geometry is disposed once,
  including when an error occurs before the first disc is attached.
- The shared thick-line geometry builder now releases its allocated buffer if
  position/color attribute setup fails; the line factory releases its input
  geometry and any constructed material if scale, resolution or mesh creation
  fails. On success ownership transfers unchanged to the returned Three.js line.
- Circle, ring, quadrilateral, triangle and arc factories release allocated
  geometry and any completed material when an intermediate step fails. The
  optional map passed to an unfinished ring remains owned by its caller; in
  the successful path the scene disposer handles its map normally.

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
- Forty-six additional tests cover failures of zodiac glyphs, decan and decade
  glyphs, nested decan/decade assembly, synastry zodiac, latitude and natal
  house glyphs, synastry house dividers, term glyphs, the enclosing house
  module, main planetary glyphs/connectors, solar-resonator artwork and the
  enclosing aspect-circle group, detached synastry houses, transit and
  antiscia overlays, ASC/MC planetary-hour glyphs, asynchronous loader errors
  and texture setup failures, textured arc setup, dashed/dotted segments,
  arrow arcs, shared aspect endpoint geometry and multi-theme wrappers, plus
  thick-line geometry/material construction failures and successful ownership,
  plus basic primitive construction failures and unchanged successful shape
  ownership, including an externally supplied ring texture.
  Successful nested module construction retains
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
Other primitive constructors, less-common advanced paths and browser
image-loading races still require dedicated auditing: the synthetic loader
tests do not establish real browser parity. The covered module paths do not
prove full lifecycle parity in all chart modes. Comprehensive memory/GPU
profiling remains separate work.
No production sites, device firmware, asset locations or public APIs change.
