# Independent Angular renderer demo

The Angular workspace contains an application that imports the library's actual `GraficoRenderService`. It uses deterministic illustrative data created in `demo/fixtures.ts`, not birth data or calculated ephemerides. No VirgoStars checkout, account, backend, AWS credentials, or original artwork is needed for the synthetic mode. The generated checkerboards intentionally do not represent the actual symbols.

## Start with synthetic assets

Requirements: Node 22.18 or another version supported by the package, npm and access to this private repository. From the repository root:

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

## Local verification

With both servers running, install Chrome/Chromium and set `CHROME_PATH` to its executable if it is not in a standard location, then:

```sh
npm run test:demo
```

### One-command local latitude test

For a **manual** run that starts both servers, generates the synthetic pack if absent, executes the focused Playwright PNG test and shuts down only the processes it started:

```powershell
npm ci
npm run test:latitude:local
```

This works in PowerShell or a compatible terminal on Windows/macOS/Linux. The runner checks that ports **4177 and 4200** are free and refuses to interfere with other processes using them; stop any manually running demo servers first. It also confirms the HTTP responses identify the **Astrological Charts asset preview** and **Angular demo**, rather than accepting any HTTP 200 response from an unrelated service; the Playwright test still checks Angular's actual rendered status and PNG pixels. If `.local/demo-pack` exists but its manifest is missing, it fails instead of deleting or overwriting local data. It requires an installed browser (set `CHROME_PATH`, or use `CHART_TEST_BROWSER=firefox` and `FIREFOX_PATH` if appropriate). It preserves the Playwright test's exit failure status and cleans up child servers on success or failure. A dedicated browser-free regression is available as `npm run test:latitude-runner` and runs automatically in `npm run preflight`; it checks the localhost port and HTTP identity behavior using temporary Node.js servers, without downloading assets or starting Angular. It also rejects prematurely truncated HTTP replies and enforces a **3-second total request deadline** on readiness probes, preventing a server that continuously trickles bytes from blocking the local test indefinitely (the 1.5-second socket inactivity timeout remains in place). It does **not** run `npm run preflight`, `npm run build`, production data, or device tests; run those quality gates separately before any merge.

For a faster **focused check of the latitude-0° Three.js PNG regression only**, run:

```sh
npm run test:latitude-browser
```

This executes the standalone `tests/latitude-browser.test.mjs` file directly, **without name-pattern filtering**, so renaming the test cannot silently result in zero selected tests. The full `npm run test:demo` command runs the main demo/browser file **and** this standalone latitude file sequentially (`--test-concurrency=1`) to avoid competing GPU contexts. `npm run check:demo-syntax` checks both JavaScript test files independently. `npm run test:latitude-bundle` uses esbuild to bundle the actual TypeScript latitude harness and checks that its Angular/Three.js renderer and synthetic fixture imports resolve; both checks run automatically as part of the manual `npm run preflight`, without starting an HTTP server or browser. Passing these compilation/syntax checks **does not** validate WebGL pixels. The focused command checks both natal and transit latitude-zero Sun visibility and movement with a fixed natal chart; the transit control keeps the same transit ring/grid and filters only the Sun via a non-finite latitude, avoiding false positives from removing the whole transit theme; it does **not** run the 28 chart/skin combinations or other browser tests. The local asset and Angular demo servers (`npm run demo:assets` and `npm run demo`), npm dependencies and a supported Chrome/Chromium executable are required. Use `CHART_TEST_BROWSER=firefox` (or `$env:CHART_TEST_BROWSER = 'firefox'` in PowerShell) for Firefox. It writes seven diagnostic PNGs (four natal and three transit) in the ignored local browser-screenshot folder; neither screenshots nor synthetic assets are committed. Before writing the files, the regression validates each decoded PNG signature, IHDR chunk and declared 400×400 dimensions, rejecting empty, truncated or wrong-size exports across all seven captures; it then uses Sharp to decode images, validate dimensions and compare pixels. These header checks are structural guards, not full PNG integrity or pixel-rendering validation. This check detects malformed exports but is not a substitute for visual inspection. The focused regression also rejects uncaught browser JavaScript errors, failed requests and HTTP 4xx/5xx responses **from the local synthetic asset origin**; unrelated dev-server requests are intentionally not considered missing chart assets. When a test fails, its error includes the latest demo status and collected browser/asset errors, while any previously produced PNGs remain on disk for inspection. The focused test also closes its browser if creating a page fails, and limits the diagnostic status lookup to one second so an early failure is not obscured by an extra long wait. It recognizes both `Rendered` and `Rendering failed` as terminal startup states: a failed demo render is reported immediately with the status and underlying error rather than waiting for the 30-second readiness timeout. This browser regression is separate from `npm run test:latitude`, which needs no server.

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
