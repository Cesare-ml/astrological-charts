# VirgoStars official skin — chart composition

The reference is the approved full-wheel VirgoStars mockup (ASC 20° Aries,
MC 20° Capricorn, five-body conjunction at 28°–2° across Pisces/Aries).
`demo/fixtures.ts` has a **synthetic** illustration with these positions:
Sun 28° Pisces; Mercury 29° Pisces; Venus 1° Aries; Moon and Mars 2° Aries;
Jupiter 15° Libra; Saturn 15° Sagittarius; Uranus 8° Capricorn retrograde;
Neptune 8° Aquarius; Pluto 8° Pisces. This fixture is **not** an astronomical
calculation or an identified user's natal chart. Consumers supply actual
longitudes, speeds and house cusps in `TemaRender`.

## Division between skin and shared layout

| Only `virgostars` skin | Every skin, including older selections |
| --- | --- |
| Pastel red/green/ochre/lavender backgrounds alternating by sign element | Zodiac width, position, sign glyph center and optional transit degree ruler |
| Warm ivory wheel and highly translucent solar resonator tint | Zodiac outer ruler **only when `mostraTransiti` is true**: every degree, longer marks at 5° and 10° |
| Color palette of the zodiac, houses and ASC/DSC/MC/IC | True-longitude ticks on house boundary for every rendered celestial body |
| Serif axis-heading typography, gentle line contrast | Open ASC/MC arrowheads, circular DSC/IC tails, labels and positions |
| Color styling of celestial signs/planet glyphs | Collision-aware stellium placement, with two fixed radial tracks when possible |

When transit mode is off, the external 360-degree scale is **not rendered**, so
the natal wheel remains uncluttered. This applies to all skins and to standalone
synastry charts. The transit-only ruler, body boundary ticks and aspect markers follow astronomical longitude
(`longitude`), **never** a symbol's display-only offset. Glyph displacements are
bounded by the existing symbol-layout solver; retrograde is encoded alongside
its glyph, rather than attached to a degree caption. For each body the renderer
draws a small tick crossing the **inner** circumference of the planetary band,
visually coinciding with the outer house boundary. It does **not** connect a
planetary glyph to a house. An independent outward connector ends at the true
degree near the sign. Short aspect endpoint discs make their exact longitude
easier to identify, including when a stellium is displayed on two tracks.

The previous `light`, `dark`, `light-bn`, `dark-bn`, `sun`, `astrolabio` and
`astrolabio-girasole` skins retain their existing palettes, while adopting the
shared geometrical changes. `virgostars` is the **new default** for callers who
create a fresh `Settaggi`/`defaultOpzioniGrafico`; callers with an explicit
`settaggi.skin_id` still select their original skin. No external asset or font
is committed; existing `simboli-bianchi` and resonator paths are used through
the host's asset resolver.

## User-visible controls and compatibility

- `mostraNomiAssi?: boolean` — defaults to on, shows ASC, DSC, MC and IC
  headings near their respective terminal markers. Individual arrow/tail
  toggles also hide the corresponding heading.
- `mostraGradiAssi?: boolean` — degrees and whole arcminutes at ASC and MC
  only. No repeated degrees at DSC/IC.
- `mostraOraPlanetariaAscendente?: boolean` — uses the supplied planetary-hour
  backend interval, never a guessed ruler.
- `mostraGradiElementiCelesti?: boolean` — original integer degree beside
  each body; not shifted along with its visual glyph.
- `temaGrafico: 'virgostars'` and `settaggi.skin_id = 'virgostars'` — opt in
  explicitly in existing consumers, or rely on the new default for new settings.

The helper `SkinManager.getAxisColors(id)` keeps axis colors skin-configurable.
Unknown/older skins use the original axis colors. This change requires no new
PNG files and does not modify planetary algorithms, house calculations or
aspect orbs. Consumer compatibility (VirgoStars web/mobile, offline Astrolabio)
must still be checked against original artwork and their integration branches
before shipping.

## Verification

Run `npm ci`, `npm run test:planet-layout`, `npm run verify:angular`, then the
independent browser demo for all **eight skins × four modes**. Review the
synthetic `natal-virgostars.png` screenshot for the stellium in both one- and
two-lane configurations; inspect the real-artwork reference only in a local
approved asset checkout. The automated geometry tests verify ruler tick count,
skin separation, exact house-boundary longitudes, aspect endpoints and
preservation of the compact stellium layout. These tests do not guarantee
appearance on all mobile dimensions or deployed e-ink devices.
