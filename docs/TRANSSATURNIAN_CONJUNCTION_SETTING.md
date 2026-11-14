# Trans-Saturnian conjunction visibility setting

## Fix

The chart option is declared as `settaggi.transaturnini_se_congiunti` in `Settaggi` and in the saved-default settings shape. The existing `ElementiCelestiRender.getElementiCelesti` check incorrectly used the different, undefined camelCase property `transaturniniSeCongiunti`. The opt-in behavior for disabled Uranus, Neptune and Pluto therefore never ran under the actual settings contract.

The renderer now reads the existing snake_case field. No alias, migration or public API rename is introduced.

## Expected behavior

- `true`: an otherwise disabled outer planet can be included if its longitude is within its configured conjunction orb of an already visible celestial element. This includes conjunctions crossing 0° / 360°.
- `false` or missing: disabled outer planets remain hidden.
- Explicitly enabled outer planets remain visible independently of this option.
- Arabic-parts mode retains the existing exclusion of this special inclusion path; the original theme data stays immutable.

For the synthetic fixture Sun=359°, Uranus=2° (Uranus orb 4°), Neptune=56°, Pluto=122°, enabled=true now includes Sun and Uranus; enabled=false includes only Sun.

## Verification and compatibility

`npm run test:transsaturnian` runs deterministic Node tests against the **real TypeScript renderer** with visual-only dependencies stubbed. No new artwork, chart data or APIs are added. There may be an intentional visual difference in natal/transit/synastry views that inherit this setting: disabled outer planet glyphs previously missing can now appear when conjunct. Geometry and existing aspect formulas are unchanged.

Run `npm run verify:angular` and Chromium/Firefox screenshot comparisons for relevant modes and skins before merge. Headless/Astrolabio output and device parity require independent verification. No consumer integration, deployment, npm publication or GitHub Actions are part of this PR.
