# Celestial symbols — compact conjunction layout

For the official pastel skin, short true-longitude house-boundary ticks,
skin-independent one-degree external ruler and visible aspect endpoint dots,
see [VirgoStars official skin and shared geometry](VIRGOSTARS_OFFICIAL_SKIN.md).

## Changes

The old renderer displaced each glyph by running a forward-only 7° gap pass
twice; a compact group could drift far from its actual zodiac position and
crowded up at 0°/360°. The new `planet-symbol-layout.ts` provides a bounded
placement modes used by the rendered celestial glyphs:

1. unwraps zodiac positions at their largest empty arc (so 359° and 0° are neighbours);
2. allows up to **±5°** in the wide natal band and searches one main orbit first, adding **only one fixed inner orbit** when necessary;
3. draws truly isolated bodies larger (`0.22 × symbolScale`), while planets in a nearby conjunction retain their equal compact size (`0.17 × symbolScale`) and degree labels radially inward, toward the houses;
4. tests the real two-dimensional glyph **and nearby degree-label** rectangles after chart rotation, including glyph/badge cross-collisions;
5. retains an emergency adaptive fallback for groups that are mathematically impossible in two lanes while respecting the angular bound;
6. anchors the one retained outward connector to the **original longitude** at the zodiac boundary. The old inward connector to the houses is removed.

For ordinary natal conjunctions, the two-track solver tests multiple insertion
orders and half-degree steps within ±5°. The default five-body Aries-point
fixture fits at a uniform compact glyph size (`0.17 × symbolScale`) on only
two radii; **isolated** planets are instead enlarged to `0.22 × symbolScale`
while sharing exactly the same primary orbit. Nearby planets keep their
compact glyphs even if their group fits on the main orbit. The labels sit
`0.15 × glyph scale` world units inward from their glyphs, on the same radial bearing. A pathologically
dense arrangement (e.g. eight exactly coincident planets) may be impossible
with full-size symbols, just two tracks and the ±5° limit simultaneously.
The renderer currently uses the previous collision-safe adaptive scaling
fallback **only in that exceptional case**; it must not silently overlap
glyphs or alter astronomical longitudes. This limitation should be evaluated
if a strict two-radius policy is needed for arbitrary ephemeris data. The
legacy least-squares placement remains available to consumers that do not
request bounded layout.
These are *display* adjustments: astronomical longitudes remain unchanged.

The standard natal chart restores the full zodiac sign-ring width (`103/120`
of the outer diameter). To create room for radial planet tracks, the natal
house and aspect wheel is slightly smaller (its outer boundary is `67.1/120`
instead of `75.1/120`); transit and synastry house proportions are left
unchanged. Planet degree badges now sit **directly beside their glyphs**,
instead of occupying an independent ring far away. The two-track solver accounts
for the badge size, so the two cannot collide with another planet or badge.
The glyphs retain a margin before the sign ring. Transit and synastry rings
also use bounded placement with their smaller pre-existing degree label when
there is a nonzero usable radial band; degenerate near-zero-width rings retain
the legacy layout to avoid making chart rendering fail.

The on-screen glyph *can* move to improve readability. The underlying `TemaRender`
planet longitudes, cusp positions, aspect calculations and other chart math are
unchanged. The badge reports the original integer degree within the zodiac sign,
**not** the glyph angle. Any fractional digits have been removed: for example,
358°30′44″ is shown simply as **`28°`**. The underlying precise longitude
remains intact. Both ASC and MC labels show the true degree and the nearest
whole arcminute within their signs (e.g. `20° 0′`, or `28° 56′`), with no
decimal-degree notation or seconds.

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
| `mostraFrecciaAscendente` | Thin orange axis ending in a small two-stroke open arrow |
| `mostraRetroFrecciaDiscendente` | Plain green descending line with a smooth circular terminal disc, without the former gate |
| `mostraFrecciaMC` | Thin violet axis ending in a small two-stroke open arrow |
| `mostraRetroFrecciaIC` | Plain lavender line with a smooth circular terminal disc of the same enlarged size as DS |
| `mostraGradiAssi` | ASC and MC: degree + whole arcminutes (e.g. `20° 0′`), both upright sans-serif; ASC is centred above its free shaft and MC remains left of its arrow |
| `mostraOraPlanetariaAscendente` | Glyph-only ruler of the planetary hour directly **above the ASC degree**, centred on the same shaft, if source data exists (no “Ora” caption) |
| `mostraDirezioneMotoMC` | Filled lilac triangle with its base on the MC shaft halfway along the external arrow; points left or right according to signed `mcSpeed` |
| `dimensioneNumeriCase` | Size multiplier for house numerals (default `1.25`) |

Axis positions always use the house system selected in `settaggi.domificazione_selezionata`;
the layout does not change actual ecliptic longitude. The ASC and MC show the
degree and whole arcminutes within the sign, rounded to the nearest minute;
the original seconds and fractions are retained in the input data. DS and IC
now use small `THREE.CircleGeometry` discs rather than square `THREE.Points`,
with slightly enlarged radius and stable shape at any display resolution.
The external ASC/DS/MC/IC strokes now terminate at their **true zodiacal
degree tick**, i.e. the inner radius of the sign ring passed to the marker
renderer. They never cross the celestial-body band to reach the house circle;
house cusp dividers inside the house wheel are preserved independently.
The planetary-hour label consumes the **computed** `TemaRender.orePlanetarie`
object already returned by the VirgoStars backend (`dataora`, `alba`,
`tramonto`, `albaSucc`, `dh.diurne[]`, `dh.notturne[]`, each entry containing
`dataora` and `pianeta`). If missing or inconsistent, it omits the label;
it never invents the ruler. When available, the chart loads the corresponding
**existing** `simboli-bianchi/elementi-celesti/{planet}.png` via the shared
host-asset resolver and tints it to match ASC; it does not use a Unicode planet
character or bundle an additional image.

The filled MC movement triangle has its base directly on the arrow shaft,
near the midpoint of the external part of the axis. It points toward increasing ecliptic longitude for an
ordinary instant in the sky. To override it for a chart calculated through
directions/progressions, supply a signed `mcSpeed` under
`TemaRender.houses[selectedHouseSystem]` (or `TemaRender.mcSpeed`). A negative
value reverses the small arrow; zero or nonfinite data hides it. Its option
can independently hide the tip without hiding the MC arrow.

The service adjusts the interactive **and PNG-export cameras** to fit these
external annotations. Markers use native Three.js geometry, disposable
canvas-textured text and the same host-owned symbol assets already required
by the rest of the chart.

The zodiac glyph is centred radially in its own sign ring, rather than being
biased toward the celestial bodies. The Angular demo exposes **Show celestial
degrees**, per-axis controls, the house numeral scale, and a **Conjunction
stress-test (synthetic)** checkbox. Its **default** fixture places five bodies
within about four degrees around 359°/0° to expose overlaps immediately;
the optional stress fixture is denser still. Both use invented positions,
never a user's birth data.

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
  Collision checks include 25 chart rotations at two glyph scales, 30 mixed
  synthetic 18-body configurations, strict ±3° testing of the adaptive mode,
  and the normal **five-body ±5° / two-radii / equal-glyph-size** case at nine
  orientations, including degree placement toward the houses. They are still
  not a pixel-render baseline.
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
