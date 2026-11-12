# Automated selection of chart assets (private, read-only)

`astrological-charts` must **not** copy PNG/SVG/font files into the npm library. VirgoStars remains the only source for graphics actually served by the site: `virgo-stars/public/assets/`.

This tool derives a conservative **list of paths only** from the Angular library's own code and the real host directories. It is intended to assist local validation and preparation of the versioned SHA-256 manifest from PR #9.

## Run with sibling checkouts

```powershell
# From astrological-charts on the feat/derive-chart-asset-selection branch:
npm install

node scripts/derive-chart-asset-selection.mjs `
  --root ../virgo-stars/public/assets `
  --out ./chart-assets.selection.local.json `
  --report ./chart-assets.selection.report.local.json

# Only if the tool exits with code 0 and the report has no unresolved references:
node scripts/asset-manifest.mjs generate `
  --root ../virgo-stars/public/assets `
  --selection ./chart-assets.selection.local.json `
  --out ./chart-assets-manifest.local.json

node scripts/asset-manifest.mjs verify `
  --root ../virgo-stars/public/assets `
  --manifest ./chart-assets-manifest.local.json
```

**When a skin image is missing or an active asset reference is not a static literal, the program writes the diagnostic report and exits with code 2 without writing a new selection file.** If there is a prior selection file from an earlier run, delete or rename it before rerunning; never treat it as current after a failed check.

## How assets are chosen

The script parses the *active* TypeScript AST (comments excluded) for `SkinManager.skins`'s `texture` and `imgRisuonatoreSolare` values, and for `GestoreImmagini.preloadArraySimboli`. All these literals must exist in the real host asset root or the command fails.

It also inventories files from these known chart-only directories, preserving existing filename casing:

- `img/simboli-bianchi`
- `img/simboli/case`, `img/simboli/elementi-celesti`, `img/simboli/elementi`, `img/simboli/segni`
- `img/grafici`
- `img/textures`
- `img/symbols/planets/dark/_circle`, `img/symbols/planets/light/_circle`

Therefore the output is intentionally a **conservative chart asset superset**, not an ideal or minimal Astrolabio device package. It does not scan the entire website `img/` directory and does not include unrelated logos, tarocchi or user content.

## Fail-closed handling of non-literal sources

The AST extractor now distinguishes **explicitly absent** skin textures
(`texture: null` or a literal empty string) from values that cannot be
resolved statically. An active `texture` or `imgRisuonatoreSolare`
expression such as a function call, concatenation, or template with
interpolations is added to the JSON report as an **unresolved non-literal
reference**. The same applies to a spread/computed item in
`preloadArraySimboli`, or a preload property whose initializer is not
a literal array.

Each diagnostic identifies the `skin` or `preload` origin and its
TypeScript file/line/column without copying the expression's full
source into a report. The report contains `nonLiteralExpressions`, plus
`totalLiteralReferences` and `uniqueLiteralReferences`, which still
count only actual static literals. Even if every currently discovered
host asset exists, the CLI writes the report and exits with **status 2**
without producing a new selection file whenever such expressions are
found.

To resolve a diagnostic, enumerate the real permitted assets explicitly
in the source or create a separately reviewed selection process. Do not
guess paths, disable the guard, move private artwork into this renderer
repository or claim that runtime-generated filenames are complete just
because known static folders were scanned. A static source scan is
still **not a guarantee** that all paths built dynamically by other
renderer modules have been discovered.

## Important limitations

- Runtime-computed filenames and optional renderer paths may not be fully known from a static parse. They can only be proven using fixtures, screen snapshots and real rendering tests. Dynamic assets not within the families above may be missed.
- The code does not calculate usage counts across components, decide if an image is permitted for public redistribution, or establish that each skin is visually correct.
- The candidate list contains paths only; run the separate manifest tool to hash and verify actual bytes.
- The offline Astrolabio packaging/update mechanism is **not yet implemented**. Never deploy asset changes to sold devices without hardware tests and rollback.
- Neither this repository nor the library build should gain copies of host artwork.

## Known issue to investigate

The original upstream skin manager references `risuonatore-solare-bianco.png` in the `dark-bn` and `light-bn` skins, while the original asset tree contains `risuonatore-solare-bn.png`. The owner authorized the independent renderer to use the existing `bn` file; no production source was changed. Appearance still needs comparison against an approved baseline.

## Tests

```bash
npm run test:asset-selection
npm run test:assets
```

The tests use temporary fake images and TypeScript input. They check AST extraction, legacy path normalization, missing assets, and separation from unrelated site files. They do **not** use real VirgoStars images.
