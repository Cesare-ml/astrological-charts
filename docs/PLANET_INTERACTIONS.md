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

**Input resilience:** cross-chart aspect relations may arrive from untyped JSON APIs. The relation selector ignores entries whose natal/transit/synastry endpoints are missing, malformed or use an unknown layer. This prevents a bad opposite endpoint from crashing planet hover/highlighting; valid relations retain their existing order. Upstream applications should still validate relation payloads, including types and orbs. No additional astrological calculations are performed.

**Stable live data:** `setCrossChartAspects` takes an independent snapshot of each valid precomputed relation and its `{layer,name}` endpoints in both the service and the on-screen controller. Mutating the host's original objects or an emitted hover-event payload cannot silently alter the active overlays or currently displayed aspects. The host must call `setCrossChartAspects` with new values during live time correction. Invalid links (missing endpoints, empty aspect type) are omitted without calculating astrology.

**Live aspect refresh:** when the host calls `setCrossChartAspects` and the **visible focused planet's** relationships change, the renderer updates its lines and emits `{ type: 'update', planet, aspects }` whether that planet is under the pointer **or pinned after pointer leave**. This is **not** another `enter`, and no event is sent for unchanged data, changes affecting other planets only, or when no planet is focused. The event may carry an empty `aspects` array when a pinned planet's last connection disappears; update a selected-planet details panel on `update` even if the tooltip is no longer hovered. A programmatic pin remains until cleared with `highlightPlanet(null)`.

**Behavior:** hover natal Sun shows only its supplied transit partners and temporary connector lines; hover a transit planet does the reverse. An explicit selection is retained after mouse leave. The receiver decides whether a click should pin a selection or open a detail pane. Missing links means only the selected symbol is tinted; its geometry and size remain unchanged. Planet symbols are tagged by layer when built (including synastry); raycasting checks only those meshes and never decorative rings. Hit testing follows camera zoom/resize. Scene replacement removes overlays and restores original material colors before disposal; it never changes planet scale. No extra pointer listeners in offscreen PNG/Node/Python exports.

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

**Not finished / not certified:** browser-verified pixel fidelity of
the new double-layer gray-under-color natal focus for all stroke styles,
tuned spoke endpoints
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

## Nested scene replacement safety

`setScene()` now uses a monotonic scene revision. A synchronous `leave`
callback may call `setScene()` a second time or destroy the controller;
in either case the original in-progress call must not attach an older scene.
`destroy()` invalidates outstanding revisions too. The synthetic
`planet-scene-switch-harness` verifies that the replacement requested
from inside the host callback wins over the earlier outer replacement,
and that the following pointer event targets only the winning scene.

### Windows 11 manual Playwright regression and diagnostics fix (2026-11-11)

The owner ran `npm run test:demo-interactions` on Windows with the
Angular demo and local approved-asset server active: **3 of 6 passed**.
The passed tests covered palette restoration/colored connected glyphs,
natal/transit pointer raycasting/overlay events, and overlapping glyph
hit testing. The failed tests were:

1. Frontend button selection read `None` immediately after clicking
   transit Saturn rather than awaiting the asynchronous Angular
   **zoneless** change detection cycle (`transit:Saturn`).
2. The natal `Focus aspects` switch likewise read `None` immediately
   after checking it instead of waiting for the DOM to display the
   default `natal:Sun` selection.
3. The two-canvas 50-redraw harness compared a second canvas overlay
   object captured **before** explicitly calling `highlight()` on
   that canvas. That legitimate focus call replaces the old line;
   the stale identity comparison produced `isolatedEvents:false`.

The draft now exports a completed-scene `data-render-revision` from
the demo status. The browser test waits for a *new* revision after
mode/skin changes and waits for the expected rendered selection and
aspect counts after button/toggle/filter clicks. A remaining 10-second
timeout signals a real UI regression rather than silently passing.
The lifecycle fixture now captures canvas B's overlay *after* its
intentional focus change and reports initial/continued isolation
separately. Exiting natal mode resets its natal-only `Focus aspects`
switch, matching the return-to-natal test and preserving the default
all-colored natal chart.

These are targeted changes to the demo and test timing/expectations;
the passing Three.js color, pointer and picking tests were left intact.
**The full suite has not yet been rerun by the owner after this fix**.
Use an up-to-date `feat/planet-interactions-transit-aspects-20261110`
checkout and restart `npm run demo` on port 4200 to ensure the
new `data-render-revision` attribute is served before rerunning
`npm run test:demo-interactions`. Do not merge the draft solely
because source inspection passes.


## Rendering requests after synchronous teardown

The controller checks the active scene **and its revision** after invoking frontend `leave` or `update` listeners. If the listener destroys, replaces or re-indexes the chart, the abandoned callback cannot request a render of an invalid canvas. The pointer transition also checks the revision to reject a hit computed before a same-object `setScene` re-index. The synthetic `planet-reentrant-render-harness.ts` tests these cases without real images, a WebGLRenderer or any astronomical calculations. Browser execution and GPU-memory testing are still required before merging.

## Opt-in real WebGL resource regression

`tests/fixtures/planet-gpu-lifecycle-harness.ts` constructs a genuine
`THREE.WebGLRenderer` in the browser with purely generated mesh geometry and
no artwork. It records `renderer.info.memory.geometries`, textures and
program counts, then renders **90 changed aspect relations** and **20 chart
scene replacements** while keeping a planet pinned. It expects stable GPU
geometry counts across both workloads, checks active aspect and dashed
transit spokes, verifies that clearing focus frees overlays, and requires
zero retained GPU geometries after controller and host-geometry cleanup.
This is a *browser-side WebGL accounting test*, not a byte-level GPU memory
profiler, a production screenshot baseline or proof for every driver.
Run `npm run test:demo-interactions` with the demo and approved/synthetic
asset server active in Chromium and Firefox. Failures must be investigated,
not dismissed as merely aesthetic differences.

`GraficoRenderService.ngOnDestroy()` now calls `forceContextLoss()` **after**
`dispose()` when permanently retiring an interactive canvas. Temporary
offscreen PNG export renderers do the same in their cleanup; ordinary chart
redraw and user pointer focus never force a WebGL context loss. This reduces
the risk of accumulating browser WebGL contexts during repeated component
mount/unmount and image exports, while keeping production integration gated.

### Windows visual feedback — axis aspects and scale-invariant focus (2026-11-11)

The owner confirmed the complete interactive browser suite **passed** on
Windows and that the canvas focus appears functional, but reported
two visible defects: selecting a planet enlarged it, and the four
angles AS (Ascendant), DS (Descendant), MC and IC never appeared to
contribute aspects in the demo.

**Draft corrections:**
- The on-screen controller no longer multiplies the scale of either
  selected or related glyph meshes. It changes only the glyph tint and
  focused aspect lines; the original hit geometry/positions stay fixed.
  Touch, hover and programmatic focus share the same behavior.
- The demo adds **AS, DS, MC and IC** to the accessible selection buttons.
  The four `settaggi.elementi_celesti[axis].att` and `.aspVerso`
  flags are now enabled in the demo options so the existing
  `ElementiCelestiRender.getElementiCelesti` / `AspettiRender`
  can include their **house-derived ecliptic angles** in natal
  aspect geometry and draw their established symbols as hit targets.
  No astronomical or aspect calculation is duplicated.
- Four hand-authored, clearly labeled **illustrative** cross-chart
  semisquare relationships make the demo exercise all four natal
  angles while transits are visible (AS–Neptune, DS–Mars,
  MC–Neptune, IC–Mercury). They use synthetic longitudes only,
  not a production calculation. Real hosts remain responsible for
  passing their own precomputed cross-chart relations; if no aspect
  falls within the actual configured orb, no aspect should be shown.
- The native natal aspect renderer still excludes *axis-to-axis*
  pairs under its existing rules. This change enables **planet-to-axis**
  aspects, not automatic AS–DS/MC–IC geometry.

**Regression gates:** `npm run test:planet-interactions`,
`npm run check:types`, `npm run build:demo`, and with locally
verified asset/Angular servers running,
`npm run test:demo-interactions`. The latter includes a
four-axis selection test, plus no-enlargement checks in the pointer,
50-redraw, and focus palette harnesses. Visual comparison and
the new full test run on the owner's Windows installation are pending.



## Idempotent live aspect updates

High-frequency frontend stores may deliver the same relation list repeatedly.
`PlanetInteractionController.setRelations()` now compares a validated,
defensively copied incoming snapshot with the current snapshot before
repainting. **Identical links preserve the existing overlay objects and GPU
buffers and emit no redundant hover `update` or render request.** Differences
in ordered endpoints/layers, aspect type, orb (including optional-property
presence), or list order still update. If a host adds unrecognized metadata
to a relation or endpoint, equality is conservatively disabled so event
consumers are not left with stale custom data. Astronomy, orb calculations,
chart geometry and the public setter signature are unchanged.

`tests/planet-interactions.test.mjs` covers semantic equality and changed
payload cases. The real WebGL probe additionally sends 120 repeated identical
relations and asserts unchanged active line identity, geometric resource
counts and render-request counts before resuming its changed-aspect stress
sequence. Browser validation remains a merge gate.


## Cached per-scene hit targets for frequent pointer moves

The interactive controller now indexes a flat `pickTargets` array together
with its existing layer-qualified planet lookup map during `setScene()`.
`Raycaster.intersectObjects` reuses this array without re-flattening the
planet map on every mouse movement. Projected-center comparison also reuses
a private `THREE.Vector3` scratch buffer. On scene re-index, null scene,
or destroy, the old hit-target array is released so obsolete meshes cannot
be picked or retained accidentally. Camera/world matrices are still updated
before each raycast, preserving zoom, transforms and southern-hemisphere
geometry; overlap/depth priority and the no-enlargement rule are unchanged.

The synthetic browser picking harness sends 250 alternating pointer moves
and checks that the cached array identity stays stable, then adds a new
planet to the same scene and checks `setScene` refreshes the array. It
also verifies the cache is empty after teardown. These are source/runtime
behavior checks, **not** a measured FPS improvement; profile the original
renderer and GPU usage on Windows before claiming a speedup.

### Natal aspect two-layer focus — draft implementation checkpoint (2026-11-11)

The owner confirmed that the prior Windows build/test and live
interactive demo worked with unchanged-size planetary glyphs and
clickable AS/DS/MC/IC. The next visual refinement is now committed on
the same **draft PR #22**, but is **not yet owner-tested**:

- In natal-only mode with `Focus aspects` disabled, the existing
  `AspettiRender` output stays unchanged: all traditionally colored
  aspects, with original widths, solid/dashed/dotted patterns and
  angular geometry.
- When `Focus aspects` is enabled, every native natal aspect retains
  a **muted gray background stroke**. For native aspects touching the
  selected natal planet/axis, the controller places an **independent
  foreground copy of that original colored stroke** above the gray.
  This follows the original line geometry and patterns, rather than
  generating another mathematical aspect or inventing relationships.
- A focus change, drawing rebuild or teardown removes and disposes
  those copies (their geometries and materials are not shared with the
  original stroke). Original native vertex colors are restored when
  focus switches back to `all`; no planet changes its scale or
  position. The transit view keeps the existing muted natal lines
  with its separate colored cross-theme focus overlays.
- The existing browser-host synthetic palette fixture now checks:
  native stroke remains gray beneath an independent colored copy;
  copying works for a group with child lines; focused resources emit
  exactly one dispose event on removal; and **30 focus on/off cycles**
  restore the original colors and leave no overlay objects in the
  scene. These checks run through `npm run test:demo-interactions`
  with Chrome on Windows, not through headless PNG export.

**Validation still required:** owner-run `npm run check:types`,
`npm run build:demo`, and `npm run test:demo-interactions` after
updating/restarting the branch. Inspect the natal Sun, AS and MC
screenshots with focus on and off; compare solid, dashed and dotted
lines on light/dark skins. Browser success alone does not certify
faithful original artwork or measure real GPU memory consumption.


## Idempotent focus selection and natal aspect presentation

Live frontend state may repeatedly send the **same** planet focus or identical
`'all' | 'focused' | 'muted'` natal-aspect presentation. The on-screen
`PlanetInteractionController` now compares the layer-qualified pinned planet
and current presentation before touching the Three.js overlays or requesting
another canvas render. Different layers or planets still update immediately;
`highlightPlanet(null)` clears a previously selected body but repeated clears
are harmless. Changing scenes or precomputed relationships follows its own
existing refresh path, so identical focus values never suppress a new chart
draw. This does not change mouse picking, planet geometry, the exported PNG
path or the public service API.

The browser-free unit suite executes the controller's **actual TypeScript
methods** with a render-counting probe. The opt-in real-WebGL lifecycle
regression also repeats 120 identical focus/palette calls and checks that
render counts, GPU geometry counts and live overlay identities remain unchanged.
These runtime checks do not replace visual testing in Chromium and Firefox.


## Off-focus updates from live transit data

`setRelations` retains all changed precomputed links for future selections,
but avoids rebuilding the focused overlay and emitting redundant hover
`update` events when only other planets' or axes' links change.
The visible subset is determined by the current hovered planet, otherwise
the pinned planet; its relation order, type, orb, endpoint identity, layer
and host metadata still determine repainting. Switching focus later uses
the most recently received links. No astronomical calculation or new
public setter is introduced.

Node regression checks the focused subset comparison. The opt-in
synthetic real-WebGL probe checks that repeated off-focus changes preserve
render counts and overlay object identity, while a later Moon click receives
the latest stored orbital data. Chrome/Firefox validation remains required
before merge.


## Coalesced synchronous hover repaint

The demo's pointer `enter` callback can latch focus immediately by calling
`highlightPlanet`; a `leave` callback may similarly select a different
pinned body. Previously the host callback repainted the overlay and requested
a frame, then the pointer handler repeated both operations for the same event.

The controller now increments a visual revision when rebuilding its on-screen
overlays. After a synchronous `enter`/`leave` callback, the pointer handler
repaints only if the callback did **not** already repaint. Existing scene
revision checks still stop stale events after scene replacement or destroy.
A callback that performs no visual update still gets the usual one repaint.

The synthetic re-entrant browser probe tests one render request per enter
latch and leave selection, alongside existing nested scene replacement and
teardown checks. No change to astrology, glyph locations, public API,
headless exports or external assets. Actual Chromium and Firefox runs remain
required before merging.

### Native Line2 solid/dashed/dotted regression gate (2026-11-11)

Beyond the basic synthetic geometry probe, `tests/fixtures/native-natal-line-harness.ts`
now builds actual `Line2`, `LineGeometry` and `LineMaterial` instances
using invented positions and colors. One native aspect has a solid
stroke, one groups three dash segments, and one groups four dot-like
segments. This mirrors the kinds of grouped, fat-line primitives
produced by `OggettiSempliciRender` without importing or redistributing
private graphics.

The browser suite loads this fixture in a genuine Chrome/Firefox
page and checks: two focused native aspects (four segments total)
produce independent copies; all original strokes, including unrelated
ones, are gray; all foreground copies retain their original colors,
stroke widths and transformations; copied objects have no natal
metadata or interactive hit targets; changing focus removes and
disposes the previous copies while the originals remain alive;
turning focus off restores their colors and leaves no orphan overlays.

This is a **new test**, not an already-passed Windows result. It runs
as part of `npm run test:demo-interactions` with the local demo
and asset servers active. It is deliberately separate from normal
PNG/JPEG generation; only live, on-screen interaction is affected.

### Exact transit-ring dashed guides (draft; 2026-11-11)

The owner asked for dashed lines from a highlighted central aspect
direction toward the outer transit periphery. A glyph can be shifted
by the collision-avoidance layout, so its displayed center is **not**
a reliable measure of the transit-ring radius.

The interactive drawing now stores the original
`chartTransitRingRadius` as **render-only Three.js metadata** on
transit glyphs. `PlanetInteractionController` reads it from the
transit's own ring-parent coordinate system, converts it to world
units, and follows the original `chartAspectAngle` measured from
the center of the already-rendered natal aspect circle.
The helper `chartTransitConnectorRadii` subtracts a small,
bounded clearance at the outer ring (up to 0.11 world units), so the
dashed line stops **before** the symbol/periphery instead of
covering its label. Invalid, coincident or nearly coincident rings
have no guide. Older synthetic hosts that omit the new metadata
continue using the previous glyph-distance fallback.

The path uses the scene's world matrix, including angular rotation
and southern-hemisphere mirroring. Aspect calculations, orb values,
symbol dimensions, angle selection, PNG/JPEG export and original
artwork remain unchanged. One guide is still drawn per involved
transiting body; geometry/materials are disposed when focus changes.

**New regression gates:**

- `npm run test:planet-interactions` checks positive, invalid and
  closely spaced radial spans, plus bounded ring clearance.
- `npm run test:demo-interactions` loads
  `tests/fixtures/transit-spoke-harness.ts` and checks the genuine
  dashed `THREE.Line` coordinates for **normal and mirrored** wheels,
  intentional collision-shifted glyph centers, the metadata-free
  fallback and geometry/material disposal.
- Visual acceptance remains a separate Windows/Chrome review. Check
  light/dark and dense transit rings; confirm dashes are aligned with
  original longitudes and end before transit glyphs. This is a
  **draft implementation**, not a post-change browser pass.


## Batch interactive redraws into one animation frame

`GraficoRenderService` now schedules on-screen hover, selection, natal
focus palette, cross-chart aspect and zoom repaints through a single pending
`requestAnimationFrame`. A burst of frontend calls during the same browser
turn therefore schedules **one WebGL render**, rather than one render per
setter. Individual controller methods still update their synchronous
Three.js state and emit their existing frontend events immediately; only
the canvas paint is deferred until the next frame.

Full scene builds (`disegnaScena`) and explicit `render()` calls still
render immediately, canceling any obsolete queued presentation frame.
`ngOnDestroy` cancels pending frames; callbacks check the expected renderer
and draw generation before painting, protecting canvas replacement and
reentrant teardown. Pre-initialization render requests still use the
existing deferred-initial-frame flag. Offscreen PNG/export continues to
render synchronously and is unaffected.

`tests/fixtures/interactive-frame-batch-harness.ts` uses the actual
Angular service and a browser WebGL renderer (no private images or natal
data) and asserts coalescing of zoom/focus/aspect updates, cancellation by
an explicit redraw, and cancellation on destroy. Registered in
`npm run test:demo-interactions`. The test measures **render calls**, not
FPS or GPU milliseconds. Run the suite on Chromium and Firefox with the
local manifest-verified demo servers before treating this as validated.


## Orb metadata updates without unnecessary geometry rebuilding

The live aspect controller now separates **link data changes** (including
`orb` updates for a stationary hovered or pinned planet) from **visible
geometry/tint changes**. A metadata-only update still reaches the Angular
frontend via `update`, and subsequent click events return the latest orb,
but it does not tear down/rebuild Three.js aspect lines or schedule a
redundant canvas frame when the rendered appearance is identical.

**Important:** a transit body's single dashed radial guide uses the
tightest finite absolute orb to select its color when several link types
share that transit planet. The new `sameChartAspectVisuals()` helper
therefore compares the final winning aspect **type per transit body** in
addition to the ordered endpoints/types of all links. If a changing orb
makes another aspect type win, normal WebGL redraw is required and still
happens. Unknown host fields, duplicates and changed endpoints/types/order
also conservatively trigger redraws.

Node tests cover stable-orb and winner-switch cases. The real-WebGL GPU
fixture sends 120 different orb values for a single Sun/Saturn link,
verifies unchanged line object identity, unchanged geometry counts and no
extra render calls, then clicks Sun to verify the latest orb is delivered.
This optimizes **aspect presentation metadata only**: chart planet
coordinates, houses and existing natal aspect geometry still require
the normal full `disegnaScena()` path when upstream data changes.
Browser Chromium/Firefox execution remains a release gate.

### Stable shared transit spoke color (2026-11-11)

When a selected natal body or transiting body has several *precomputed*
cross-chart aspects involving the **same transit planet**, the wheel
draws **all colored central aspect lines** but just **one dashed radial
guide for that transit body**. Earlier behavior selected the guide
color from whichever aspect appeared first in the input array. That
made a live sorting/filter operation change the spoke's color without
any astronomical change.

The guide color now uses the **tightest finite absolute orb** from
the displayed aspects involving that transit; if two orbs tie, or
both are absent/invalid, a deterministic aspect-type/endpoint-key
ordering breaks the tie. This is strictly a visual-color rule, **not
an astrological importance claim or interpretation ranking**.
The `ChartAspectRelation` data and its original ordering are
preserved for host events, tooltips and the full central diagram.
Selecting natal vs transit planets still respects their layer-qualified
identities, and every unrelated planet remains monochrome.

**Regression coverage:**
- `tests/planet-interactions.test.mjs` validates nearest orb, negative
  orbs (absolute value), missing/nonfinite orbs, deterministic ties,
  and reversed input order.
- `tests/fixtures/transit-spoke-harness.ts` verifies that one
  transit Saturn with two aspects retains the same guide color after
  a reversed input list; both central aspect colors remain visible.
  It also verifies a selected natal Sun with two different transit
  partners produces **two independent dashed guides** along their own
  original longitude directions, without resizing the glyphs.
  Normal and southern-hemisphere-mirrored charts are both covered.
- Playwright writes an additional ignored
  `.local/demo-interaction-focus/natal-uranus-transits-dark.png`
  screenshot for side-by-side visual comparison with the light skin.

These additions belong only to **draft PR #22**. Full Angular build,
Chromium/Firefox execution, and manual light/dark screenshot inspection
remain required. No ephemeris or aspect calculation was added.

## Terminal disposal of the interactive controller

`PlanetInteractionController.destroy()` is a terminal operation. After it
removes the canvas pointer handlers and disposes transient overlays, a stale
Angular callback must not reactivate the retired controller with `setScene`,
`setRelations`, `highlight` or `setNatalAspectPresentation`. Those methods
are no-ops on a disposed instance; `destroy()` itself is idempotent. A
replacement canvas creates a **new controller** through the service's normal
initialization path. This avoids revived raycast targets, incorrectly tinted
glyphs or retained GPU resources during rapid component teardown.

The existing synthetic scene-switch Playwright probe now exercises all four
late setters plus repeated destroy and checks that the retired controller
emits no events, requests no render and does not tint the new chart. This
does not replace a real Chromium/Firefox test, GPU-memory measurement or
offscreen/Astrolabio regression validation. No production code or asset
bundle is changed.


## In-place transit guide recoloring (no geometry reconstruction)

When precomputed aspect orbs change enough to change which aspect type
wins a shared transit planet's dashed spoke, the controller can now
**recolor the existing THREE.LineDashedMaterial directly**. It preserves
both dashed guide and central colored aspect Line/BufferGeometry object
identity, keeping the exact native chart positions, radial endpoints and
dash patterns. Angular still receives an immediate `update` event with
the new orb values, and the presentation scheduler requests a frame
because the visible color changed.

This optimization is restricted to an unchanged *ordered* relation
structure (same endpoint layers/names and aspect types), with no unknown
host fields, duplicated central aspect IDs, missing drawable endpoints,
or missing stale-scene guide references. Otherwise the existing full
overlay rebuild is the safe fallback. No planet coordinate/house/natal
geometry mutation, astronomical calculation or screenshot export
change is introduced.

`tests/planet-interactions.test.mjs` checks the structure guard.
`tests/fixtures/planet-gpu-lifecycle-harness.ts` verifies that the
tightest-orb aspect winner changes the dashed spoke's actual color and
requests one new WebGL frame **without** changing the spoke geometry,
material, central line identity or live geometry count. Browser
execution and owner visual review remain prerequisites to merge.

### Pinned-focus pointer fast path (draft; 2026-11-11)

When a planet is already **persistently selected**, pointer re-entry
from empty canvas and subsequent leave of that exact same planet do
**not change the visible focus**. Previously every entry/leave
recreated the overlay geometry, materials and natal aspect foreground
copies and requested another WebGL render even though the planet,
colors and related aspects were identical. This could be expensive
when the pointer passes repeatedly over a dense planet cluster.

`PlanetInteractionController.move` now skips this no-op repaint only
when there was **no previously hovered planet** and the new hovered
body is the currently pinned `{layer,name}`. The leave callback
likewise skips repaint if the departing hover is still the pinned
body. **Both events are still emitted** to the host so tooltips and
accessibility readouts can update normally. Existing scene-revision
and visual-revision guards take priority: a callback that changes the
selected body or visible relationships still repaints, and switching
from a *different* hovered planet must restore the correct selection.

Synthetic browser regression
`tests/fixtures/pinned-pointer-idempotence-harness.ts` cycles the
pointer over a pinned natal Sun **30 times**, asserting 60 enter/leave
events but no extra render request, no line disposal, unchanged
object identity, unchanged colors and no zoom. It then hovers the
other transit partner to require a *real* repaint and checks that
leaving restores the original pin; finally it clears selection and
checks all transient overlays are removed. Registered in
`npm run test:demo-interactions`.

This applies only to on-screen pointer rendering. The full Angular
build, Chrome/Firefox browser tests and real performance measurements
remain **unverified after this change**. No astronomical algorithm,
original asset or production integration is modified.
