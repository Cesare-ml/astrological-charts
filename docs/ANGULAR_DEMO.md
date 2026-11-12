# Independent Angular renderer demo

The Angular workspace contains an application that imports the library's actual `GraficoRenderService`. It uses deterministic illustrative data created in `demo/fixtures.ts`, not birth data or calculated ephemerides. No VirgoStars checkout, account, backend, AWS credentials, or original artwork is needed for the synthetic mode. The generated checkerboards intentionally do not represent the actual symbols.

## Start with synthetic assets

Requirements: Node 22.18 or another version supported by the package, npm and a checkout of this publicly readable repository (public visibility does not grant redistribution rights). From the repository root:

```sh
npm ci
npm run demo:pack
npm run demo:assets
```

Leave the asset server running. In a second terminal:

```sh
npm run demo
```

Open `http://127.0.0.1:4200/`. The same commands work in PowerShell. `demo:pack` writes **452 generated test assets** and a SHA-256 manifest only under ignored `.local/demo-pack`. It refuses to overwrite an existing pack: to regenerate, remove that locally generated directory deliberately or generate into another empty directory with `node scripts/generate-demo-pack.mjs --out <directory>` and pass its root and manifest to the asset server. JPEG and WebP placeholders are encoded in their actual formats. None are VirgoStars assets.

Choose natal, transits, synastry or latitudes, one of the seven skins, zoom and export PNG. The service serializes its own scene-building and export operations across its instances because the legacy renderer uses shared dimensions. It awaits scene textures before rendering and reports missing assets with their URL. Direct callers of lower-level renderer functions do not use that service queue.

## Approved real asset pack

Clone the private `astrological-assets` repository next to `astrological-charts` and start the manifest-verified server from the Charts directory:

```sh
npm run demo:assets:repo
```

Then start `npm run demo` in a separate terminal. The server verifies the supplied manifest and allows only its listed, hash-matching files. The private pack contains 1,013 owner-authorized images; no font files are included. On 2026-11-10 the four demo modes and seven skins passed locally with this pack in Chromium and Firefox. This is not a comparison with an approved production baseline and does not prove all advanced options have complete assets.

The owner selected the existing `risuonatore-solare-bn.png` for the two monochrome skins. Latitude house symbols use the same white source images as the base chart, tinted by the chosen skin. Natal latitude planet markers use `_circle` images; transit markers keep their outlined-ring images. Skin-specific settings and colors remain separate from the shared artwork family.

If the asset repository is not a sibling directory, start the same server with explicit paths:

```sh
node scripts/serve-local-assets.mjs --root <assets-repo>/public/assets --manifest <assets-repo>/manifests/approved-assets.json
```

The default base is `http://127.0.0.1:4177/assets/`; change it in the UI or use the `assets` query parameter. The displayed manifest label is informational: the actual manifest is selected at server startup, not verified by the browser label. No public website is used as a fallback.

## Documentation status regression check

Run `npm run test:demo-docs` to check that demo onboarding distinguishes publicly readable renderer source from restricted artwork and does not imply redistribution permission. The same check is included in `npm run preflight`. It reads documentation only; it does not validate Angular builds, WebGL rendering, asset hashes or licensing rights.

## Release-candidate validation gate (manual, no CI)

The `preflight` command checks extraction, types, asset tooling and documentation; **it does not run the interactive browser suite or build either Angular target**. Before requesting review or merging a renderer change, record the exact branch commit SHA, Node/npm versions, asset-pack manifest version and browser versions, then run on a clean checkout:

```sh
npm ci
npm run preflight
npm run build:library
npm run build:demo
```

Alternatively, run `npm run verify:angular` after `npm ci` to execute the preflight and both Angular builds sequentially. This is a local convenience command, **not** a browser/WebGL test or a substitute for the manual Chromium/Firefox and asset-manifest checks below. It does not publish or deploy anything.

For actual Three.js rendering, generate the synthetic pack (`npm run demo:pack`) and run `npm run demo:assets` and `npm run demo` in separate terminals. In a third terminal run `npm run test:demo` in Chromium, then install the Playwright-compatible Firefox and run `CHART_TEST_BROWSER=firefox npm run test:demo` in a POSIX shell (or set `$env:CHART_TEST_BROWSER = 'firefox'` in PowerShell). Inspect the saved PNGs for all four modes and seven skins, plus keyboard focus and PNG export. Run `npm run test:offline` separately for the synthetic offline smoke test. For approved original artwork, use only the separate manifest-verified `astrological-assets` checkout; verify its hashes with the local asset server and do not commit or redistribute its files. A successful synthetic run does not establish real-artwork visual parity, scientific correctness or Astrolabio device compatibility.

Record each command as **PASS**, **FAIL** or **NOT RUN**, with its exit code and environment. Do not infer success from static inspection, a GitHub commit, or the PR mergeability indicator. Leave the PR in Draft if any required validation is unavailable or fails; no GitHub Actions, npm publishing or production deployment is implied.

## Local verification

With both servers running, install Chrome/Chromium and set `CHROME_PATH` to its executable if it is not in a standard location, then:

```sh
npm run test:demo
```

To run the same suite with the Playwright-managed Firefox (Playwright Core is pinned to 1.56.1, matching the inspected Astrolabio environment), install its browser with `npx playwright-core install firefox`, then select it. In PowerShell:

```powershell
$env:CHART_TEST_BROWSER = 'firefox'
npm run test:demo
```

On other shells use `CHART_TEST_BROWSER=firefox npm run test:demo`. `FIREFOX_PATH` can select a compatible Playwright Firefox executable explicitly. Clear `CHART_TEST_BROWSER` to return to Chromium.

For a separate offline smoke test, generate the synthetic pack as above and run `npm run test:offline`. It verifies the pack manifest first, opens a local `file://` page in Firefox with the browser context offline, and exports all four chart modes with the `astrolabio` skin. It saves PNGs under `.local/demo-pack/offline-*.png` and fails if the page attempts any HTTP(S) request. Neither Angular's dev server nor the asset HTTP server is required. This uses the generated pack rather than approved original images.

If the synthetic pack was generated in a different directory, set `CHART_DEMO_PACK` to that directory before `npm run test:offline`. The test refuses manifests not marked as synthetic.

The browser test exercises 28 combinations twice with the configured asset server, compares raw pixels between repeated runs, saves screenshots under `.local/demo-screenshots` (or `.local/demo-screenshots-firefox`), checks nonblank canvases, downloads a 1600×1600 PNG, checks a mobile resize and simulates missing images and slow textures. It also tests latitude exports with transits and the true node across all skins. The repeated-image comparison tolerates channel differences of at most two levels, and permits at most 0.01% of channels to exceed that threshold; this avoids failing over isolated browser rounding while detecting larger changes. It tests simultaneous service exports and redraw, failure recovery and cleanup of a repeating GSAP timeline. It counts WebGL texture creation/deletion calls during redraw as a lifecycle smoke check. It does **not** compare against approved production reference images, measure GPU memory, prove astrological correctness, or test real hardware. Browser WebGL output can vary by driver; saved screenshots are review artifacts, not approved visual baselines. `npm run test:demo-pack` verifies generated formats and manifest integrity without starting a browser.

With the synthetic asset server and demo running, compare every path observed across the 28 default combinations against a local reference tree without copying artwork:

```sh
npm run audit:demo-asset-coverage -- --root ../astrological-assets/public/assets
```

The command writes `.local/demo-asset-coverage.json` and returns exit code 2 when observed paths are missing. It checks exact filename casing, not hashes, permissions or visual equivalence; optional and advanced inputs can request paths that the default fixtures never observe.

To smoke-test the earlier extraction independently, keep the two local demo servers running and set `CHART_EXTRACT_DIR` to a separate checkout of the extraction branch, then run `npm run test:extraction-browser`. For example, in PowerShell: `$env:CHART_EXTRACT_DIR = '../charts-pr1-smoke'`. The harness bundles that checkout's source with the current workspace's development dependencies and exercises 28 chart/skin combinations and a 400×400 PNG at scale 1. This is a synthetic rendering smoke test, not a visual baseline, lifecycle audit or a test of scale-2 export. The extraction checkout's own locked build should be checked separately.

## Local performance probe

Start the synthetic pack and both local servers as described above, then run `npm run benchmark:demo` in another terminal. The probe launches a headless browser, renders the natal chart, and alternates the `dark` and `light` skins 30 times by default. It reports navigation-to-ready time, redraw timing percentiles, WebGL texture create/delete calls and context-loss events. It fails on page errors, HTTP errors, render failure, a missing redraw or context loss. It prints the result as JSON; use `npm run --silent benchmark:demo` when redirecting the JSON to a file.

Set `CHART_BENCH_REDRAWS` to an integer from 1 to 200 to choose the number of redraws. The browser selection and executable variables are the same as for `test:demo`: `CHART_TEST_BROWSER`, `CHROME_PATH` and `FIREFOX_PATH`. For example in PowerShell:

```powershell
$env:CHART_BENCH_REDRAWS = '100'
$env:CHART_TEST_BROWSER = 'firefox'
npm run benchmark:demo
```

The probe measures end-to-end automation time, including UI and scheduling, not just GPU rendering. It uses whatever assets the running server supplies; run the synthetic server to reproduce these figures. Texture create/delete call counts and their checkpoints are **not** a measure of GPU memory, live textures or proof that resources cannot leak. There is no performance threshold or claim of real-artwork, e-ink or device compatibility.

On 2026-11-10, with Node 22.18.0 on Windows x64, a 1200×1000 viewport and generated placeholders, 100 alternating-skin redraws produced the following observations. These single local runs are illustrative, not portable performance guarantees:

| Browser | Navigation to ready | Median redraw | 95th percentile | Texture create/delete calls | Context losses |
|---|---:|---:|---:|---:|---:|
| Chrome 157.0.8103.50, SwiftShader | 438.1 ms | 79.1 ms | 89.7 ms | 3,539 / 3,500 | 0 |
| Firefox 142.0.1, headless | 715.8 ms | 67.4 ms | 83.3 ms | 3,539 / 3,500 | 0 |

The difference between create and delete calls remained 39 at every ten-redraw checkpoint in these runs. The browser context was still open at the final checkpoint, and the counter does not establish which textures remain live. GPU memory, real assets and other hardware were not measured.

## Known limits

- The seven skins and four demo modes passed in desktop Chromium and Firefox with both generated placeholders and the owner-authorized private artwork pack. Visual fidelity against approved production baselines, e-ink and deployed Astrolabio remain untested.
- The service queue covers operations issued through `GraficoRenderService` in the same loaded library instance; direct lower-level renderer calls and runtime changes to shared skin/asset configuration remain outside that guarantee. Serialization can increase latency.
- Disposal covers completed scene geometry, materials, texture properties and registered timelines. Tests also check timeline cleanup when selected image loads fail during body, house and nested synastry construction. Disposal of all other resources in every partially constructed scene, and lifetime tests for every advanced mode, remain open.
- Repeated synthetic passes are checked in each browser separately; this is not a visual baseline against original artwork or a guarantee across browser/GPU versions.
- The `file://` offline test exercises this library's service in Firefox using a test bundle. It is not the existing Astrolabio adapter, its packaging/update process, a minimal device asset subset, e-ink conversion, or hardware.
- Build and test results must be repeated on the actual target environment. Earlier PR heads were independently checked before the ordered merges; this does not validate future consumers.

## Verification record — 2026-11-09

On Windows, Node 22.18.0 and Chrome 156.0.8078.80 with software WebGL, a fresh local Git checkout of commit `019274b` passed `npm ci`, `npm run preflight`, `npm run build`, `npm run build:demo`, `npm run demo:pack` and, with both local servers running, `npm run test:demo`. The browser run took about 6.5 seconds for 28 chart/skin cases, a 1600×1600 export, zoom, mobile resize and a simulated missing asset. Instrumentation counted 2,148 texture-creation and 2,081 deletion calls during that run. These counts are an implementation smoke check, not memory usage or proof that all resources are released. The corresponding screenshots are local ignored test artifacts, not distributed artwork or approved baselines.

A subsequent clean checkout of `cec1a55` passed the same installation, preflight, builds, synthetic-pack generation and browser suite. All 28 mode/skin screenshots matched their repeated rendering byte-for-byte at the raw pixel level in that environment. The test also forced a delayed failing skin texture, compared concurrent exports with sequential results, checked interactive line dimensions during export, verified recovery after failure and cancellation after destruction, and exercised cleanup of a repeating GSAP timeline during redraw and export. The repeated 28-case section took about 11.4 seconds and recorded 4,232 texture-create and 4,165 texture-delete calls. This is not a measurement of retained GPU memory or a production visual baseline.

The same synthetic browser suite also passed with the locally installed Playwright Firefox 142.0.1 and Playwright Core 1.56.1. An initial strict comparison found one channel differing by one level in one pixel; the test now uses the tolerance described above. This is a desktop headless software test, not an Astrolabio device, offline boot, e-ink, or hardware validation.

On a fresh local checkout of `a421969`, `npm ci`, preflight, both builds, synthetic-pack generation and the full browser suite passed again in Chromium and Firefox.

After fast-forwarding that checkout to `3fd073f`, `npm run test:offline` passed with Firefox 142.0.1: four nonblank 400×400 PNGs from verified synthetic local files, browser context offline and no HTTP(S) requests observed. The installed Astrolabio adapter and hardware were not exercised.

After fast-forwarding to `a2e3e98`, preflight, both builds, the four-case browser suite in Chromium and Firefox, and the offline test passed. The new failure-path test covers cleanup of repeating timelines when body, house or nested synastry construction is interrupted. This does not prove disposal of every resource in all failed partial scenes.

## Interactive planet focus (draft PR #22)

The local Angular demo now exposes a keyboard-accessible **Interactive planet focus** panel underneath the existing chart and asset controls. All existing modes, skins and export behavior remain present. On-screen chart symbols emit typed `enter`, `leave` and `click` events through `GraficoRenderService.setPlanetInteractionListener`. The panel shows the most recent chart event, the hovered body, and any pinned selection.

1. Select **Transits** from the chart mode dropdown; choose **Natal chart** or **Transits** in the layer dropdown.
2. Click **Saturn** in the transit layer to highlight it and the linked natal planets, then select **Uranus** in the natal layer to verify the reverse direction.
3. Hover an on-screen planet; its transient focus takes precedence over the pinned selection. When the pointer leaves the canvas, the pin is restored.
4. **Clear selection** clears only the pinned selection. Changing chart mode clears both current pin and the last pointer-event readout. Changing the skin preserves the pin.

The links in `demo/interaction-fixtures.ts` are **hand-authored, synthetic illustrative associations**, consistent with the demo's intentionally invented longitudes; neither the renderer nor the demo calculates aspects or astronomical values. Real frontends must call `setCrossChartAspects` with backend/`astrological-functions` results for the current chart; the demo does not connect to live data.

A standalone opt-in browser check is available after starting the approved/synthetic asset server and Angular demo:

```sh
npm run test:demo-interactions
```

It checks frontend selection by layer, matching synthetic relations, mode reset, and a Three.js raycaster probe for a tagged mesh including enter/click/leave and event payloads. Full Chrome/Firefox visual, accessibility, WebGL lifecycle, export parity and production consumer checks remain required before merge.

The browser interaction harness also exercises live updates of the upstream aspect array while a natal glyph stays hovered, checks the event carries the new orb/type, asserts exact central-circle overlay endpoints, and verifies that only a pinned planet stays highlighted after the pointer leaves and the host replaces its links.

In **Transits** mode, the interaction panel has a synthetic **Example transit aspect filter** with **All supplied aspects** and **Squares and oppositions only**. This filters the precomputed fixture links supplied to `setCrossChartAspects`, *not* the planetary positions or orb computation. The inspector and the canvas overlay update without rebuilding the scene; pinned selection is kept. It is a small reproducible example of how a real Angular frontend can replace aspect results from `astrological-functions` or its backend.

## Owner-requested color focus and persistent hover — implementation in progress

The 2026-11-11 reference requested a monochrome-by-skin planet wheel
until a planet is focused, persistent mouse-hover selection, colored
selected planets and aspect partners, gray natal aspects under highlighted
transit aspects, and dashed extensions toward involved outer transit
planets. The supplied screenshot is a **behavioral reference** and is
not bundled or licensed as a renderer asset.

The current draft includes these steps:

1. Choose **Transits**. Existing natal aspect lines should appear
   in neutral gray. Point at **transit Saturn** directly on the wheel:
   it becomes selected without clicking and remains selected when the
   cursor leaves. Saturn and its linked natal planets become colored;
   unrelated planet glyphs retain their original monochrome skin color.
   The focused cross-theme aspect lines appear in color, with dashed
   guides toward the outer transit ring.
2. Change the selection to a **natal** planet by hovering or pressing its
   keyboard-accessible planet button. Verify the colored links work in
   both directions and keep `natal:Sun` distinct from `transit:Sun`.
3. Choose **Natal chart** (no outer transits). The natal aspect lines
   normally retain their traditional colors. Enable **Focus aspects**:
   if nothing else was selected, **Sun** is selected automatically;
   other natal aspect lines become gray, the Sun's own natal aspects
   keep their colored type. Select another natal planet to transfer
   the highlight. Turn the switch off to restore the normal palette.
4. Change between **light** and **dark**. Confirm nonfocused planet
   symbols remain black/dark or white/light as appropriate and that
   the selected body and partners restore their colors correctly.
   Zoom, redraw and switch modes; no tint/dash should leak into a
   different chart or into PNG/JPEG exported without an explicit focus
   option.

Run `npm run test:planet-interactions`, `npm run check:types`,
`npm run build:demo`, and with the local asset and demo servers
running, `npm run test:demo-interactions`. The new browser test includes
a dedicated, purely synthetic Three.js color-and-dash probe plus the
Sun-default focus switch. It also saves four **ignored local canvas
screenshots** to `.local/demo-interaction-focus/`: transit Saturn on
light, natal Uranus with transits on light, natal Sun focus on light,
and natal Moon selection with the focus switch off (all natal aspects)
on light. Compare them manually with the owner's behavioral reference.
These local screenshots must **not** be committed or redistributed.
Actual Windows Chrome/Firefox results and pixel-level parity against
the owner's reference are **pending**.

**Remaining refinement before visual sign-off:** exact stroke widths,
line layering (draw focused natal aspects over rather than merely recolor
the existing gray geometry), dashed line endpoints relative to
collision-shifted labels, color contrast in all seven skins, tooltip
and touch workflows, and real upstream transit aspect inputs. No new
astronomical/orb computations are performed in this renderer.


## No-zoom focus and AS/DS/MC/IC acceptance

Based on the owner's manual Windows browser review, selecting or
hovering **must never enlarge** an astronomical symbol. The glyph
remains in its original location and size; tint plus highlighted
aspects communicate focus.

The demo exposes `AS`, `DS`, `MC` and `IC` alongside the
planet buttons. Their angular positions come from the chosen
`TemaRender.houses[domification]` data; they are not computed
from fixture planet longitudes. The buttons/hit glyphs can be used
to focus an angle. The demo explicitly enables native axis
aspect flags and provides one illustrative transiting link per
natal angle so the behavior can be tested even without a real
astrological backend. These are **synthetic associations**, not a
claim of astronomical accuracy.

With the demo on **Transits**, switch the layer to **Natal chart**.
Click each of `AS`, `DS`, `MC` and `IC`: the inspector should
show one synthetic semisquare aspect for each, to respectively
Neptune, Mars, Neptune and Mercury. The selected angle and related
transiting planet should change color, while the symbol size stays
unchanged. In **Natal chart**, turn on `Focus aspects` and select
`AS` to inspect its native natal planet-to-axis relations.
For real topics with no matching orb/type, no relation is drawn.
The original axis-to-axis suppression remains untouched.

The expanded browser suite also checks the **reverse direction**:
selecting **transit Mercury** must show both its existing natal
Pluto link and the synthetic natal **IC** semisquare. It writes two
additional ignored local screenshots to
`.local/demo-interaction-focus/natal-mc-transit-aspects-light.png`
and `natal-as-focused-light.png` for a human comparison of actual
angles and unchanged symbol size.

Run `npm run test:planet-interactions` and the Playwright
`npm run test:demo-interactions` suite, then inspect the chart
manually. The prior Windows 6-test suite passed; the new changes
require a separate run before claiming completion.


## Inspect double-layer natal focus rendering (draft PR #22)

In the **Natal chart** mode, with `Focus aspects` initially off,
all natal aspect lines should retain their original VirgoStars colors
and styles. Enable **Focus aspects**: the full natal aspect picture
stays softly gray, with **colored copies of only the selected Sun's
actual native aspect strokes above it**. Click another planet or one
of the four angles (AS/DS/MC/IC): the colored overlay changes, but
the underlying natal aspects remain gray. Turning the switch off
restores all original native stroke colors with no duplicate lines.
The glyphs must never enlarge.

The controller duplicates only already-rendered native lines (with
their current solid, dashed or dotted geometry). Its copies have
independent disposable geometry/material; no calculation, texture
or approved private asset is copied into the repository. The
`planet-focus-style-harness.ts` browser probe now checks this
foreground-versus-background arrangement and 30 repeat focus cycles.
Run `npm run test:demo-interactions` with both local servers on
4177/4200, then manually examine the visual results. The change
is **unverified by the owner** until those checks are rerun.



## Superseded redraws during texture loading and synchronous teardown

Fast date/time or skin changes can enqueue an updated chart while an earlier
scene is still waiting for textures. The service retains latest-generation-wins
behavior, and now **disposes and silently discards an obsolete scene even if
its texture wait rejects**. Genuine texture failures in the currently active
request still propagate normally to the host. It also checks generation,
renderer and camera availability **after** notifying an Angular `leave`
listener via `planetController.setScene(null)`, before disposing/replacing
the visible scene. If the listener destroyed the service or triggered a
newer request, the abandoned generated scene is released rather than
committed. A destroyed canvas cannot queue a stale deferred render frame.

`tests/fixtures/concurrency-harness.ts` provides two browser regressions:
an injected failure held inside the obsolete texture wait with a successful
newer queued redraw, and synchronous host destruction during a scene-swap
`leave` callback. The browser smoke suite asserts both outcomes. These
are lifecycle protections, **not** an incremental planetary-position update
API: the existing renderer still rebuilds full scenes when input positions
change. No ephemerides/aspect algorithms, approved artwork, current
production code or headless exports have been changed.

Run `npm run check:types`, `npm run build:demo`, then `npm run test:demo`
with the local manifest-validated asset server and Angular demo running
on Windows, Chromium and Firefox before merge. Local browser runtime
verification is still pending.

## Native aspect stroke regression test

The browser suite `npm run test:demo-interactions` now also bundles
`tests/fixtures/native-natal-line-harness.ts` with the real Three.js
fat-line classes. It asserts that a focused solid stroke and a
multi-segment dashed stroke preserve their exact colors/widths
above gray native lines, while a nonfocused dotted stroke stays gray.
It validates resource independence, cleanup when a new body is
selected and restoration after disabling focus. Test input is synthetic
and original VirgoStars images are never bundled.

This regression has not yet been run on the owner's Windows checkout.
After pulling the latest PR branch, restart the 4200 demo and run
`npm run test:demo-interactions`; if it reports
`native Line2 solid/dashed/dotted strokes`, that is the new test.


## Safe cleanup of partially constructed natal and latitude charts

`scene-resources.ts` centralizes the existing owner-scoped disposal policy.
Completed subgroups of a scene that fails **during async construction** now
release their Three.js geometry, materials, referenced textures and registered
animations, whether the failure occurs in the circular chart builder or in
the latitude chart builder. The service and offscreen PNG exporter call the
same helper when disposing successful/retired scenes. Object identities are
deduplicated **within a disposal pass**, so multiple child meshes sharing
a geometry/material/texture are not double-disposed. Disconnected objects
which never joined the group's tree are outside the helper's scope.

The opt-in browser smoke suite includes a synthetic shared-resource fixture:
several meshes share one geometry, one material and one texture; a separate
material and two animation registrations are also present. It checks each
owned resource is released once and an unrelated, detached mesh is untouched.
The test uses no chart artwork, user birth data or backend calls. Run
`npm run check:types`, `npm run build:demo`, and `npm run test:demo`
with the local manifest-verified asset server in Chromium and Firefox.
Any actual rendering/visual parity verdict still requires owner review.

## Transit guide positioning on the real ring

In **Transits**, highlight an outer transiting planet or a natal
planet with connected transits. Colored dashed guides should follow
the **true transit longitude** out from the central aspect circle,
not bend toward glyphs that were shifted for collision avoidance.
They should finish a small distance *before* the outer ring, keeping
transit labels legible. The guide follows the displayed hemisphere
rotation/mirroring, and the original planet symbol must not grow.

The renderer now annotates transit symbol meshes with an original
ring radius (rendering metadata only). It retains a distance-based
fallback for old hosts without this metadata. The browser test
`tests/fixtures/transit-spoke-harness.ts` checks both paths with
invented chart positions, a rotated wheel and a mirrored wheel.
Run `npm run test:planet-interactions` and
`npm run test:demo-interactions` after updating the branch and
restarting both localhost servers. These new tests have not yet
been run on the owner's Windows installation.


## Shader uniform texture cleanup in retired scenes

The owner-scoped `disposeSceneResources` helper now also releases textures
referenced by `ShaderMaterial.uniforms[name].value`. Both individual
textures and arrays of textures are supported. The existing identity
`Set` ensures the same texture referenced by multiple uniforms and a
regular material is disposed **once per cleanup pass**.

The synthetic `scene-resource-lifecycle-harness.ts` adds a real
`THREE.ShaderMaterial`, a texture referenced twice in uniforms, a
shared texture also held by a regular material and a non-texture scalar
uniform. It verifies disposal counts without loading external artwork.
Only use this helper for a scene whose assets are no longer referenced
by a live renderer. This is a new regression fixture; actual
Chromium/Firefox/Angular execution and GPU memory review remain merge gates.

## Multiple simultaneous transits and stable guide colors

In the **Transits** view, one natal planet may have links to several
outer transiting planets, while one transiting planet may also be
involved in several colored central aspect lines. The demo keeps
one dashed spoke **per outer transit planet** to avoid overlapping
dashes at identical longitudes. The guide inherits the color of its
closest-orb visible relationship (deterministic ties), independently
of input array order; the center retains **all original aspect colors**.
This is solely a presentation rule, never a calculated astrological
priority.

For manual review, choose the synthetic natal Uranus: its linked
transit Saturn and Sun must keep distinct guides. Choose transit
Saturn: both of its different natal aspects remain visible in the
center, but there is only one radial guide. The synthetic test
`transit-spoke-harness.ts` reverses multi-aspect input order and also
focuses a natal Sun linked to both Saturn and Neptune, in normal
and mirrored wheel coordinates.

The opt-in browser suite now saves
`.local/demo-interaction-focus/natal-uranus-transits-dark.png`
alongside its light-skin screenshot. Compare label legibility,
bright/dark aspect colors, unchanged symbol sizes and one-guide-
per-transit behavior. No private image files or automatic screenshot
approval are included.

## Rapid pointer movement over a pinned planet

Select a planet in the natal/transit wheel. Move the pointer away,
then back onto **the same** planet many times: the selection should
remain pinned, the aspect strokes should not flicker/reallocate, and
the planet symbol must not grow. Tooltips may still receive the
normal enter/leave events. Hover a **different** planet: its lines
must replace the pinned body's foreground while hovered, and the
pinned selection must return when the pointer leaves.

The synthetic Playwright test
`tests/fixtures/pinned-pointer-idempotence-harness.ts`
sends 30 repeated pointer enter/leave pairs and observes overlay
object identities, disposal events and render-request counts. It
also verifies that different-planet hover still triggers a repaint
and that explicitly clearing focus cleans the scene. Run
`npm run test:demo-interactions` with the local demo and approved
asset servers. This new test is draft and still awaits an owner-run
Windows/Chrome result; it is not a measured FPS benchmark.

## Angular enter-to-pin handoff (draft)

The demo automatically pins the planet during `enter`. Hover an
unselected planet: its focused colors and aspect links must appear
on that **first** hover, even when the event callback pins it
immediately. Switching between planets should not create duplicate
WebGL frames. After leaving a planet, its selection remains active.

The synthetic `hover-pin-handoff-harness.ts` browser test checks
the first paint, 20 repeated pinned hover cycles, a switch to
another planet, and deferred selection via a frontend button
while the pointer is still over a different body. On pointer
leave, the button selection must become visible. All original
planet scales and the neutral palette after clearing focus
must be preserved. Run `npm run test:demo-interactions` with
both local servers active; the new test is not yet owner-verified.

## Moving from a pinned glyph to blank canvas space

Pin a natal or transit body, then move the pointer **within the chart**
from the symbol into a blank part of the aspect circle. Its highlighted
aspects should remain visible without flicker. The frontend still
receives the normal `leave` event, but the WebGL geometry is not
destroyed or reallocated when the underlying pinned focus is the same.

Now press a button to pin a *different* body while the pointer is over
another glyph, then move into empty space: the new button selection
must become visible. The `pinned-pointer-idempotence-harness.ts`
browser fixture simulates 30 genuine canvas-leave cycles **plus 20
inner-canvas blank-space cycles** and checks that WebGL objects
retain identity and the scene has not requested redundant frames.
The Node interaction suite also exercises the blank-space edge
cases. Visual and browser acceptance of this new change is pending.

## Detached glyphs and two-chart pointer ownership

A host can remove an outer-planet symbol or move it into another
Three.js scene without reconstructing the chart controller. The
mouse must **never** select a planet whose mesh is no longer part
of the active chart, even if the target remains in the internal
raycasting cache. The live test fixture detaches a foreground
Uranus and verifies the pointer and click reach the still-visible
Moon underneath; reparenting Uranus into an unrelated scene must
also leave it unselectable on this canvas. Reattaching Uranus to the
original scene restores hover with no cache rebuild.

This is covered by the existing
`raycasting chooses the closest overlapping glyph` Playwright
case and a smaller Node regression in `test:planet-interactions`.
The change has not yet been browser-tested by the owner.

## Cross-chart scene transfer during interactive focus

This synthetic lifecycle test targets two *independent* chart scenes:
a natal Sun with two cached Saturn glyphs in chart A, and a natal
Moon in chart B. The first cached Saturn is moved from A to B,
without refreshing A's cache. Selecting natal Sun in chart A must
use the **remaining attached Saturn** for cross-chart lines and
may not recolor Saturn now owned by B. Once the other Saturn also
leaves A, selecting Sun must not create a stale transit aspect or
dashed spoke; B keeps its own color and overlays.

The Playwright test `transferred cached glyph never contaminates
other chart focus` runs the new fixture
`tests/fixtures/transferred-glyph-isolation-harness.ts` after the
normal demo readiness checks. The associated Node unit test checks
`ownsGlyph` and `activeGlyph` directly from the committed controller
source. Both tests use generated Three.js primitives only.
Run them together with existing two-canvas/50-redraw and WebGL memory
tests before approving integration.

## Shared material focus isolation between chart canvases

Two independent chart canvases can reuse one original
`THREE.MeshBasicMaterial` (and one `THREE.Texture`). Focusing a
planet in the first chart must not recolor unfocused bodies in the
second, even when those bodies share the very same underlying
material object. Focus creates temporary independent material
copies; clearing or destroying a chart restores the original
material without disposing shared textures.

The new browser fixture
`tests/fixtures/shared-material-isolation-harness.ts` checks
single- and multi-material meshes, two simultaneous chart focuses,
a focused Saturn mesh moved from A to B, and disposal order where
the previous controller clears **after** the new one highlights.
The destination must still restore the undisturbed original,
never the previous controller's disposed clone.

The Node `test:planet-interactions` suite also extracts and tests
the current private material focus methods, including partial array
replacement by a host. Run those tests with `check:types` and
`test:demo-interactions` in Chrome/Firefox before integration.
Only synthetic Three.js objects are used, without private chart
images or ephemeris data. These changes remain unverified on
the owner's Windows checkout.

## Two-canvas WebGL resource accounting

The interaction browser suite now contains
`two WebGL chart contexts retain bounded resources over
60 shared-material focus cycles`. It creates two
actual WebGL contexts, shares a synthetic 1×1 texture and
base glyph material, repeatedly focuses Sun/Moon/none
in both charts, and checks geometries, textures, shader
programs, per-chart palette isolation and disposal events.
It then destroys chart A while B is focused and verifies
that B remains unchanged before destroying B as well.

The fixture `tests/fixtures/multi-chart-gpu-focus-harness.ts`
does not request any production assets. It only observes
Three.js `renderer.info` counters and `Material.dispose`
signals; it does **not** measure VRAM bytes or FPS.
Run `npm run test:demo-interactions` after starting the
demo and approved asset server. Browser/Windows execution
is pending; passing static checks does not certify this
new stress scenario.

## Native aspect metadata duplicated on a line group and its segments

Some host renderers may annotate both a native natal aspect
`THREE.Group` and each child `Line2` with the **same**
`chartNatalAspect`. The interaction index now represents the
group exactly once. A highlighted natal planet must draw one
colored foreground per distinct native aspect on top of its
gray original, with no duplicate strokes or material leaks.

The browser suite uses
`tests/fixtures/native-natal-line-harness.ts` to test
solid/dashed/dotted segments with duplicated child tags and
40 rapid Sun/Venus focus switches. The real GPU fixture
`tests/fixtures/natal-focus-gpu-harness.ts` injects the
same duplicate metadata during 120 redraws and checks
bounded WebGL geometries and original color restoration.
The Node interaction suite covers identical parent/child tags
and separate nested relation tags through the controller's
real `setScene` method. Run all Node and browser gates;
they remain to be verified on Windows after this commit.
