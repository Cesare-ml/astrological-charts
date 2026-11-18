# Celestial symbols — compact conjunction layout

For the official pastel skin, short true-longitude house-boundary ticks,
skin-independent **transit-only** one-degree external ruler and visible aspect endpoint dots,
see [VirgoStars official skin and shared geometry](VIRGOSTARS_OFFICIAL_SKIN.md).

## Changes

The old renderer displaced each glyph by running a forward-only 7° gap pass
twice; a compact group could drift far from its actual zodiac position and
crowded up at 0°/360°. The new `planet-symbol-layout.ts` provides a bounded
placement modes used by the rendered celestial glyphs:

1. unwraps zodiac positions at their largest empty arc (so 359° and 0° are neighbours);
2. allows up to **±5°** in the wide natal band and searches one main orbit first, adding **only one fixed inner orbit** when necessary;
3. draws isolated natal bodies and two-body pairs that fit without overlap larger (`0.24 × symbolScale`) and slightly farther from the zodiac, while genuinely crowded conjunctions retain equal compact symbols (`0.18 × symbolScale`) and degree labels radially inward, toward the houses; narrow transit/synastry rings retain `0.17 × symbolScale`;
4. tests the real two-dimensional glyph **and nearby degree-label** rectangles after chart rotation, including glyph/badge cross-collisions and each degree label against **every true-longitude house tick segment**;
5. retains an emergency adaptive fallback **only for ordinary natal charts** whose conjunctions are mathematically impossible within the angular bound; composite wheels instead use a dedicated strict one/two-orbit solver;
6. anchors the one retained, paler-gray outward connector to the **original longitude** at the zodiac boundary. The old inward connector to the houses is removed; a separate small tick starts **exactly on the outer house boundary**, never inside its ring.

For ordinary natal conjunctions, the two-track solver tests multiple insertion
orders and half-degree steps within ±5°. The default five-body Aries-point
fixture fits at a uniform compact glyph size (`0.18 × symbolScale`) on only
two radii; **isolated** planets are instead enlarged to `0.24 × symbolScale`
and placed on a slightly more inward orbit (an extra `0.05 × symbolScale`
radial gap from the signs). Nearby planets are **not** made compact solely
because their longitudes fall within a fixed 16° grouping interval: actual
full-size glyph/badge rectangles are checked after wheel rotation, and pairs
try both large-size tracks before shrinking. In a close three-body knot the
solver prefers two placements on the zodiac side and one toward the houses
when possible; it tests the last body in longitude order as the inward body
first, then other assignments if necessary. The existing ±5° bound and
collision rules still apply, and crowded five-body groups remain compact.
The labels sit
`0.152 × glyph scale` world units inward from their glyphs, on the same radial bearing. A pathologically
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
The layout also clips candidate degree-badge rectangles against all exact tick
segments from the house ring's outer edge to `+0.06` world units. Only those
specific segments are protected; a planet group is not squeezed away from
the entire house circumference. The glyphs retain a margin before the sign ring.
Transit and synastry rings use a separate layout **without degree badges**:
all glyphs start on one shared radius, adding at most a second fixed radius
for conjunctions. Their display angles can spread further than natal symbols
to avoid touching, while precise astronomical longitudes stay unchanged. No
third-orbit/adaptive radial fallback is permitted in these composite wheels.

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
on ordinary natal charts and on the **primary natal wheel alongside transits**.
It is `true` in `defaultOpzioniGrafico`; omitting it also enables it for
older callers. Set it to `false` to hide these labels and permit slightly
tighter angular spacing. The transiting planets and **both synastry planet
wheels never display degrees**, regardless of this option. Latitude markers
and astrological calculations are unaffected.

Example:

```ts
const options = structuredClone(defaultOpzioniGrafico);
options.mostraGradiElementiCelesti = false;
```

### Natal axis annotations

The following optional `OpzioniGrafico` flags default to `true`, except the
separate MC movement triangle, which defaults to **off** for newly constructed
settings (legacy callers omitting that property retain the old behavior):

| Option | Effect |
| --- | --- |
| `mostraFrecciaAscendente` | Short orange axis ending in a visibly broad, two-stroke open V arrowhead |
| `mostraRetroFrecciaDiscendente` | Plain green descending line with a smooth circular terminal disc, without the former gate |
| `mostraFrecciaMC` | Short violet axis ending in the same broad, two-stroke open V arrowhead |
| `mostraRetroFrecciaIC` | Plain lavender line with a smooth circular terminal disc of the same enlarged size as DS |
| `mostraGradiAssi` | ASC and MC: degree + whole arcminutes (e.g. `20° 0′`), rendered in upright serif; ASC degree **below** its name after the arrowhead, MC degree **above** its arrowhead but **below** the name, both centered to their axis |
| `mostraOraPlanetariaAscendente` | Glyph-only ruler of the planetary hour **centred above the ASC heading**, if source data exists (no “Ora” caption) |
| `mostraDirezioneMotoMC` | Optional filled lilac movement triangle, **off by default** in new settings to match the reference's clean MC arrow; when explicitly enabled, it sits halfway between the zodiac edge and the arrowhead base, at half the former height/width, and points left/right according to signed `mcSpeed` |
| `dimensioneNumeriCase` | Size multiplier for house numerals (default `1.25`) |

Axis positions always use the house system selected in `settaggi.domificazione_selezionata`;
the layout does not change actual ecliptic longitude. The ASC and MC show the
degree and whole arcminutes within the sign, rounded to the nearest minute;
the original seconds and fractions are retained in the input data. DS and IC
now use small `THREE.CircleGeometry` discs rather than square `THREE.Points`,
with slightly enlarged radius and stable shape at any display resolution.
The external axis stems have been further shortened: ASC +0.17, DS +0.22,
MC +0.18 and IC +0.22 world units outside the zodiac, leaving more air
around the small terminal dots; the **DS and IC headings are now closer** to
their respective dots, without touching them. The MC degree and heading
are centered on its radial axis at +0.30 and +0.45 units respectively,
closer to the open arrowhead while keeping their two-line spacing. The headings
ASC/DS/MC/IC are drawn using the same **bold Times New Roman-like**
canvas font in every skin, not images from astrological-assets. Their geometry
preserves the source canvas aspect ratio (512×160) so the text is not squashed
horizontally. The external ASC/DS/MC/IC strokes terminate at their **true zodiacal
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
halfway between the **zodiac boundary and start of the V arrowhead**. It points toward increasing ecliptic longitude for an
ordinary instant in the sky. To override it for a chart calculated through
directions/progressions, supply a signed `mcSpeed` under
`TemaRender.houses[selectedHouseSystem]` (or `TemaRender.mcSpeed`). A negative
value reverses the small arrow; zero or nonfinite data hides it. Its option
can independently hide the tip without hiding the MC arrow.

The service adjusts the interactive **and PNG-export cameras** to fit these
external annotations. Markers use native Three.js geometry, disposable
canvas-textured text and the same host-owned symbol assets already required
by the rest of the chart.

### Composite charts: transit and synastry annotations

When a transit or synastry wheel is visible, the **primary** body band no
longer repeats AS/DS/MC/IC as four extra planetary glyphs: their true
positions remain readable from the primary external axis arrows. The
**transit** body band shows planetary glyphs only, without degree badges or
repeated secondary AS/DS/MC/IC symbols. It reserves a clear angular corridor
around the four primary axis stems and tips. All transit glyphs prefer one
orbit; tight conjunctions can use one additional orbit while spreading their
display angles to prevent contact.

**Synastry** retains the independently computed AS and MC of the inner partner
chart (DS and IC are their opposites), but never shows planet degrees on
either the outer or inner wheel. The **outer wheel's planetary annulus is
narrower**: only its inner planet boundary moves from `75.1/120` to `77/120`
of the outer diameter. House-circle and sign-ring dimensions remain unchanged.
Both synastry planetary rings obey the strict two-orbit maximum. Input
`TemaRender`, houses, aspects, original longitudes and true-degree anchors
are unchanged. The low-level renderer retains full-axis behaviour except
when `primary-overlay`, `transit-overlay` or `synastry-overlay` is requested.

### Composite refinement: external grid and actual house edge

- With **transits enabled**, the ASC/DS/MC/IC **stems, arrowheads and terminal
  discs remain**, but their large headings, ASC/MC degree values, planetary
  hour glyph and optional MC movement triangle are automatically suppressed.
  The natal-only mode retains all user-selected annotations.
- The **transiting planets** prefer the orbit immediately outside the longest
  degree-grid marks, rather than the far transit-ring rim. Each planet now has
  one lightly tinted **45%-opaque connector** from its displayed glyph to
  its *true ecliptic longitude* at the base of the external grid; this remains
  correct when collision avoidance shifts its displayed glyph in angle.
- The **primary natal chart under transits** regains the same house/planet
  proportions (`67.1/120`, `66.16/120` etc.) as a standalone natal chart;
  previously its compact `75.1/120` inner planet boundary silently switched
  the solver to its small-glyph, multi-radius fallback. Regular transit mode
  now retains the natal chart's full `4.5723` zodiac diameter, with the transit
  degree-grid and glyph orbit placed proportionally outside it: switching
  overlays no longer shrinks the entire chart. The transit wheel can still
  spread a conjunction up to 16° visually to preserve full natal glyph and
  degree-badge sizes on one or two fixed orbits, while tick segments and
  computations remain at their true longitudes. Synastry keeps the nested
  house geometry for its second chart. The separate synodic-transit sizing
  override is unaffected.
- The short true-longitude **house ticks** now receive the *actual rendered
  house ring's outer radius*, rather than assuming the inner planet-band
  radius is also the house boundary. This fixes floating ticks especially in
  synastry, where the band has its own narrowed inner diameter.

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
  Composite tests verify absent transit/synastry degree badges, correct axis
  suppression, no glyph collisions, at most two radii across multiple chart
  rotations, protected ASC/MC corridors and unchanged source longitudes.
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
