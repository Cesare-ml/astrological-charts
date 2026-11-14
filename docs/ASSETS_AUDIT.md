> Decision update: production assets remain owned by `virgo-stars/public/assets/`; the renderer package must not copy them. See [SHARED_ASSET_ARCHITECTURE.md](SHARED_ASSET_ARCHITECTURE.md) for the canonical URL resolver, browser/HTML caching, development demos, and offline Astrolabio strategy.

# Asset audit — private chart renderer

**Status: inventory only.** No third-party art, fonts, symbols, textures or user content were copied into the new repository. All redistribution permissions remain **unverified**.

## Why this matters

The original library refers to `virgo-stars/public/assets/`, whereas this extracted package currently includes only TypeScript source. The code can potentially build but **cannot be claimed render-ready** until references resolve. For example, `OggettiSempliciRender.getMaterial()` prepends `../../../assets/img/`; other callers use `assets/img/` or `/assets/img/`. The Astrolabio headless renderer uses a custom resolver.

## Inventory based on the actual renderer code

| Category | Representative source | Reference pattern | Rights |
|---|---|---|---|
| Zodiac glyphs | `segni.renderer.ts` | `simboli-bianchi/segni/{01..12}.png` | Unverified |
| House numbers | `case.renderer.ts` | `simboli-bianchi/case/{01..12}.png` | Unverified |
| Body glyphs + retrograde variants | `elementi-celesti.renderer.ts` | `simboli-bianchi/elementi-celesti/{name}[-r].png` | Unverified |
| Skin-specific body glyphs | `elementi-celesti.renderer.ts` | `simboli/elementi-celesti/{skin}/cerchio/{name}.png` | Unverified |
| Decans and terms | `segni.renderer.ts` / `case.renderer.ts` | `simboli/elementi/{skin}/875x605/*.png` | Unverified |
| House variants and ring art | `case.renderer.ts` | `simboli/case/{skin}/725x460/*.png` / `grafici/{skin}/*.png` | Unverified |
| Resonator artwork | `@skin-manager.ts` | `risuonatore-solare-*.png` | Owner rights verification needed |
| Gold/sky/other textures | `@skin-manager.ts` | `assets/img/textures/*.{jpg,webp}` | Unverified — some external stock URLs exist in comments |
| Font assets | `oggetti-semplici.renderer.ts` | `assets/fonts/{fontFilename}` | Unverified |

Current skin names from the original manager: `dark`, `dark-bn`, `light`, `light-bn`, `sun`, `astrolabio`, `astrolabio-girasole`.

The table includes representative families, not an exhaustive declaration of every runtime path. Dynamic references must be expanded against actual skin and body catalogs to generate a full manifest.

## Static inventory command

```bash
npm run check:assets
node scripts/inventory-assets.mjs --json
```

It scans asset-related lines in the extracted source. TypeScript comments are
masked without changing original line numbers, and live code on the same line
as a comment is still reported. Literal URLs, regular expressions and
interpolated template strings are left intact. Use
`node --test tests/asset-inventory-comments.test.mjs` for this scanner's
regression tests.

This inventory is **line-oriented and heuristic**: it does not guarantee
complete runtime coverage, resolve dynamic paths, fetch/copy assets, confirm
file existence or check copyright. Use
`scripts/derive-chart-asset-selection.mjs` for the AST-based candidate
selection and the approved-pack manifest integrity gates before integration.

## Release requirements

1. Identify each referenced file and its original author/licence; record source and permitted redistribution.
2. Explicitly approve in-repository copies **only** if compatible with the intended private/public distribution.
3. Make a single asset resolver (browser/headless) without changes to production paths.
4. Generate an asset manifest with IDs/checksums and error handling for missing essentials.
5. Test all seven skins and active natal/transits/synastry/latitude modes against the manifest.
6. Treat original Risuonatore Solare art and branded skins as separate from generic astrological symbols when assessing any future open-source release.

Do not infer ownership simply because an image is already inside the private VirgoStars repository.
