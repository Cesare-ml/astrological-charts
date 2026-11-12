# Local WebGL texture lifecycle benchmark

Issue: [#5 — WebGL lifecycle and multiple charts](https://github.com/Cesare-ml/astrological-charts/issues/5).

This local, **manual** benchmark exercises repeated redraws of the Angular synthetic natal demo. It instruments WebGL createTexture and deleteTexture for WebGL 1/2 and records the difference (**outstanding handles**) at baseline, every 10 redraws and the final redraw. WebGL2 methods inherited from WebGL1 are wrapped only once to avoid double counting.

## Run

Use a clean checkout. Install dependencies with npm ci, start the generated synthetic asset server (npm run demo:pack then npm run demo:assets) and launch npm run demo in another terminal. Then:

~~~sh
node --test tests/texture-benchmark-core.test.mjs
npm run benchmark:demo
CHART_BENCH_REDRAWS=50 CHART_BENCH_MAX_TEXTURE_GROWTH=10 npm run benchmark:demo
~~~

On PowerShell set the environment values before starting the command, for example:

~~~powershell
$env:CHART_BENCH_REDRAWS = "50"
$env:CHART_BENCH_MAX_TEXTURE_GROWTH = "10"
npm run benchmark:demo
~~~

Set CHART_TEST_BROWSER=firefox for Firefox after installing a compatible browser, or use CHROME_PATH / FIREFOX_PATH to point to its executable. CHART_BENCH_REDRAWS must be an integer between 1 and 200; optional CHART_BENCH_MAX_TEXTURE_GROWTH must be a nonnegative safe integer. If the outstanding handle delta from first to last checkpoint exceeds the configured bound, the benchmark fails. When no bound is supplied, it **reports** the delta without setting an arbitrary failure threshold.

The JSON output includes webglCalls, textureHandles (baseline, final, net growth, peak sampled outstanding and checkpoints), timing percentiles and versions. Review a warm-up run before selecting a limit: cached resources and deferred cleanup may make short runs misleading.

**Important limitations:** API counters measure recorded calls, **not GPU memory**, allocated byte sizes, total browser resource use or a proven leak. The peak is limited to sampled checkpoints. This benchmark uses synthetic art and one natal canvas; it does not validate multi-canvas isolation, all skins, mobile PNG exports, headless Astrolabio, actual artwork or production. Follow up with real WebGL memory measurements, longer runs, browser and device coverage before accepting lifecycle changes. No GitHub Actions, publication or deployment is involved.
