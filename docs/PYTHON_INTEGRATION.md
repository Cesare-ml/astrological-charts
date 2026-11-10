# Use Astrological Charts from Python — PNG and JPEG

This is **one of several supported development entry points**.
If you use JavaScript/Node.js instead, see
[Node.js integration](NODE_INTEGRATION.md) and
`node examples/node/example.mjs`. Both languages use the same JSON v1
contract and the same chart renderer.

You **do not need to learn Angular or TypeScript** to generate an image.
Your Python code calculates (or reads) positions and twelve house cusps,
and Astrological Charts uses the real Angular/Three.js renderer to draw
them. The bridge uses a **versioned JSON file**. Python never needs to
reimplement the renderer.

**Requirements:** Python 3.10+, Node.js matching `package.json` (Node
22 LTS recommended), Chrome/Chromium and a graphics driver capable of
WebGL. No VirgoStars login, AWS key, private source repository or paid
service is needed. The example uses **synthetic assets and invented
coordinates**; it does not bundle or hotlink real VirgoStars artwork.

## Fastest test

From the repository folder, with Node.js and Python installed:

```powershell
npm ci
python examples/python/example.py
```

Find the generated image in `.local/python-example.png`. To generate
JPEG instead:

```powershell
python examples/python/example.py --jpg
```

The bridge creates the test asset pack if missing, starts the local
asset/demo services if needed, opens a headless Chromium session,
imports JSON into the **actual** renderer, exports its 1600×1600 PNG
and optionally converts it to JPEG using `sharp`. It stops only the
servers it started. The first run may require installation of Node
dependencies. Both local services use `127.0.0.1`; no data is sent
to VirgoStars, and the bridge blocks external browser requests.

If Chrome is not found, point `CHROME_PATH` to its executable:
```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
python examples/python/example.py
```

### Render your own computed positions

Create a `payload` dictionary and call:

```python
from examples.python.virgostars_charts import render_chart

natal = {
    "datetime": "2026-01-01T12:00:00Z",
    "ascendant": 20.0,
    "midheaven": 290.0,
    "houseCusps": [20.0 + i * 30 for i in range(12)],
    "planets": {
        "Sun": {"longitude": 280.0, "latitude": 0.0},
        "Moon": {"longitude": 150.0, "latitude": -3.2},
    },
}
render_chart({"schemaVersion": 1, "natal": natal}, "my-chart.png",
             mode="natal", skin="light")
```

Numbers above are **only examples**, not astrological calculations.
For a real chart, replace every coordinate and all twelve house cusps
with values produced independently by your own code and house method.
Use a compatible set of body names supported by the renderer.

To build a transit or synastry chart, add a complete `transits` or
`synastry` object with the same fields as `natal`, then request
`mode="transits"` or `mode="synastry"`. Mode `latitude` uses the
natal coordinates. Output filename extension decides PNG/JPEG.

The same input can be loaded **manually** in the browser demo via
**Import your computed chart (JSON)**. Export PNG with the button.

## JSON data contract (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "mode": "natal",
  "skin": "light",
  "natal": {
    "datetime": "2000-01-01T12:00:00Z",
    "ascendant": 20,
    "midheaven": 290,
    "houseCusps": [20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320, 350],
    "planets": {
      "Sun": {
        "longitude": 15,
        "latitude": 0,
        "longitudeSpeed": 0.95,
        "latitudeSpeed": 0,
        "declination": 5.2
      }
    }
  }
}
```

`natal` is required; `transits`, `synastry`, `mode`, `skin`
are optional. Planet longitude (degrees) is required. Optional planet
latitude, ecliptic longitude speed, latitude speed, and equatorial
declination default to 0 and are **not inferred or computed**.
Each chart requires twelve finite house cusp longitudes, ascendant,
midheaven and a non-empty date-time string. Positions are normalized
to [0,360); latitude/declination must be within [-90,90].
`australInversion` and `vertex` are optional. The adapter supplies
the legacy `TemaRender` structure without manufacturing ephemerides
or house calculations. A missing transit/synastry input is reported as
an error rather than substituted with a fake chart.

Input files must be 1 MB or smaller. The current demo expects the
renderer-supported planet names and skin IDs. Custom celestial body
shapes, degrees/radians conversions and new graphical interfaces
require explicit renderer features and tests.

## Where VirgoStars-Ephemeris fits

```text
Your Python program
  |  (Python calculations / upcoming VirgoStars-Ephemeris Python bindings)
  v
Precomputed celestial coordinates + house cusps
  |
  v
Astrological Charts JSON v1
  |
  v
Angular 20 / Three.js demo -> PNG or JPEG
```

The planned **Rust / PyO3** bindings of
[VirgoStars-Ephemeris](https://github.com/Cesare-ml/VirgoStars-Ephemeris)
are not released yet. There is **no working Python API to claim**
for that project as of this document. This example is ready to consume
numbers from any independently licensed computation library in the
meantime. `astrological-functions` is the separate future home for
house systems and astrological operations.

## Verify the shared renderer using a real browser

Both Python and Node.js call the **same** Angular/Three.js rendering
path. From the repository root, after `npm ci` and with Chrome and
WebGL available, run `npm run test:render-bridge` to verify one real
PNG and one JPEG output with synthetic data. This tests the Node-side
rendering bridge that the Python wrapper uses; it does **not**
run the Python wrapper itself. For an additional Python end-to-end
check, run `python examples/python/example.py` and inspect its PNG.

The bridge now waits for the selected mode and skin to finish rendering,
not just for any previous chart to report completion. This test is
manual and is not a production/Astrolabio certification.

## Troubleshooting

- `node was not found`: install Node.js and open a new terminal.
- `Dependencies missing`: run `npm ci` once from the repository root.
- `Chrome/Chromium not found`: install Chrome or set `CHROME_PATH`.
- `Unknown skin` or `natal.planets...`: correct the JSON following
  the field names above. No fake fallback chart is generated.
- `Missing asset`: close other local servers on ports 4177/4200
  (which may serve a different pack) and retry with synthetic assets.
- `WebGL`/browser error: check browser support and graphics drivers.
  Browser automation needs a graphics-capable environment; not every
  server or VM provides usable WebGL.
- Want to inspect the chart interactively? Follow
  [the Angular demo guide](ANGULAR_DEMO.md).

**Licensing:** the renderer source is CPAL-1.0 with visible
VirgoStars attribution obligations (see [credits](LICENSING_AND_CREDITS.md)).
The synthetic sample is not a scientifically valid chart, and separate
artwork is not licensed by this repository.
