# Planet interactions: natal ↔ transit

**Draft, on-screen WebGL only.** `GraficoRenderService` has a bidirectional pointer/programmatic API. A planet is identified by `{ layer: 'natal' | 'transit' | 'synastry', name: string }` with the original `TemaRender.planets` key. Never use the temporary Three.js UUID or the planet name without its layer.

```ts
import type { ChartAspectRelation } from 'grafici-astrologici';

const links: ChartAspectRelation[] = [{
  from: { layer: 'transit', name: 'Saturn' },
  to: { layer: 'natal', name: 'Sun' },
  type: 'quadrato',
  orb: 1.2
}]; // Example fixture only: calculate upstream, NOT in this renderer.

renderer.setCrossChartAspects(links);
renderer.setPlanetInteractionListener(event => {
  // event.type: enter / leave / click / update
  // event.planet: { layer, name }
  // event.aspects: links involving that exact planet and layer
  if (event.type === 'enter' || event.type === 'update') {
    showTooltip(event.planet, event.aspects);
  }
  if (event.type === 'leave') hideTooltip();
  if (event.type === 'click') renderer.highlightPlanet(event.planet);
});
renderer.highlightPlanet({ layer: 'natal', name: 'Sun' }); // frontend button
renderer.highlightPlanet(null); // remove pinned selection
// On host component teardown: renderer.setPlanetInteractionListener(null);
```

**Live aspect refresh:** if the host calls `setCrossChartAspects` while the pointer still hovers a planet, the renderer updates its lines and emits `{ type: 'update', planet, aspects }` with the new relationships. This is **not** another `enter`, and it is not sent for a pinned-only selection after the pointer leaves. Hosts should update their tooltip on both `enter` and `update`. A programmatic pin remains in force until cleared with `highlightPlanet(null)`.

**Behavior:** hover natal Sun shows only its supplied transit partners and temporary connector lines; hover a transit planet does the reverse. An explicit selection is retained after mouse leave. The receiver decides whether a click should pin a selection or open a detail pane. Missing links means just the selected planet is enlarged. Planet symbols are tagged by layer when built (including synastry); raycasting checks only those meshes and never decorative rings. Hit testing follows camera zoom/resize. Scene replacement removes overlays and restores original scaling before disposal. No extra pointer listeners in offscreen PNG/Node/Python exports.

**Architectural boundary:** chart rendering does not calculate longitudes, natal/transit aspects or orbs. Supply relations from the host/backend or `astrological-functions` using VirgoStars-Ephemeris for astronomical inputs. In standard circular charts, the temporary overlay projects the *original unshifted angular directions* onto the existing central aspect circle radius, rather than joining the collision-shifted glyph centers on the outer rings. This is a focused transient overlay (simple colored lines), **not** a replacement for the existing central aspect renderer's traditional line styles and filters. It uses the displayed longitude direction already known to the rendering module; it does not calculate astrological aspects. **Orientation matches `AspettiRender.renderArchi`:** angle zero starts at the top `(0, r)` and positive angles rotate counter-clockwise, giving `(x, y) = (-r sin(angle), r cos(angle))`. Using conventional `(r cos(angle), r sin(angle))` would misalign the focus overlay by 90°. Southern-hemisphere inversion follows the chart group's world transform. If the chart has no aspect-circle metadata (e.g. the latitude view), the overlay falls back to connecting glyphs. Existing `AspettiRender` stays intact. Future work: render real central cross-theme aspect arcs from the same upstream result, add touch/keyboard UX at the host level, and browser regression tests.

**Accessibility:** do not rely on canvas hover alone. Present an accessible list of planet buttons in the Angular host, each calling `highlightPlanet`; use a tooltip/panel instead of firing native `alert()` on every mouse move. This API is a service callback (not an Angular `@Output`).

**Manual acceptance before merging:** Chrome+Firefox with assets approved, both Sun layers distinct, natal ↔ transit hover each way, persistence of pinned focus after hover leaves, names containing spaces, zoom/resize, skin changes, 50 redraws/no lingering pointer callbacks or WebGL resources, no differences to screenshot/export paths. Full `npm ci`, `npm run preflight`, `npm run build` and `npm run build:demo` must pass in a clean checkout. No changes to production VirgoStars/Astrolabio or asset packaging.

## Multi-chart lifetime regression

The opt-in browser suite `npm run test:demo-interactions` now includes a two-canvas test with the same planet identities in **independent** controllers. It checks that events and active overlays cannot leak between charts; repeats **50 synthetic scene replacements** with a pinned natal planet; observes `dispose` notifications on each retired overlay's geometry and material; verifies scaling is restored; checks southern-hemisphere mirror coordinates; and ensures both canvases stop emitting pointer events after their controllers are destroyed. It does not instantiate a WebGLRenderer or measure GPU-memory usage. Visual Chrome/Firefox and full WebGL tests are still separate merge gates.

The central-ring endpoint regression is also compared against `AspettiRender.renderArchi`'s upper-axis origin; this guards against 90°-rotated highlights.


## Host-callback re-entrancy safety

On scene replacement, the controller now disposes temporary overlays, clears the old raycasting/glyph references and sets its current scene to `null` **before** emitting a synchronous `leave` event to the Angular host. A host may call `highlightPlanet` or `setCrossChartAspects` immediately from that callback without resurrecting an overlay on the discarded scene. Any new pin is applied when the replacement scene is indexed. The two-canvas browser harness includes a regression for this precise callback timing.


## Touch and pointer cancellation

Canvas `pointerup` from touch and `pointercancel` end the temporary hovered focus, returning to a pinned selection if one exists. The later synthesized `click` can still notify the Angular host and pin the tapped planet. Normal mouse `pointerup` does not clear its hover. These extra pointer listeners are detached on controller destruction; only the live on-screen canvas receives them. The browser pointer harness now tests touch-release, follow-up click and pen cancellation.

## Target visual behavior — owner reference (2026-11-11)

**Status: implementation specification, not a claim of full visual parity.**
The owner provided a screenshot in the chat showing a wheel with natal planets
inside, transiting planets outside, monochrome symbols, highlighted planets and
colored aspect connections. The reference screenshot is **not** embedded in
this repository (the original software artwork, branding and layout are not
to be reproduced verbatim).

### Symbol presentation and selection

- Planet symbols are normally **monochrome**: black/dark on a light
  chart; white/light on a dark chart. Skin palette determines the neutral
  tint. Do not permanently pre-color every planet by its identity.
- **Pointer enter selects and latches** the planet (on-screen only).
  The focus remains when the mouse leaves; entering another planet
  switches the selection. Keyboard and touch buttons must select the
  same way; a click may also pin explicitly. Expose an API to clear or
  programmatically select a planet. `{layer,name}` distinguishes natal
  and transit Suns.
- The selected planet and **only the partners of its currently visible
  aspects** receive their planet-specific colors; unrelated symbols
  stay neutral. Focus colors should respect adequate skin contrast and
  use the established VirgoStars planet palette where possible.
- The selected planet is indicated by a persistent, accessible selection
  state; do not rely solely on hover, color or enlargement.

### Transit chart: natal wheel inside, transits outside

- The *complete natal-to-natal* aspect picture stays visible in **soft
  gray as a background** in the central aspect circle. It must not be
  destroyed or recalculated when a planet is focused.
- Selected natal or transit bodies show their **precomputed cross-chart
  aspects** in their aspect-specific colors, drawn visibly **above**
  the gray natal lines in the central circle. Selecting an outer
  transit planet works in the opposite direction as selecting an inner
  natal planet.
- For each involved transiting planet, a **dashed radial connector**
  extends from its point on the central aspect diagram toward the
  transit periphery, using the original longitude angle (not a
  collision-shifted text/glyph center). Respect southern hemisphere
  inversion and per-chart transforms; avoid covering text labels.
  Dashed connectors inherit the associated aspect color.
- Keep the native natal aspects in gray even when the selected body is
  natal; the colored overlay represents the focus relations.
  No invented relationships: use links supplied by the frontend or
  `astrological-functions`/backend; preserve aspect types, orbs
  and filtering.

### Natal chart without transits

- Default presentation: **all natal aspects in their normal colors**.
- Add a user-accessible **Focus aspects** switch. When switched on,
  all natal aspects become soft gray except those touching the
  selected natal body, which retain their own aspect colors.
  When focus is enabled without an existing natal selection,
  **Sun is selected by default**, if present.
- Switching focus off immediately restores the full normal natal
  aspect palette without forcing a new astronomical calculation.
  It should also be possible to select another planet while focus is on.
- The mode and focus state must be explicit frontend/service inputs.
  Do not make a global skin or static renderer configuration.

### Rendering and test contract

- Keep on-screen interactions separate from headless PNG/JPEG and
  existing offline Astrolabio rendering unless an export-focus option
  is deliberately added in a future change.
- Tag existing natal aspect geometry with its originating planet pair,
  aspect type and original color so the UI can gray and restore it
  without computing another aspect graph. Preserve existing
  line/dash geometry and the original `AspettiRender` renderer.
- Add tests for light/dark neutral glyph tints, selected and related
  colors, hover-latched selection, switch defaults (Sun), both
  directions of transit focus, gray natal background, colored
  foreground and dashed radial links. Verify re-entrancy, cleanup,
  camera zoom, independent canvases, repeated redraw, keyboard/touch
  and unchanged headless output.
- **Implementation order:** (1) persistent selection and neutral-to-color
  glyph tint; (2) natal aspect gray/color focus toggle; (3) transit
  dashed radial connectors and foreground aspect overlays; (4)
  real input integration and cross-browser/skin screenshot parity.
  Mark each part complete only after actual tests. No production
  or original artwork redistribution.


### Implementation checkpoint — PR #22 (2026-11-11)

The current **draft code** adds the following; these are source changes
pending full local Angular/Chrome/Firefox execution and visual review:

- Angular `enter` handling latches selection through the existing
  `GraficoRenderService.highlightPlanet`; `leave` clears transient
  hover only, not the selected body.
- Angular natal-only **Focus aspects** checkbox; when enabled without
  a natal selection it pins **Sun**. The mode switch resets focus and
  transit mode requests a gray natal aspect background.
- `AspettiRender.renderArchi` tags only its native natal aspect lines
  by existing endpoints/type; the interactive controller tints the
  existing vertex-color buffers (and restores originals on redraw,
  mode switch and destroy), rather than recalculating aspects.
- The controller colors selected and related glyph materials from
  `Colori.elementiCelesti` while keeping unrelated materials at their
  skin-defined neutral tint. Natal-only focus can discover related
  natal planets directly from those existing aspect tags.
- A transient `THREE.LineDashedMaterial` radial connector runs from
  the existing central aspect-ring direction toward the outer
  transit radius; geometry is disposed with other focus overlays.
- A purely generated Three.js probe
  (`tests/fixtures/planet-focus-style-harness.ts`) checks the palette,
  natal muted/focused/all transitions, partner coloring, dashed links
  and material/geometry cleanup; Playwright wires it into
  `npm run test:demo-interactions`. The browser test also exercises
  the natal focus toggle and the Sun default.

**Not finished / not certified:** true double-layer gray-under-color
aspect rendering for all natal aspect styles, tuned spoke endpoints
and dash lengths in crowded outer transit rings, parity across all
seven skins and older options, touch/keyboard screen-reader acceptance,
original artwork screenshot comparison, full repo/build/browser run
and host integration with actual precomputed aspects. The older
`setCrossChartAspects` API is preserved and no underlying calculation
engine was modified.

## Overlapping glyph hit testing

On-screen pointer hit testing rejects coordinates outside the canvas rectangle,
even for captured pointers and synthetic clicks. When multiple tagged planet
glyphs overlap, it chooses the closest **projected glyph center** among hits
within 0.025 world units of the foremost ray intersection. A genuinely closer
depth plane still wins; decorative meshes remain excluded. The calculation
uses current world/camera transforms so zoom, redraw and austral inversion are
respected. `tests/fixtures/planet-picking-harness.ts` tests overlapping glyphs,
zoom, outside-canvas clicks and depth precedence using purely synthetic planes.

## Synchronous leave handlers

Both canvas `pointerleave` and switching hover between adjacent planets now
clear the previous hover state before invoking a frontend `leave` callback.
If the Angular host synchronously calls `setCrossChartAspects` in that callback,
the controller does not emit a stale `update` for a planet already left.
The overlapping-glyph browser fixture explicitly exercises this re-entrancy.

### Windows 11 local check: signed-zero geometry regression (2026-11-11)

The owner ran `npm run test:planet-interactions` on Windows 11 with
Node 22.18: natal/transit identity and relation tests **passed (2/3)**;
the cardinal circle endpoint test failed because an exact 0° angle
returned `{x:-0,y:1.25}` instead of `{x:0,y:1.25}`. This is a
JavaScript `-0` equality/snapshot representation issue, not
displacement of the displayed aspect line. The same owner run showed
`npm run check:types` and `npm run build:demo` **passed**; Angular
warned only about the existing CommonJS `moment-timezone` import.

The geometry helper now normalizes a mathematically exact zero
x-coordinate to positive zero, without altering nonzero angles.
The existing Node test covers input `0` and now also `-0`.
Seven focused geometry assertions passed when running the exact
extracted helper body in a JS isolate. **The complete local Node test
has not yet been rerun on this corrected branch.** Next: owner should
update the PR branch and rerun `npm run test:planet-interactions`,
then `npm run test:demo-interactions` with asset/demo servers running.

## Replacing a chart during pointer transitions

Pointer hover now remembers the scene used to resolve the current raycast.
If a synchronous frontend `leave` callback replaces or destroys that
scene, the old pointer hit is discarded and no `enter` is emitted for an
obsolete glyph. The same guard prevents redraw work after an `enter`
callback swaps scenes. A subsequent pointer move resolves against the
replacement scene normally. `tests/fixtures/planet-scene-switch-harness.ts`
covers the leave-triggered swap, subsequent new-scene hover and detached
scene teardown without relying on private chart data or image assets.
