# Node.js integration — Angular frontend, custom scripts and Astrolabio

Astrological Charts is a **single chart-rendering codebase** used in
multiple runtime environments. Angular is the implementation framework
for the Three.js scene renderer; **Node.js can prepare the data and
orchestrate image export**, including in standalone JavaScript apps.
Node.js itself cannot execute the Angular browser/WebGL scene renderer
without a compatible browser environment or a separately implemented
rendering adapter.

There are **three distinct paths**; do not confuse them:

| Consumer | How it uses Astrological Charts | Status |
| --- | --- | --- |
| VirgoStars Angular frontend | Angular service and shared Three.js renderers | Existing upstream integration; this extracted repo is not deployed |
| Node.js scripts/backend (new) | `node/index.mjs` with JSON v1 → local Chromium/Angular demo → PNG/JPEG | Draft PR, not end-to-end tested |
| Astrolabio Node.js backend | Existing bundled renderer invoked in headless Firefox with offline `file://` assets and e-ink delivery | Existing separate upstream adapter; migration not performed |

**Important:** the Astrolabio headless adapter documented in
[INTEGRATION_PLAN.md](INTEGRATION_PLAN.md) directly calls
`CartaAstraleCreaScena`, overrides image-loading behavior and uses
Firefox. It does **not** currently call the new
`node/index.mjs` helper. The desktop synthetic demo cannot replace
its offline/e-ink path without a separate, reviewed compatibility test.

## Quick start: precomputed data to PNG/JPEG in Node.js

Install Node.js 22 LTS (or compatible version listed in `package.json`)
and Chrome/Chromium. In a checkout of this repository:

```sh
npm ci
node examples/node/example.mjs
node examples/node/example.mjs --jpg
```

The output appears in `.local/node-example.png` or
`.local/node-example.jpg`. It uses made-up planetary coordinates
and locally generated placeholder artwork — not actual ephemerides.
The helper creates a synthetic asset pack if missing, launches local
Angular and asset servers when needed, and uses the **real** Three.js
PNG exporter plus JPEG conversion. No private data or original assets
are required.

Your **own Node.js computations** can provide an ordinary JavaScript
object:

```javascript
import { renderChart } from './node/index.mjs';

// Illustrative numbers only. Replace these with your own calculated data.
const computedChart = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20,
  midheaven: 290,
  houseCusps: Array.from({length: 12}, (_, i) => (20 + i * 30) % 360),
  planets: {
    Sun: {longitude: 15, latitude: 0},
    Moon: {longitude: 75, latitude: -2.1},
  },
};
await renderChart({ schemaVersion: 1, natal: computedChart }, 'chart.png',
  { mode: 'natal', skin: 'light' });
```

This example assumes your script is at the root of this checkout.
For scripts elsewhere, import the helper using its own correct
relative path. The Node adapter is currently **source-only**, not
a released npm package or a stable production API.

### TypeScript support

`node/index.d.mts` provides type declarations for the JavaScript
entry point: `ChartPayloadV1`, `ChartCoordinates`,
`PlanetCoordinates`, `RenderOptions` and the three Node functions.
A TypeScript backend can import them without reimplementing the
renderer. Both `.mjs` and `.d.mts` must stay together when vendored;
no npm package export is declared yet. Check the declarations locally with
`npm run test:node-types` (TypeScript compiler, no WebGL required).

### Fail-fast chart validation

The CLI now loads Playwright and Sharp **lazily after**
parsing and validating the JSON input. Consequently `--help` and
malformed-input diagnostics do not depend on having run `npm ci`.
Successful rendering still requires the installed dependencies,
Chrome/Chromium and WebGL.

The Node API validates the complete precomputed JSON v1 shape before
writing its temporary JSON file. The standalone CLI (also used by the
Python wrapper) checks the input file's byte size, JSON syntax, chart
positions, angles, all twelve cusps and required second charts **before**
install checks, synthetic asset generation or Chromium startup.

A caller selecting `{mode:'transits'}` must supply `transits` data
even if the JSON says `mode:'natal'`. Both the embedded mode and any
mode override are validated because Angular parses the embedded mode
before the headless runner changes its controls. Likewise for synastry.
No missing planetary positions are invented. Invalid JSON and more
than 1,000,000 input bytes are rejected, rather than being silently
repaired. `latitude: 0` and `latitude: -0` are accepted unchanged.
The browser parser still normalizes longitude into 0–360 degrees.

`scripts/validate-chart-input.mjs` is deliberately a **shape validator
only**, not a second astronomical engine. Keep it aligned with the
actual Angular parser `demo/chart-input.ts` through
`npm run test:chart-input`, `npm run test:validate-chart-input` and
`npm run test:chart-cli-validation`.
It does not establish a versioned general-purpose schema library
or replace the browser's own checks.

### Validate without rendering

After writing a JSON v1 file, run the validation-only command. It
requires Node.js but **no browser, npm install or file output**:

```sh
node scripts/render-chart.mjs --input computed-chart.json --validate-only
node scripts/render-chart.mjs --input computed-chart.json --validate-only --mode transits
```

The optional `--mode` is checked against the supplied records:
`transits` or `synastry` requires a matching second chart.
`--validate-only` never creates or overwrites the output image,
even if `--output` is supplied. It confirms input shape/ranges,
not ephemeris accuracy, chart appearance or permission to publish
data. Duplicate CLI flags and missing values are rejected.

The programmatic `renderChartFile()` API now reads and validates a
JSON file in the calling Node process **before** creating staging
directories or spawning a child renderer, just as `renderChart()`
validates its object input. The standalone CLI validates again if
the file changes between these checks.

### Export reliability

The Node helper stages output in a temporary directory **beside the
requested file** and checks the expected PNG/JPEG signature before
moving it into place. A process exiting successfully without writing
an image is treated as failure; an existing final image is preserved
on errors. This is only a basic signature check; the actual Chromium
CLI additionally checks image metadata with `sharp`.

Use `{timeoutMs: 180000}` for the default 3-minute Node subprocess
limit, or set an integer between 100 and 600000 milliseconds. A
subprocess timeout terminates the render command; investigate any
local development servers it may have started if interrupted during
initialization. This does **not** constitute a production-ready
queue or browser pool.

### Windows troubleshooting: input field not found on port 4200

On a Windows 11/Node 22.18.0 manual run, the synthetic pack check on port
4177 passed, but Chromium reported
`locator.setInputFiles: Timeout 30000ms exceeded` while waiting for
`#chart-file`. The export was **not successful**.
A running local server on port 4200 can return the expected index
HTML but serve a stale Angular bundle or an incomplete UI. The CLI now
waits for the *mounted* `#chart-file`, `#mode`, `#skin`, status
and chart canvas before importing chart JSON. If a control is missing,
it reports DOM availability and recent page errors instead of
continuing to a generic Playwright upload timeout.

Open `http://127.0.0.1:4200/` in Chrome. The page should have
the **Import your computed chart (JSON)** field. If it is absent,
check which process owns port 4200 in PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 4200 -State Listen |
    Select-Object LocalAddress,LocalPort,OwningProcess
```

Close only a known old Angular process under your control, then retry
`node examples/node/example.mjs`. Do not kill unrelated services.
If the page is blank, inspect the Chrome developer console and
the new error diagnostics for missing JS modules or compile failures.
Run `npm run test:local-render-services` after updating the branch;
it now includes isolated DOM-readiness tests. A successful unit test
does **not** verify Chromium/Three.js on Windows.

The standalone synthetic CLI **rejects port collisions** on 4177 or
4200 instead of silently rendering with unrelated local services.
Port 4177 is checked against several hashes in the generated synthetic
manifest, and port 4200 must serve the expected Angular demo page.
If you already run an approved *original artwork* server at 4177, stop
it before running this synthetic-only helper, or use the separate
interactive demo with your authorized assets. The CLI does not
fall back to live VirgoStars resources.

### Automatic cleanup of development servers

If this helper starts the Angular dev server or the manifest-verified
synthetic asset server, it tracks those **new processes only**.
Its shutdown tries to terminate the entire owned process tree:
Windows uses `taskkill /T /F`, while macOS/Linux use a detached
process group. This helps prevent Angular/Node children from staying
open after exporting PNG/JPEG. Servers that you started in another
terminal are **not** automatically terminated. If a spawned process
fails at startup, the helper reports the error instead of waiting
through the full server-readiness timeout.

Run `npm run test:local-process-lifecycle` for the isolated lifecycle
tests. They were exercised on Node.js/Linux; a real Windows and
macOS smoke test is still required before claiming cross-platform
validation. This is a developer bridge, not a production supervisor.

### Also supported: existing JSON files

If your program generates the shared JSON file, use:

```javascript
import { renderChartFile } from './node/index.mjs';
await renderChartFile('computed-chart.json', 'computed-chart.jpg',
  { mode: 'transits', skin: 'dark' });
```

The CLI works too:

```sh
npm run render:chart -- --input computed-chart.json --output computed-chart.png
```

The format is documented in
[the JSON v1 contract](PYTHON_INTEGRATION.md#json-data-contract-schemaversion-1).
The **format is shared**, not Python-specific. A real transit or
synastry chart requires complete second-chart input. The adapter
validates the data and does not silently invent missing positions.

## Real-image preview using the separate approved asset pack

A Windows 11 user confirmed a **successful real PNG export** through
Node.js **22.18.0**, Angular/Three.js and Chrome after resolving local
server conflicts. The circle/geometry looked correct, but **planet and
zodiac symbols showed intentional synthetic placeholders**. This is a
useful *synthetic smoke test*, not proof of real-asset visual fidelity.
The selected unit tests were reported green by the tester; exact
terminal logs and the JPEG/transits/synastry/latitude results have not
been attached to this PR.

The separately authorized `Cesare-ml/astrological-assets` manifest
currently lists **1,013 approved-for-private-collaboration images**,
including the planet and zodiac symbol families. These are **not**
licensed for public redistribution. No fonts are included. Do not
copy them into `astrological-charts`, commit them or publish them.

For an **interactive local preview only**, with sibling folders
`astrological-charts` and `astrological-assets`, use two separate
PowerShell windows (after stopping only your own old local servers
on 4177 and 4200):

PowerShell A, from `D:\\GitHub\\astrological-charts`:

```powershell
npm run demo:assets:repo
```

PowerShell B, from the same chart renderer directory:

```powershell
npm run demo
```

Open `http://127.0.0.1:4200/` and verify the planet, sign and house
symbols on a chart, plus console warnings for unavailable assets.
The asset server checks the real binary files against the approved
manifest; merely having a manifest JSON file is not enough. This
does not require copying any binary into the public renderer.

**Important:** `node examples/node/example.mjs` intentionally
requires the *synthetic* manifest and refuses to use the real-asset
server on 4177. Do **not** change that identity check or mix original
images into the synthetic pack. Automated PNG/JPEG exports with the
approved external pack need a separate explicit, manifest-verified
mode and dedicated tests before release.

### Opt-in headless export using an approved *external* asset pack

The default `node examples/node/example.mjs` still uses locally
generated checkerboard placeholders. If you have an **authorized
separate checkout** of `Cesare-ml/astrological-assets` alongside this
repository, you can now explicitly opt in to real local artwork:

```powershell
# From D:\\GitHub\\astrological-charts, with both local ports free:
node examples/node/example.mjs --approved-assets
node examples/node/example.mjs --approved-assets --jpg
```

The output filenames are `.local/node-example-approved.png` and
`.local/node-example-approved.jpg`, leaving synthetic files intact.
The example passes its two **explicit** paths to `renderChart()`.
For a custom JSON file, the equivalent command is:

```powershell
node scripts/render-chart.mjs --input computed-chart.json --output .local/approved-chart.png `
  --assets-root ..\\astrological-assets\\public\\assets `
  --assets-manifest ..\\astrological-assets\\manifests\\approved-assets.json
```

Node consumers can pass
`{assetRoot:'../astrological-assets/public/assets',
assetManifest:'../astrological-assets/manifests/approved-assets.json'}`
alongside their normal mode/skin options. The pair is mandatory.
The actual external pack is loaded only if explicitly requested. The
CLI verifies the **complete local binary collection** against the
manifest SHA-256 and its approval metadata, starts a temporary
loopback-only asset server and checks representative HTTP response
bytes before rendering. Existing services on port 4177 are **rejected**,
even if they appear to serve the right pack: never trust a foreign
process from a few sample requests. If you're running
`npm run demo:assets:repo`, stop **that owner-started process only**
before the headless export. The CLI cleans up only its own processes.

This is a **local owner-authorized preview**, not public
redistribution permission or proof that all symbol variants and
specialized chart modes are visually correct. No artwork is copied to
`astrological-charts`, embedded into the package, uploaded to a server
or fetched from VirgoStars production. Asset loading failures must
fail visibly rather than silently reverting to placeholders.

Run browser-free integrity checks using
`npm run test:approved-render-assets`; run real visual tests on
Windows with Chrome and inspect the output manually. The default
synthetic browser test remains separate.

## Real-browser verification before integration

After `npm ci`, run this **manually** with Chrome/Chromium and
working local WebGL:

```sh
npm run test:render-bridge
```

This test uses **invented** natal, transit and synastry positions,
including exactly zero and nonzero positive/negative latitude, and
only generated checkerboard graphics. It calls the public Node.js
`renderChart()` API and exercises **all four render modes**:
natal/light PNG, transits/dark JPEG, synastry/light PNG and
latitude/dark PNG. Every export must be 1600×1600, nonblank and
match the requested file format. The natal/light and synastry/light
decoded pixel hashes must differ so the second chart cannot be
silently ignored. The temporary outputs are removed after the test.

Every headless export also monitors asset requests to the local
`127.0.0.1:4177` server. A missing image (HTTP 404), modified image
(HTTP 409), or failed local asset request now rejects the export
before publishing its PNG/JPEG. Diagnostics list only affected
`/assets/...` paths, never private natal input data. This also
catches a situation where the manifest itself is valid but a
particular mode or skin references an asset it does not contain.
In explicit approved-artwork mode, a render is also rejected if
**no successful image response** was observed from the local asset
server. This prevents a chart from appearing to succeed while it
silently avoids the approved asset pack. This is a necessary loading
check, not a pixel-by-pixel visual comparison.
Use `npm run test:chart-asset-request-audit` for browser-free checks.

The headless exporter waits for a newly completed Angular draw when
JSON is imported or the chart mode/skin changes, using a revision and
the completed mode/skin from the demo rather than trusting an old
"Rendered" message. Import failures terminate the export with an error.

This test is intentionally **not part of `npm run preflight`**:
it requires a browser and WebGL and is different from the lightweight
Node.js unit tests. A passing synthetic test does not prove visual
parity with original VirgoStars artwork or compatibility with the
Astrolabio's offline Firefox/e-ink adapter. Record the OS, browser
version and result in the review PR.

## Multiple exports from one Node.js process

The developer adapter now **serializes all calls to `renderChart()`
and `renderChartFile()` within the same Node.js process**. This
prevents two in-process requests from launching competing copies of
the local Angular/asset servers on ports 4200 and 4177. The queue
continues after one request fails, without losing or fabricating any
other request's chart output. Input data remain separate, and a
failed render cannot replace an existing image.

The queue slot is reserved **before** asynchronous file reads or
temporary JSON creation. Consequently, mixed `renderChart()` and
`renderChartFile()` calls within one process retain submission order
even when filesystem calls take different amounts of time. Both APIs
use a private in-queue operation: a queued task must **not** invoke
another public queued method, because that would self-deadlock.

```javascript
import { renderChart } from './node/index.mjs';

// All four requests share one queue in this process.
// Coordinates must already be calculated by your program.
const results = await Promise.allSettled([
  renderChart(firstComputedChart, 'first.png'),
  renderChart(secondComputedChart, 'second.png'),
  renderChart(thirdComputedChart, 'third.jpg'),
  renderChart(fourthComputedChart, 'fourth.png'),
]);
console.log(results.map(item => item.status));
```

The queue is **strictly in-memory and process-local**. It does
**not** coordinate two Node.js processes, multiple worker threads,
separate Python subprocesses, direct CLI invocations or multiple
servers. It has no persisted jobs, cancellation, backpressure,
multi-tenant isolation or production throughput guarantees.
The browser is still launched for every operation. A real
VirgoStars backend implementation will need a tested persistent
renderer pool and an explicit cross-process ownership/locking
strategy before handling concurrent user requests.

Run `npm run test:node-concurrency` to exercise three overlapping
mock exports (one intentionally fails) and verify that requests
complete in order without overlapping. This test is included in
`npm run preflight` and does **not** need a browser. Use
`npm run test:render-bridge` separately for real WebGL exports.

## Production-oriented design

This draft helper is suited to a **developer workstation or offline
batch experiments**, not a production web service. It currently
spawns one Chromium browser and local Angular/asset servers per
operation (unless already running); this has startup cost and is
not suitable for high-volume concurrent requests.

To support the live VirgoStars Node backend and Astrolabio safely
later, a dedicated versioned `@virgostars/charts-node`-style adapter
(or equivalent export) should be considered with:

1. A persistent, bounded browser/renderer pool or a tested offline
   browser adapter (not unbounded per-request spawning).
2. Process isolation, trusted asset roots, cleanup, request/time
   limits, data/size validation and versioned JSON contracts.
3. A complete offline Firefox `file://` test matching the shipped
   Astrolabio bundle, including original asset manifest/hash and
   e-ink output comparison.
4. Tests for all chart modes, skins, no-web access, browser lifecycle,
   PNG/JPEG results and compatibility with production consumers.
5. Changes confined to this repo until approved integration and
   rollback planning in `virgo-stars`.

**Never use the synthetic local demo as proof of Astrolabio
compatibility**. The actual production adapter is not modified
by this PR. An independent Node.js calculation library may still
produce coordinates for this renderer, and the Rust engine can later
expose shared astronomy through Node/WASM and Python bindings.
