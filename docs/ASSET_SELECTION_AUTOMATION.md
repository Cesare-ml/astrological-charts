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

**When a skin requires an image that does not exist, the program writes the diagnostic report and exits with code 2 without writing a new selection file.** If there is a prior selection file from an earlier run, delete or rename it before rerunning; never treat it as current after a failed check.

## How assets are chosen

The script parses the *active* TypeScript AST (comments excluded) for `SkinManager.skins`'s `texture` and `imgRisuonatoreSolare` values, and for `GestoreImmagini.preloadArraySimboli`. All these literals must exist in the real host asset root or the command fails.

It also inventories files from these known chart-only directories, preserving existing filename casing:

- `img/simboli-bianchi`
- `img/simboli/case`, `img/simboli/elementi-celesti`, `img/simboli/elementi`, `img/simboli/segni`
- `img/grafici`
- `img/textures`

Therefore the output is intentionally a **conservative chart asset superset**, not an ideal or minimal Astrolabio device package. It does not scan the entire website `img/` directory and does not include unrelated logos, tarocchi or user content.

## Important limitations

- Runtime-computed filenames and optional renderer paths may not be fully known from a static parse. They can only be proven using fixtures, screen snapshots and real rendering tests. Dynamic assets not within the families above may be missed.
- The code does not calculate usage counts across components, decide if an image is permitted for public redistribution, or establish that each skin is visually correct.
- The candidate list contains paths only; run the separate manifest tool to hash and verify actual bytes.
- The offline Astrolabio packaging/update mechanism is **not yet implemented**. Never deploy asset changes to sold devices without hardware tests and rollback.
- Neither this repository nor the library build should gain copies of host artwork.

## Known issue to investigate

The original skin manager references `risuonatore-solare-bianco.png` in at least the `dark-bn` and `light-bn` skins, while the GitHub listing of the existing `public/assets/img` directory shows `risuonatore-solare-bn.png`. The tool should flag this on the real checkout. Do not automatically substitute the file name without comparing the artwork, permissions, expected effects and existing production rendering.

## Tests

```bash
npm run test:asset-selection
npm run test:assets
```

The tests use temporary fake images and TypeScript input. They check AST extraction, legacy path normalization, missing assets, and separation from unrelated site files. They do **not** use real VirgoStars images.
