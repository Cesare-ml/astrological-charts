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

Clone the publicly readable [`Cesare-ml/astrological-assets`](https://github.com/Cesare-ml/astrological-assets) repository next to `astrological-charts` and start the manifest-verified server from the Charts directory. Public visibility does not clear individual artwork for redistribution: review the asset repository's rights policy before any distribution.

```sh
npm run demo:assets:repo
```

Then start `npm run demo` in a separate terminal. The server verifies the supplied manifest and allows only its listed, hash-matching files. The separate pack contains 1,013 images listed in its SHA-256 manifest; no font files are included. Verify the checked-out pack with `npm run verify:pack` from `astrological-assets` before starting the chart demo. This integrity check does not grant redistribution rights. On 2026-11-10 the four demo modes and seven skins passed locally with this pack in Chromium and Firefox. This is not a comparison with an approved production baseline and does not prove all advanced options have complete assets.

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

## Opt-in owner-approved VirgoStars Astro glyph image preview

The demo now has a **Preview VirgoStars Astro glyph images** checkbox. It defaults to **off** and never loads proprietary assets unless explicitly enabled. A host-maintained private, SHA-verified staging pack with the 22 **white-alpha** masks is required. A public or synthetic-only pack **does not** contain these images; enabling the preview without correctly staged masks will cause a visible load error instead of silently replacing the artwork.

The private masks, source/rights controls, canonical paths, test command and fallback behavior are documented in [VirgoStars Astro private image preview](VIRGOSTARS_ASTRO_PRIVATE_IMAGE_PREVIEW.md). You can start the checkbox selected using `?astroGlyphs=1` only for a development run whose verified asset server has those files.

Changes to the glyph imagery are **purely visual**: natal/transit object IDs, focus events, aspects and chart calculations are unchanged; however, their end-to-end behavior **has not yet been browser-regression-tested** with this private asset pack. Test Chromium/Firefox visual parity, PNG export and disable/re-enable rollback before client integration.
