# Rendering architecture

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

## Components and current coupling

- `src/public-api.ts` exports render service, models, skin manager and basic Three.js primitives.
- `GraficoRenderService` is a root Angular singleton that owns WebGL resources, canvas, camera and scene.
- Scene composition uses `CartaAstraleCreaScena`, `LatitudiniRender`, and modular ring renderers.
- Some visual configuration and dimensions are global. `GraficoRenderService` serializes scene construction and export across its instances, restores the dimensions at the start of each operation, and waits for its scene textures. Direct calls to lower-level renderer functions and concurrent changes to global configuration remain outside this protection.
- Symbols, textures and resonator images currently live outside this package in VirgoStars `public/assets/`.
- Astrolabio uses a separate headless bundling/resolution path and must be regression-tested before updates.

## Source of truth

The new repository is a collaboration workspace only until a versioned integration is approved. The live site and sold Astrolabio devices continue to depend on the original `virgo-stars` code. Never silently switch imports, publish npm releases, or ship hardware updates.


## Render-only planetary collision layout extraction (draft PR #22)

`src/lib/renderers/planet-layout.ts` now contains the **historical
two-pass 7-degree glyph collision algorithm**, independent of Angular,
Three.js and astronomical computations. `ElementiCelestiRender.ciclo`
and `getRenderPosPianeti` remain available as compatibility methods
but delegate to the shared primitive. No existing rendered chart
positions, southern-hemisphere geometry, skin or collision ordering
should change. The helper takes upstream planetary coordinates and
returns a fresh layout map, preserving the source object's values.
Use `npm run test:planet-layout` (also part of `npm run preflight`):
the regression compares the new helper against a self-contained copy
of the previous algorithm across edge cases and 200 deterministic
synthetic charts. This extraction is a **prerequisite only** for future
incremental coordinate patches; existing `disegnaScena()` still
regenerates dependent planet labels, tick lines, houses and aspects.
Moving glyph meshes alone would produce an incorrect chart.


### Shared true longitude and collision-adjusted glyph angle

`chartBodyRenderAngles()` is a pure rendering helper shared with
`layoutChartGlyphLongitudes()`. The live wheel renderer uses its
`tickDegrees` for original planet tick/leader lines and native
true-angle metadata used by focused aspect guides. Its
`glyphDisplacementDegrees` is used only to separate symbols to
prevent visual overlap; `glyphDegrees` records the combined
rendered direction for a future coordinated atomic update.
Historical floating-point expression order is retained.

The helper does not calculate ephemerides/aspects, change the
source longitude, alter scene hierarchy or glyph sizing, or enable
a partial coordinate patch yet. Run `npm run test:planet-layout`
and visual parity in Chromium/Firefox before approval.


### Per-body visual ownership without changing transforms (draft PR #22)

`ElementiCelestiRender.getAnelloElementiCelesti()` now uses its
previously unused `elGroup` as an **identity-transform owner** for
each rendered body. `elGroup.userData.chartPlanetBody` identifies
`{layer,name}` for natal/transit/synastry and the body owns its
glyph, original-longitude inner/outer leader ticks, Moon marker,
optional dodecatemore glyph and arc, plus per-body GSAP animations.
Its children have `chartBodyVisualRole` tags when applicable.

The wrapper has zero position/rotation and unit scale: the existing
visual transform operations remain on each child, including
anti-collision glyph displacement and true-angle radial leaders.
The `chartPlanet` pointer tag remains on the glyph mesh, so the
interaction controller still traverses/picks the original target.
The original transit-ring radius and aspect-angle metadata remain
unchanged. Nested per-body animations and partial geometry now get
cleaned up if `getAnelloElementiCelesti()` itself rejects.

This makes linked parts discoverable for a future coordinated
incremental coordinate update. **No live position updating** is
enabled: complex house, native-aspect and derived decoration
dependencies still require a full scene reconstruction.
`npm run test:planet-body-groups` performs source AST checks.
The synthetic transit-spoke Playwright fixture now wraps bodies
the same way and checks world-space parity for normal and
mirrored views, alongside existing radius/guide regressions.


## Fail-closed chart body ownership inspection (draft PR #22)

The wheel now records `chartBodyLayout` on each identity-transform
`chart-planet-body` group, alongside the existing layer-qualified owner
and per-part role tags. The immutable-by-convention metadata includes
the upstream coordinate name/value, collision-adjusted display value,
true tick angle and glyph displacement. It does not affect any existing
position, geometry, artwork, aspect orb or style.

`inspectChartBodyOwners(scene)` is a **read-only internal structural
gate** for future coordinated position updates. It indexes natal,
transit and synastry groups by `layer:name`; verifies identity
transforms, unique body IDs, one glyph and one true-angle inner leader,
exact matching glyph identity/true aspect angle, supported part roles,
and optional Moon ring/dodecatemore pairing. It fails closed (returns
an empty index with diagnostic issues) for any incomplete or ambiguous
group. Outer leader and extra decorations are optional because their
presence depends on the selected rendering options.

The synthetic Playwright fixture checks group completeness, normal
and mirrored world-transform preservation, different layers sharing
a planet name, duplicate owners, detached leaders, altered owner
transforms, mismatched glyph layers, stale angle metadata, unexpected
parts and non-mutating inspection. No real chart data or artwork is
needed. Run `npm run test:demo-interactions` with the existing browser
server before approving the PR.

**This inspection is not a live coordinate update API.** Even a
complete owner index does not establish that native aspect strokes,
houses, Arabic parts, aspects and extra chart dependencies can be
recomputed incrementally. Until they are coordinated and proven
equivalent, changed upstream coordinates must continue through the
full `disegnaScena()` rebuild.


The ownership metadata also stores whether the outer leader and Moon
marker were enabled by chart options, and the validator rejects
missing **or unrequested** optional parts. It checks that the
collision displacement matches the original/adjusted coordinates,
so a future updater cannot mistake stale or inconsistent metadata
for a complete visual group.

### Verify original-longitude rotation provenance (draft PR #22)

The per-body owner metadata now captures the exact **render-only**
`ascendant` and `degreesOffset` inputs, alongside upstream
`original` and collision-adjusted longitude, the true leader
`tickDegrees`, and glyph displacement. The read-only
`inspectChartBodyOwners()` rejects a group unless the stored
tick angle matches the exact legacy expression order:

```ts
75 - ascendant + 15 + original + degreesOffset
```

This guards against a subtle stale-snapshot case: modifying both a
glyph's `chartAspectAngle` and its `tickDegrees` used to make
them mutually consistent even when they no longer corresponded to
the original upstream longitude. The inspection now fails closed
with `invalid-layout` and an empty owner map; the regular renderer
continues using `chartBodyRenderAngles()` and never changes
positions, house/aspect mathematics, glyph size or visual assets.

The synthetic normal/mirrored browser fixture checks a coherently
modified tick+glyph angle, a changed rotation offset, and the
existing ownership/role cases. `tests/planet-body-groups.test.mjs`
asserts that the actual wheel renderer populates both fields.
Run `npm run test:planet-body-groups`, `npm run check:types`,
`npm run build:demo`, and `npm run test:demo-interactions`
before approving. These browser validations are not claimed to
have passed solely from committed source checks.

## Read-only coordinated coordinate change planner (draft PR #22)

`src/lib/renderers/chart-coordinate-plan.ts` introduces
`planChartCoordinateEffects(scene, completeUpstreamTargets)`, an **internal,
read-only** dependency report. It requires a complete layer-qualified
set of precomputed `longitude` values for every inspected body, then
validates the currently displayed owner groups using
`inspectChartBodyOwners()`. It additionally replays the same historical
two-pass anticollision layout **per visual wheel** and rejects stale
original/adjusted layout snapshots, duplicated or missing targets,
ambiguous body names within one wheel and unsupported coordinate modes.
It never moves a glyph, edits Three.js geometry, changes focus, or
calculates positions/orbs/aspects.

The returned `impacts` identify changes to true upstream longitude and
changes to anticollision display positions independently. This matters
because a moving natal Sun can displace a stationary nearby Moon glyph;
its Moon leader geometry still depends on the collision-shifted center,
while its true radial longitude stays the same. When any impact exists,
the current decision is always `full-rebuild`; unsafe, incomplete or
unsupported input returns `unsupported` with **zero impacts**. Only a
verified complete and unchanged coordinate set returns `unchanged`.
These decisions are about **coordinates only**: changing skins, houses,
aspects, Arabic parts or other upstream fields still requires the
existing `disegnaScena()` path.

`tests/fixtures/chart-coordinate-plan-harness.ts` exercises normal and
southern-hemisphere-mirrored synthetic natal/transit wheels, including
a moving Sun that displaces a stationary Moon, same-name planets in
different layers, no coordinate/scene mutation, and fail-closed invalid
target and stale-layout cases. Playwright registers this fixture in
`tests/demo-interactions.browser.test.mjs`. Browser runtime tests,
TypeScript build and light/dark visual regression remain required.

### Stable value snapshots across scene metadata changes

`inspectChartBodyOwners(scene)` now copies and freezes each accepted
`chartBodyLayout` value. An earlier inspection report cannot silently
change when an Angular host mutates its scene's `userData` during a
later redraw, while the scene object itself remains untouched and
editable. This distinction is intentional: the report's layout data
is immutable; its references to Three.js geometry/owner groups are
**not** deep-frozen and must be revalidated before any future action.

The synthetic normal/mirrored ownership regression mutates a source
rotation offset after a successful inspection: the earlier snapshot
retains the verified value, while a new inspection fails closed with
`invalid-layout` and no owners until the source is restored.
It also asserts `Object.isFrozen(layout)` and that the snapshot is
not the same object as `userData.chartBodyLayout`.

This is a read-only inspection hardening change, not an incremental
mesh update. Existing full-scene redraw rules, upstream longitude
values, native natal aspects, exports, artwork, WebGL resource
ownership, glyph sizes and camera transforms are unchanged. Real
browser/TypeScript tests are still required before merging PR #22.


### Headless Node regression for coordinate dependency planning

`npm run test:coordinate-plan` bundles the actual TypeScript planner and
Three.js via the existing `esbuild` dev dependency. It runs without
a browser server or proprietary assets, testing real synthetic scene
owners, two independent wheels, mirrored roots, a Sun movement that
displaces a stationary Moon, and fail-closed missing/duplicate/unknown
or nonfinite coordinates, stale metadata, unsupported latitude mode
and ambiguous same-name bodies within a single visual wheel.
It is included in `npm run preflight`. This test checks the
planner contract only; it does not certify visual rendering or a
safe partial coordinate update. Run the browser regression suite
and verify actual chart appearance before any merge.

## Interactive focus material ownership

The on-screen `PlanetInteractionController` is not the owner of
the original chart's textures or material objects. Separate chart
instances may reuse a base Three.js material, and exports must
remain unaffected by a temporary focus highlight. The controller
therefore assigns temporary **per-glyph material clones** for
focus, keeps texture references intact, restores the untouched
baselines on focus clear/redraw, and disposes only its own copies.
A weak origin mapping enables a transferred mesh to be retinted
by its new chart without keeping a disposed source clone as its
restoration target. Individual slots in multi-material meshes
must be restored only when still owned by that controller.

This contract applies only to interactive focus, not arbitrary
shared mutable scene or buffer geometry. Host services still own
scene construction/disposal, and this PR cannot be treated as an
automatic VirgoStars/Astrolabio production rollout. Regression
tests: `test:planet-interactions`, `test:demo-interactions`
(shared-material fixture), plus real WebGL memory inspection.

### Prototype-safe wheel coordinate previews

The read-only `planChartCoordinateEffects()` uses prototype-free
temporary input dictionaries while replaying the legacy collision
algorithm. A body actually named `__proto__` is explicitly rejected
with `unsafe-wheel-name:layer:__proto__`: the historical
`layoutChartGlyphLongitudes()` writes results to an ordinary
JavaScript object, where that key changes the object's prototype
instead of creating a normal named planet property.

Rejecting this ambiguous input is safer than returning a partial
impact report. All valid historical planet/axis names and rendered
geometry are unchanged; the patch neither changes nor replaces the
legacy glyph-layout helper. Both the headless Node coordinate-plan
regression and the normal/southern-mirrored browser fixture test the
failure, untouched geometry, and successful planning after restoring
the original Sun identity. The browser fixture still requires an
actual Chromium/Firefox run before merge.


### Reject mixed visual-wheel origins before planning coordinate changes

Even if every `chart-planet-body` owner passes its individual metadata
inspection, the parent Three.js group is not automatically a valid
collision ring. The original wheel renderer creates one ring at a time,
with one `natal`/`transit`/`synastry` layer, ascendant, degree
offset and outer-leader option. Cross-scene reparenting or inconsistent
host options can violate these shared invariants without changing any
individual body's true angle.

The read-only coordinate planner now rejects such groups with
`mixed-wheel-layers`, `mixed-wheel-orientation` or
`mixed-wheel-leader-mode`, with zero returned impacts. This guard is
applied before accepting the ring's previous or proposed layout, even
when every body has a different name. Existing protection for unsafe
property keys and duplicate names remains intact. New synthetic Node
and normal/mirrored browser tests cover mixed wheels and restoration.
The live renderer still rebuilds the scene on coordinate changes;
this patch does not perform partial geometry updates.

### Immutable coordinate-effect reports (draft PR #22)

`planChartCoordinateEffects(scene, targets)` returns a diagnostic
**value snapshot**, not a command for editing Three.js objects.
Its `unchanged`, `full-rebuild`, and `unsupported` reports
now freeze the report itself and the impact/issue arrays. Each impact
also freezes its copied layer-qualified planet reference and
`affectedVisuals` dependency list. No Three.js scene object,
texture, geometry or input `targets` is frozen or mutated.

A consumer cannot accidentally insert an invented dependency,
change a verified longitude, or erase a fail-closed issue from an
already published report. To reflect new ephemerides, houses,
styles or renderer state, request a fresh report; **even a clean
coordinate report does not authorize a partial live update**.

The headless Node regression checks all three decisions,
input isolation and attempted mutations in normal/mirrored
synthetic scenes; the existing Playwright fixture verifies frozen
nested reports in both views. Run `npm run test:coordinate-plan`,
`npm run check:types`, and `npm run test:demo-interactions`
before PR approval. Real browser/Angular/visual validation is
not implied by the source-level checks.


### Per-ring provenance across same-layer reparenting

A group's validated layer, ascendant and tick angle are not sufficient
to establish original **collision-ring ownership**. Two otherwise
identical natal rings can have different members and therefore different
glyph displacement results. `ElementiCelestiRender` now records the
original wheel `THREE.Group.uuid` as `chartBodyLayout.ringId` on every
per-body owner. The read-only `inspectChartBodyOwners()` requires
`owner.group.parent.uuid` to match the captured ID and refuses
moved/cloned owners with `mismatched-ring-owner`, even if every other
render parameter matches. The captured value becomes part of the
value-only immutable layout inspection snapshot.

This adds no actual rendering changes and does not use UUIDs as
astronomical identifiers or substitute for `layer:name` keys.
The lifetime of a wheel group defines the provenance; wrapping or
moving the *entire wheel* in a different chart preserves the internal
ring identity and is still allowed. The body-owner fixture and
headless coordinate-planner Node suite now cover same-layer
reparenting (both normal and mirrored), restoration, and a corrupted
layout attempt. The browser planner fixture checks the same failure.
The preview still never mutates a scene or performs partial updates.


Moving the full ring group below a new outer scene wrapper keeps the
same per-body `ringId` and remains valid. Only changing a body's
*immediate wheel parent* invalidates the provenance. The Node and
browser synthetic tests check both directions, so the safety gate
does not accidentally reject normal chart container composition.
