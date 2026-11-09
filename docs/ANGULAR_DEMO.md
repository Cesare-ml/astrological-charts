# Independent Angular renderer demo

The draft branch `feat/verified-asset-preview` contains an Angular application that imports the library's actual `GraficoRenderService`. It uses deterministic illustrative data created in `demo/fixtures.ts`, not birth data or calculated ephemerides. No VirgoStars checkout, account, backend, AWS credentials, or original artwork is needed for the synthetic mode. The generated checkerboards intentionally do not represent the actual symbols.

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

Open `http://127.0.0.1:4200/`. The same commands work in PowerShell. `demo:pack` writes **392 generated test assets** and a SHA-256 manifest only under ignored `.local/demo-pack`. It refuses to overwrite an existing pack: to regenerate, remove that locally generated directory deliberately or generate into another empty directory with `node scripts/generate-demo-pack.mjs --out <directory>` and pass its root and manifest to the asset server. JPEG and WebP placeholders are encoded in their actual formats. None are VirgoStars assets.

Choose natal, transits, synastry or latitudes, one of the seven skins, zoom and export PNG. The service serializes its own scene-building and export operations across its instances because the legacy renderer uses shared dimensions. It awaits scene textures before rendering and reports missing assets with their URL. Direct callers of lower-level renderer functions do not use that service queue.

## Approved real asset pack

After the owner has reviewed and imported a complete pack into a sibling `astrological-assets` checkout, start the same server with:

```sh
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets --manifest ../astrological-assets/manifests/approved-assets.json
```

Then start `npm run demo` in a separate terminal. The server verifies the supplied manifest and allows only its listed, hash-matching files. The current real pack is **not available**: pending candidates are not permission to distribute. Partial approved packs may not contain all assets requested by every skin and mode. The unresolved `risuonatore-solare-bianco.png` reference requires human review; the synthetic file of that name does not resolve the production mismatch.

The default base is `http://127.0.0.1:4177/assets/`; change it in the UI or use the `assets` query parameter. The displayed manifest label is informational: the actual manifest is selected at server startup, not verified by the browser label. No public website is used as a fallback.

## Local verification

With both servers running, install Chrome/Chromium and set `CHROME_PATH` to its executable if it is not in a standard location, then:

```sh
npm run test:demo
```

The browser test exercises 28 combinations twice, compares raw pixels between the two synthetic runs, saves screenshots under `.local/demo-screenshots`, checks nonblank canvases, downloads a 1600×1600 PNG, checks a mobile resize and simulates missing images and slow textures. It tests simultaneous service exports and redraw, failure recovery and cleanup of a repeating GSAP timeline. It counts WebGL texture creation/deletion calls during redraw as a lifecycle smoke check. It does **not** compare against approved production reference images, measure GPU memory, prove astrological correctness, or test real hardware. Chrome software WebGL output can vary by driver; saved screenshots are review artifacts, not approved visual baselines. `npm run test:demo-pack` verifies generated formats and manifest integrity without starting a browser.

## Known limits

- The seven skins and four modes passed only with the generated placeholder pack. Real artwork, visual fidelity, Firefox, e-ink and deployed Astrolabio remain untested.
- The service queue covers operations issued through `GraficoRenderService` in the same loaded library instance; direct lower-level renderer calls and runtime changes to shared skin/asset configuration remain outside that guarantee. Serialization can increase latency.
- Disposal covers completed scene geometry, materials, texture properties and registered timelines; partially constructed scenes after an exception and lifetime tests for every advanced mode remain open.
- The two synthetic passes matched pixel-for-pixel in the test environment; this is not a visual baseline against original artwork or a guarantee across browser/GPU versions.
- Build and test results must be repeated on the actual target environment and separately for earlier PRs in the stack.

## Verification record — 2026-11-09

On Windows, Node 22.18.0 and Chrome 156.0.8078.80 with software WebGL, a fresh local Git checkout of commit `019274b` passed `npm ci`, `npm run preflight`, `npm run build`, `npm run build:demo`, `npm run demo:pack` and, with both local servers running, `npm run test:demo`. The browser run took about 6.5 seconds for 28 chart/skin cases, a 1600×1600 export, zoom, mobile resize and a simulated missing asset. Instrumentation counted 2,148 texture-creation and 2,081 deletion calls during that run. These counts are an implementation smoke check, not memory usage or proof that all resources are released. The corresponding screenshots are local ignored test artifacts, not distributed artwork or approved baselines.

A subsequent clean checkout of `cec1a55` passed the same installation, preflight, builds, synthetic-pack generation and browser suite. All 28 mode/skin screenshots matched their repeated rendering byte-for-byte at the raw pixel level in that environment. The test also forced a delayed failing skin texture, compared concurrent exports with sequential results, checked interactive line dimensions during export, verified recovery after failure and cancellation after destruction, and exercised cleanup of a repeating GSAP timeline during redraw and export. The repeated 28-case section took about 11.4 seconds and recorded 4,232 texture-create and 4,165 texture-delete calls. This is not a measurement of retained GPU memory or a production visual baseline.
