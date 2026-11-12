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

### Preserve tie-break input order independently of scene traversal

The legacy two-pass seven-degree collision algorithm uses stable input
enumeration order to break ties between bodies at **identical** original
longitudes. A host can reorder a wheel's `THREE.Group.children`
without changing its `uuid` or individual body owner snapshots.
Using the new scene child order to reconstruct an old or proposed
layout would silently change the winner of an equal-longitude tie.

`ElementiCelestiRender` now records the actual `for...in` body
enumeration as `chartBodySourceOrder` on each original visual ring
after calculating its display layout. The **read-only**
`planChartCoordinateEffects()` replays both previous and proposed
collision layouts in that saved order, regardless of subsequent
Three.js child reordering. Absent, duplicated, incomplete or foreign
names fail closed with `invalid-wheel-source-order` and no impacts.
The metadata is a rendering-only list, not an ephemeris or an
astrological sorting rule.

Node and synthetic normal/southern-mirrored browser regressions use
**exactly coincident Sun/Moon longitudes**, reorder an existing
owner within the same wheel, compare unchanged/changed reports,
reject corrupted source-order metadata and verify recovery.
The actual wheel renderer is source-checked for population of the
metadata. **Impact records use the same saved order**: two scenes with
identical longitudes produce the same ordered report even if their
Three.js children have been reordered. The synthetic-only atomic
coordinate experiment also supplies this original source order in its
fixture (a missing order must fail safely, not bypass the planner).
No glyph transform, native aspect geometry, asset, house calculation,
production component or live incremental patch changes.
The usual `npm run test:coordinate-plan`, `npm run test:coordinate-isolated`,
typecheck, Angular build and Chromium/Firefox visual gates remain
mandatory before merge.


### Synthetic-only atomic glyph/leader coordinate transform experiment

`src/lib/renderers/chart-coordinate-isolated-preview.ts` contains the
**internal** experimental `applyIsolatedCoordinatePreview()`: unlike the
read-only dependency planner, it can actually rotate a symbol and its
inner/outer leader lines in place, update the true aspect angle and
replace the ring layout metadata **as one prevalidated transaction**.
The entire scene must be marked `chartSyntheticIsolatedWheel=true`
and contain *only* the indexed per-body wrappers, glyphs and leader
lines. This marker is an explicit test harness opt-in, **not** an
authorization to update a real chart.

It uses the existing `planChartCoordinateEffects()` and owner inspector,
rejects any unknown visual, native aspect annotation, aspect-radius
ring, missing origin marker, out-of-date symbol center or leader angle,
extra Moon/dodecatemore parts, or changed *collision displacement*
(which would require rewriting leader line geometry). It stages and
validates **all** bodies before any mutation, retaining existing
geometry/material identities; on a failed application it restores
transforms and metadata. Normal and mirrored groups use local polar
angles so they remain consistent with their parent transforms.

New `npm run test:coordinate-isolated` executes real Three.js/TypeScript
logic in headless Node using only the existing esbuild dependency. Tests
cover two real synthetic bodies with inner and optional outer leaders,
normal/mirrored wheel, idempotence, unchanged geometry/material,
unmarked/native/stray visual rejection, collision-neighbor rejection,
stale leader/symbol safety and preflight atomicity. This code is **not
wired** into `GraficoRenderService` or public APIs. In real charts,
native aspects, houses, styling, decorations and interaction controllers
still require a complete `disegnaScena()` rebuild when positions change.


The synthetic isolated transform also has a real-browser WebGL
regression fixture (`tests/fixtures/chart-isolated-preview-harness.ts`)
registered in `test:demo-interactions`. For both normal and mirrored
wheel roots it renders a glyph and its leader lines, applies the
transaction, checks the previous and next world-space positions,
unchanged geometry identity/GPU resource counts, raycasts the new
glyph location, checks idempotence, and verifies fail-closed behavior
when a native aspect ring appears. The transaction now also requires
true `THREE.Line` objects with drawable position geometry and
unscaled/untranslated leader transforms; mere role metadata is
insufficient. These are **unexecuted browser regression gates**
until run locally by the owner.


The headless Node suite also forces a synthetic write exception after
the first body has been transformed and verifies that its glyph
position, inner/outer leader rotations, aspect-angle metadata and
layout object are fully restored. A fake Object3D that carries the
correct leader role but no drawable line geometry must be rejected
before any transaction begins.


### Whole-wheel geometry preflight for synthetic atomic changes

A coordinate impact report lists only bodies whose original longitude or
collision-adjusted placement changes. However, an apparently stationary
body can already have stale geometry because host code moved its glyph or
leader without updating its layout metadata. The **synthetic-only**
`applyIsolatedCoordinatePreview()` therefore validates the existing
symbol position and both optional leader transforms for **every inspected
body** before applying any impacted transform, not just members of
`plan.impacts`. Unchanged bodies remain untouched.

This fails closed with `stale-glyph-geometry` or
`stale-leader-geometry` before any mutation. The headless Node test
covers unchanged Moon / moving Sun with injected stale glyph and leader
data, successful recovery, and normal/mirrored roots. The WebGL browser
fixture also checks that an altered stationary Moon blocks the next Sun
update. The browser fixture now explicitly records
`chartBodySourceOrder`, matching the real wheel's collision provenance.

This remains an internal experiment gated by
`chartSyntheticIsolatedWheel=true`; real charts still require their
complete render path and this change is **not** production integration.
Run the actual Node/Angular/browser suites before accepting the draft.


### Zero-impact preview still validates all glyph and leader geometry

`planChartCoordinateEffects()` reports whether upstream longitudes
and collision positions changed; it cannot establish whether a host
altered a Three.js glyph position, leader rotation or line geometry
outside the renderer. The synthetic-only
`applyIsolatedCoordinatePreview()` therefore **does not return
`unchanged` until the entire isolated wheel passes the same glyph
and leader preflight used before a real coordinate transaction**.
A stale stationary glyph, stale line angle or missing line position
attribute returns `rejected` with no geometry or metadata mutation,
even if every requested longitude is unchanged.

The headless Node regression checks normal/mirrored roots, missing
leader buffer attribute, failure recovery and untouched inputs. The
registered WebGL fixture checks stale Moon on both an actual Sun
update and a zero-impact repeat. This does not enable changed
collision geometry or authorize updates to actual charts, which
still follow the complete redraw path. Node, TypeScript and
Chromium/Firefox execution remain mandatory acceptance gates.


### Collision-changing synthetic leader geometry (experimental)

The synthetic-only transaction can now rebuild the endpoint of a known
leader **in-place** when a close neighbor changes the 7-degree
anti-collision displacement. A line must opt in via
`chartIsolatedLeaderSpec={anchorY,trim}` and carry exclusively a
unique, unindexed, two-point position `THREE.BufferAttribute`.
Before editing, the transaction rederives the old endpoint using the
historical shortening formula, compares it with the actual BufferGeometry,
verifies the geometry is **not shared**, and stages the new endpoint and
old bounds. It then commits leader endpoints, leader rotations, glyph
centers, true aspect angles and layout provenance as one operation,
restoring position attributes and bounds on failure. Scene-owned native
aspects, houses, untagged real leader geometry, nonfinite specs and
decorations remain unsupported and rejected.

Headless synthetic Node cases cover moving neighboring glyphs while
their actual source longitudes remain fixed, unchanged geometry object
identities, stale endpoint and shared geometry refusal, repeated no-op,
and rollback after the second planet fails. This does not remove the
need to regenerate **actual** native aspect/house geometries; the
Angular `GraficoRenderService` remains on full-scene redraw.


The real-WebGL browser probe also renders a second, synthetic close
Sun/Moon pair with source longitudes 10°/11° and moves only the Sun to
5°. This changes the *stationary* Moon's anticollision offset from 6°
to 1°. It asserts that both Moon leader endpoint buffers change without
replacing the THREE.BufferGeometry objects, that the Moon's true
longitude and aspect direction are retained, and that WebGL geometry
counts do not grow. New-position raycasting and repeated no-op checks
run for both normal and mirrored wheel roots. Browser execution is
still an owner-run gate, not a claimed successful test.


### Profiled leader endpoint validation on unchanged synthetic wheels

A `chartIsolatedLeaderSpec` opted-in line used to have its actual
BufferGeometry endpoints checked only if the proposed collision
displacement changed. An altered **stationary** leader could therefore
pass a zero-impact `unchanged` result or allow a different planet
to move against an already invalid ring. The synthetic-only preflight
now validates the saved shortened endpoint, anchor, finite vertex
values and profile shape whenever a line carries that spec, even if
its displacement is unchanged. A line without the spec remains
supported for rotation-only updates, but is still refused if its
collision displacement changes.

Only genuinely changed endpoints are staged or written; shared
geometry remains rejected when a write would occur. Normal/mirrored
Node regression tests cover stale stationary Moon endpoints, malformed
profiles, rejection without partial Sun movement, recovery and valid
rotation. The synthetic WebGL fixture also alters a previously patched
Moon endpoint during a no-op and checks rejection and restoration.
No production geometry, lunar decoration, natal aspect, house,
export or public API contract changes. Full Node/browser execution
remains required before approval.


### Synthetic collision geometry: independent BufferAttribute ownership

Two `THREE.BufferGeometry` instances can reference the **same**
`THREE.BufferAttribute` for vertex positions. Merely checking that a
leader's geometry object is referenced once does not prevent an atomic
vertex write from changing a different line's (or glyph's) positions.

The synthetic-only collision transaction now counts both geometry
owners **and actual position attribute owners** across the isolated
scene before changing a collision-offset-dependent endpoint. It
rejects a shared position attribute with
`shared-leader-attribute:layer:name` and zero modifications. A
profiled but unchanged leader still undergoes endpoint validation,
while a legitimate unchanged shared attribute is never rewritten.
This is an explicit ownership gate, not a new geometry-sharing policy
for the ordinary Angular renderer.

Node tests use independent inner/outer leader geometries intentionally
pointing at one common position attribute; both normal and mirrored
scenes reject the write, preserve all original coordinates, and
recover after restoring separate attributes. The registered WebGL
fixture verifies rejection and subsequent successful collision patch
under the same conditions. No changes to actual chart artwork,
production scenes or chart public APIs; real local/browser test
execution remains required before merging PR #22.


### Synthetic collision buffers: shared typed-array storage guard

Two independently constructed `THREE.BufferAttribute` instances can
hold different typed-array views onto the **same underlying
`ArrayBuffer`**. Checking only `THREE.BufferGeometry` and
`THREE.BufferAttribute` object identities misses this alias:
writing a leader endpoint could silently modify another line or even
an unrelated geometry attribute backed by those bytes.

For opt-in synthetic collision updates,
`applyIsolatedCoordinatePreview()` now counts the backing buffer of
every recognized `BufferAttribute` or `InterleavedBufferAttribute`
in the isolated scene. A proposed endpoint write requires exclusive
ownership of its position attribute's backing buffer in addition to
unique geometry and attribute identity. Otherwise the report rejects
with `shared-leader-storage:layer:name`, before any mutation.
Conservatively rejecting *any* shared backing buffer avoids needing
fragile offset/byte-range overlap assumptions. A no-op does not
modify shared storage and remains supported.

Node and registered WebGL regressions use **different** geometry
objects, `BufferAttribute` instances and `Float32Array` views sharing
a single buffer, for normal and mirrored rings. They confirm
fail-closed behavior, no partial glyph/leader edits and successful
recovery once the separate buffer is restored. This does not change
the source astronomical data, production renderer, public interfaces
or asset ownership. Full Node, Angular and Chrome/Firefox checks remain
required before integrating PR #22.


### Synthetic collision geometry: bounding-volume cache consistency and rollback

Three.js lazily caches both `BufferGeometry.boundingSphere` and
`BufferGeometry.boundingBox`. A collision-offset update that rewrites
two leader vertices but refreshes only `boundingSphere` can leave
an **existing** `boundingBox` stale, affecting downstream geometry
queries. An earlier rollback also replaced the sphere cache with an
equivalent clone, breaking existing external references to that object.

The synthetic-only transaction now snapshots the **original cache
references and cloned values** before any change. After a vertex write
it recomputes `boundingSphere`, and `boundingBox` **only if one was
already present** (preserving lazy allocation). On transactional
failure it restores the old vertices and assigns the original
bounding-cache objects, copying their saved contents back so other
owners retaining those references see the original bounds. Null
cached bounds stay null on rollback.

Normal and mirrored synthetic Node regressions force a metadata-write
exception after the collision geometry has changed, then assert
original vertex values, sphere/box object identities and values,
successful recovery, accurate refreshed cached boxes and preserved
lazy boxes. The WebGL fixture checks refreshed Moon inner line bounds,
stable cache identities and a still-null optional outer box after a
successful collision update. These remain **unexecuted full-suite
gates** pending a clean local Three.js/Angular checkout and browser
validation. Native VirgoStars scenes, aspects, house geometries,
public APIs, image assets and exports are not changed.


### Multiple synthetic chart roots: explicit readonly peer ownership

A synthetic transaction normally scans only its target scene for shared
`THREE.BufferGeometry`, position `BufferAttribute` and typed-array
backing storage. If a second chart shares the same backing memory, a
target-scene-only scan cannot establish exclusivity and might edit
both charts unintentionally. This matters especially when two wheels
display the same layer-qualified Sun/Moon names.

The **internal**, synthetic-only
`applyIsolatedCoordinatePreview(root,targets,peerRoots?)` optionally
accepts an explicit readonly array of other synthetic chart roots.
It rejects non-array, duplicate, self-referential, nested or
unmarked peer roots. The preflight counts geometry, attribute and
backing-buffer references **across all declared roots** before writing
anything, but validates and updates coordinates **only inside the
first `root`**. A shared cross-chart resource fails closed through
the existing `shared-leader-geometry`,
`shared-leader-attribute`, or `shared-leader-storage` reasons.
Peer meshes, geometry, layout snapshots and bounding caches are
never staged, mutated or disposed.

The Node regression uses two separate synthetic scenes with identical
planet identities; it checks isolated sequential updates, repeated
no-ops, exact peer geometry/layout preservation, all three cross-root
alias types, invalid root-set rejection and recovery after removing
an alias. The existing WebGL fixture keeps both synthetic scenes
mounted to the same renderer and checks the target update does not
alter the other scene, plus external backing-buffer rejection.
The caller must supply all relevant peer roots: **omitted or unknown
peers cannot be proven isolated by this experiment**. It is not
connected to the Angular/production updater and does not replace
multi-chart Chromium/Firefox or GPU ownership tests.


### Cross-chart `THREE.Points` geometry ownership

`THREE.Points` inherits from `Object3D` directly rather than from
`THREE.Mesh` or `THREE.Line`. A foreign synthetic chart might use
point-cloud geometry that references the *same* position attribute or
backing typed-array storage as a target wheel's collision leader.
Restricting peer ownership traversal to meshes and lines therefore
missed an entire valid Three.js drawable category.

The synthetic-only ownership scanner now includes `THREE.Points`
in its geometry, attribute and backing-buffer counts across the
target and explicitly supplied peer roots. A collision write fails
closed with the existing shared-geometry / shared-attribute /
shared-storage diagnostic before any mutation when a peer point
cloud aliases a leader. Point clouds are **not** authorized as
extra decorations in the target wheel, which still accepts only
its explicit synthetic glyph/leader roles.

Normal and mirrored Node regressions test both a peer `Points`
instance referencing the exact leader geometry and an independent
`Points` geometry with a distinct typed-array view sharing the
leader buffer. The WebGL fixture also mounts a foreign point cloud
during a collision patch, verifies rejection, removes the alias,
and confirms the later normal transaction is unchanged in scope.
Real multi-chart Angular and browser execution remain manual gates.


### Repeated two-chart synthetic WebGL stability regression

The existing real-WebGL fixture for the isolated coordinate experiment
now reuses the same renderer with **two separate mounted synthetic
chart scenes**. It alternates 32 longitude updates between a
collision-prone Sun/Moon wheel and a distant-body wheel while retaining
an explicit readonly peer-root set. Each update must apply exactly
once; an immediate duplicate request must be a no-op. After each
round both scenes render, the other chart's glyph positions,
line-buffer vertices and layout object references must remain
unchanged. The test also holds the `WebGLRenderer.info.memory`
geometry and texture counts and the compiled-program count at their
previously warmed baselines, and checks stable initial glyph
geometry/material ownership. The final check injects a second-body
metadata assignment fault, confirms the collision leader's vertices
and peer glyphs are rolled back, and verifies that a retry succeeds
without a GPU resource increase.

A separate Node regression performs **48 alternating operations**,
covering normal/southern-mirrored wheels, full per-body
geometry/material/BufferAttribute identity, exact peer-state
preservation, deliberate mid-transaction rollback, immediate
idempotence, and return to the original coordinates after 24
operations per scene. All fixtures contain synthetic planet names and
procedural geometry only. This is a shared-renderer/multiple-scene
regression, not a claim of independent multi-canvas performance or
of production Angular lifecycle correctness. Actual Node, TypeScript,
Chromium/Firefox, GPU and human screenshot validation remains required
before accepting PR #22.


### Coordinate planner rejects arithmetic overflow before synthetic geometry updates

`planChartCoordinateEffects()` already rejects nonfinite **input**
longitudes and wheel metadata, but a finite upstream longitude may
still overflow the legacy render-angle expression once added to a
finite ascendant and degree offset. An impact with nonfinite
`tickDegrees`, `glyphDegrees` or displacement would be unsafe for
any Three.js geometry transaction even though each source field
individually passed the type and finiteness checks.

After computing original and next `chartBodyRenderAngles()`, the
planner now verifies all six angle values **and their radian
conversions** are finite. A failed check reports
`nonfinite-render-angles:layer:name` with the existing immutable
`unsupported` / empty-impact result. This is a reject-only
safety check; it does not clamp, wrap, approximate or compute
astronomical values, and ordinary finite valid coordinates retain
their previous behavior.

Normal and mirrored Node and browser-planner fixtures supply finite
but extreme `Number.MAX_VALUE` input with an otherwise
self-consistent wheel orientation, verify rejection without moving
any glyph, then restore the original layouts and verify a valid
unchanged report. These tests require actual local Node and browser
execution before acceptance; no changes are made to the production
renderer or released public API.
