# Runtime validation for interactive focus inputs

The public Angular `GraficoRenderService` methods and its on-screen
`PlanetInteractionController` have TypeScript contracts, but callers in
JavaScript, deserialized JSON or custom UI bindings may bypass them.

## Programmatic focus

`highlightPlanet({layer, name})` accepts a nonempty planet/angle name with
layer `natal`, `transit` or `synastry`. A **valid** reference is copied
before it is cached and forwarded to the interaction controller.

`highlightPlanet(null)` is the **only** explicit clearing operation. Invalid
non-null values (including `undefined`, an unknown layer, an empty name, or a
primitive) are ignored: they cannot silently erase a pinned AS/DS/MC/IC or
planet focus. The same validation applies when calling the on-screen
controller directly. Neither path changes camera zoom or glyph scale.

## Natal aspect palette mode

`setNatalAspectPresentation()` accepts only `all`, `focused`, or
`muted`. An unsupported value is ignored by both service and controller:
the last valid mode stays cached and is replayed on scene reinitialization.
A malformed host value therefore cannot inadvertently turn native natal
aspects gray.

This is runtime input safety, not a new public API or a change to aspect
calculation. Normal `null` focus clearing, legal mode transitions, on-screen
coloring and redraw coalescing remain unchanged.

## Tests and release gates

`npm run test:camera-invariants` runs the **actual** service/controller
TypeScript method bodies in synthetic dependency-light probes and now covers
invalid inputs, saved-state replay, valid focus clearing, natal mode
transitions and camera invariance.

These tests do not instantiate a Three.js WebGLRenderer, load the actual
artwork or prove browser/PNG/real-device visual behavior. Keep the parent
interactive PR in draft until `npm ci`, `npm run verify:angular`, Chromium
and Firefox canvas inspection, real approved-asset verification, and
Astrolabio compatibility have been reviewed. This patch does not change
production VirgoStars, GitHub Actions, licenses, or distribution settings.
