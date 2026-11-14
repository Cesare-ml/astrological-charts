# Chart skin/type parity

The renderer's `SkinManager.skins` registry contains seven themes: `dark`, `dark-bn`, `light`, `light-bn`, `sun`, `astrolabio`, and `astrolabio-girasole`. Previously, the public `OpzioniGrafico.temaGrafico` TypeScript alias omitted `astrolabio-girasole` even though the renderer already registered that skin.

This patch adds the missing literal to the `TemaGrafico` union. It does **not** change `Settaggi.skin_id`, any skin asset path, angular render code, defaults, existing themes, geometry, animation, pointer focus, zoom, or PNG export. No new art is copied or bundled.

## Regression contract

`npm run test:skin-theme-types` uses the TypeScript parser to check that:
1. `TemaGrafico` contains exactly one literal for each theme in `SkinManager.skins`, including `astrolabio-girasole`.
2. Every registered theme defines the shared chart sections required by the renderer.
3. The default `temaGrafico` refers to a registered theme.

The test is also included in `npm run preflight`. This is a source/type-contract regression, not proof of WebGL pixels, production asset rights, skin art parity or Astrolabio hardware compatibility.

## Required validation before merge

- `npm ci` (Node 22), `npm run test:skin-theme-types`, `npm run verify:angular`
- For graphical sign-off, compare all seven skins in Chromium and Firefox using the independently approved asset pack and inspect PNG export, including the `astrolabio-girasole` preset
- Recheck the public release/rights audit before any redistribution, deploy or consumer migration

**Compatibility:** additive type-only correction; existing VirgoStars/Astrolabio runtime output remains unchanged. Rollback by reverting this PR. AI-assisted; maintainer review required.
