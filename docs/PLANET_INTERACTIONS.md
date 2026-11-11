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
