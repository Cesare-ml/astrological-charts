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

## Real-browser verification before integration

After `npm ci`, run this **manually** with Chrome/Chromium and
working local WebGL:

```sh
npm run test:render-bridge
```

This test uses **invented** natal and transit positions and only
generated checkerboard graphics. It calls the public Node.js
`renderChart()` API, starts the existing local Angular/Three.js
renderer, exports a **1600×1600 PNG (natal/light)** and a
**1600×1600 JPEG (transits/dark)**, then verifies their actual formats
and nonblank pixel variation with `sharp`. The files are kept in a
temporary test directory and removed on completion.

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
