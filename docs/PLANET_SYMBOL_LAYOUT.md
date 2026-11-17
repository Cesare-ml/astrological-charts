# Celestial symbols — compact conjunction layout

## Changes

The old renderer displaced each glyph by running a forward-only 7° gap pass
twice; a compact group could drift far from its actual zodiac position and
crowded up at 0°/360°. The new `planet-symbol-layout.ts`:

1. unwraps zodiac positions at their largest empty arc (so 359° and 0° are neighbours);
2. uses two radial lanes when the available ring width allows it, with a single-lane fallback for narrow charts;
3. spreads glyphs within each lane by minimum-squared angular displacement, based on the actual glyph/label footprint;
4. resolves remaining two-dimensional bounding-box collisions after chart rotation, including collisions between a glyph and another body's degree badge;
5. anchors every thin connector to the **original longitude** at the ring boundary, rather than to the displaced glyph;
6. keeps the symbol and small degree label horizontal even where the radial connector bends.

The natal chart's planet ring has more space (`103/120` of the zodiac outer diameter).
When its radial width is at least `0.45` world units, glyphs occupy an outward
collision-spread orbit, while much larger degree badges get their **own
collision-spread orbit next to the house ring**, between glyphs and house
numerals. The separated radial bands protect readability on the 800px demo.
Thinner transit and
synastry bands retain the preceding tangential badge layout. This avoids
incorrectly moving glyphs outside a narrow band.

The on-screen glyph *can* move to improve readability. The underlying `TemaRender`
planet longitudes, cusp positions, aspect calculations and other chart math are
unchanged. The badge reports the original degree within the zodiac sign,
**not** the glyph angle. The main degree number is followed by **two much
smaller arcsecond digits** instead of the degree sign. For example, 358°30′44″
is shown as a large `28` followed by small `44` (the minute portion is not
drawn in this compact badge). Full DMS remains available for the ASC and MC
captions. Badges are slightly reduced in size and shifted toward their glyphs.

## Public option

`OpzioniGrafico.mostraGradiElementiCelesti?: boolean` controls degree labels
for each celestial glyph. It is `true` in `defaultOpzioniGrafico`, and
omitting the property also enables it for older callers. Set it to `false`
to hide the labels and permit slightly tighter angular spacing. This affects
radix, transit and synastry symbol rings, not latitude markers or astrological
calculations.

Example:

```ts
const options = structuredClone(defaultOpzioniGrafico);
options.mostraGradiElementiCelesti = false;
```

### Natal axis annotations

Each of the following optional `OpzioniGrafico` flags defaults to `true`;
legacy callers omitting them also see the requested markers:

| Option | Effect |
| --- | --- |
| `mostraFrecciaAscendente` | Orange double open chevrons with endpoint dot on ASC |
| `mostraRetroFrecciaDiscendente` | Green bracket/gate on DS |
| `mostraFrecciaMC` | Violet notched compass vane on MC |
| `mostraRetroFrecciaIC` | Lavender open faceted cradle on IC |
| `mostraGradiAssi` | Zodiacal degree/minute/second captions at ASC and MC |
| `mostraOraPlanetariaAscendente` | Ruler of the planetary hour beside ASC, if source data exists |
| `mostraDirezioneMotoMC` | Small golden direction tip within the MC arrow |
| `dimensioneNumeriCase` | Size multiplier for house numerals (default `1.25`) |

Axis positions always use the house system selected in `settaggi.domificazione_selezionata`;
the layout does not change actual ecliptic longitude. Degree captions show
*degree within the current sign*, with minutes and seconds rounded correctly.
The planetary-hour label consumes the **computed** `TemaRender.orePlanetarie`
object already returned by the VirgoStars backend (`dataora`, `alba`,
`tramonto`, `albaSucc`, `dh.diurne[]`, `dh.notturne[]`, each entry containing
`dataora` and `pianeta`). If missing or inconsistent, it omits the label;
it never invents the ruler. When available, the chart loads the corresponding
**existing** `simboli-bianchi/elementi-celesti/{planet}.png` via the shared
host-asset resolver and tints it to match ASC; it does not use a Unicode planet
character or bundle an additional image.

The MC movement indicator points toward increasing ecliptic longitude for an
ordinary instant in the sky. To override it for a chart calculated through
directions/progressions, supply a signed `mcSpeed` under
`TemaRender.houses[selectedHouseSystem]` (or `TemaRender.mcSpeed`). A negative
value reverses the small arrow; zero or nonfinite data hides it. Its option
can independently hide the tip without hiding the MC arrow.

The service adjusts the interactive **and PNG-export cameras** to fit these
external annotations. Markers use native Three.js geometry, disposable
canvas-textured text and the same host-owned symbol assets already required
by the rest of the chart.

The Angular demo exposes **Show celestial degrees**, per-axis controls,
the house numeral scale, and a **Conjunction stress-test (synthetic)** checkbox.
Its stress fixture uses only
illustrative positions around 359°/0° and no user's birth data.

The demo now accepts a locally calculated `TemaRender` JSON file (or a wrapper
with `temaRender` or `theme`). After its first import, that chart becomes the
default on page reload, stored **only in the local browser**, with a button to
clear it. Because this renderer intentionally contains no ephemeris, entering
a date/place alone is not enough to calculate a real chart. Any personal test
date/place must stay in the local host and not in this public source tree.

## Verification / integration gate

- Geometry tests: `npm run test:planet-layout`. This covers both the pure
  collision algorithm and a Three.js scene assembled without WebGL using
  synthetic symbol meshes. It checks true-longitude anchors, glyph ring bounds,
  badge placement, original input immutability and default/disabled degree labels.
  Additional headless tests verify the wide band, axis geometry, independent
  toggles, degree/minute/second boundaries, real interval selection for planetary
  hours and signed MC motion.
  Collision checks include 25 chart rotations at two glyph scales and 30 mixed
  synthetic 18-body configurations; they are still not a pixel-render baseline.
- Library/demo build: `npm run verify:angular` on a clean install.
- Visual smoke: with the generated local demo pack and both servers running,
  `npm run test:demo` in Chromium and Firefox; inspect
  `conjunction-degrees-on.png` / `conjunction-degrees-off.png` plus the mobile
  screenshot, and compare all four chart modes.
- The input option is additive. No asset path, public import, ephemeris or
  persistent data contract changes. The renderer uses `CanvasTexture` for the
  label, disposed with the scene as other material textures are.
- Only the extracted library is changed. Integration into VirgoStars web,
  native mobile PNG and Astrolabio still requires its own visual validation
  against approved artwork and headless/e-ink devices; this PR does not ship
  those consumers or alter the live website.
- A real reference birth chart must be loaded in the **host application** using
  its own ephemeris, coordinates and time-zone conversion. The synthetic demo
  cannot calculate positions from date/place fields, and real birth details
  must not be committed to this public repository. The manual host verification
  therefore remains separate from the WebGL-free geometry tests.
