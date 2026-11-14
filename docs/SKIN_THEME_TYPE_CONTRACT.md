# Chart skin/type parity

The renderer's `SkinManager.skins` registry contains seven themes: `dark`, `dark-bn`, `light`, `light-bn`, `sun`, `astrolabio`, and `astrolabio-girasole`. Previously, the public `OpzioniGrafico.temaGrafico` TypeScript alias omitted `astrolabio-girasole` even though the renderer already registered that skin.

This patch adds the missing literal to the `TemaGrafico` union. It does **not** change `Settaggi.skin_id`, any skin asset path, angular render code, defaults, existing themes, geometry, animation, pointer focus, zoom, or PNG export. No new art is copied or bundled.

## Important: UI theme field vs actual renderer skin

The TypeScript `OpzioniGrafico.temaGrafico` field is a UI/configuration selection; it does **not** automatically update `opzioni.settaggi.skin_id`. Existing renderer modules select `SkinManager.skins[opzioni.settaggi.skin_id]`. Callers that want both values aligned must explicitly assign both:

```ts
opzioni.temaGrafico = 'astrolabio-girasole';
opzioni.settaggi.skin_id = 'astrolabio-girasole';
```

`Settaggi.skin_id` intentionally remains typed as `string` in this patch for backwards compatibility with stored settings. The type addition alone does not validate the runtime value, synchronize these two fields, or guarantee host-owned assets are available. The separate [PR #95](https://github.com/Cesare-ml/astrological-charts/pull/95) covers the richer skin schema/path regression contract; this PR focuses on the public type and defaults.


## Regression contract

`npm run test:skin-theme-types` uses the TypeScript parser and semantic checker to check that:
1. `TemaGrafico` contains exactly one literal for each theme in `SkinManager.skins`, including `astrolabio-girasole`.
2. The public `OpzioniGrafico.temaGrafico` property remains required and typed as `TemaGrafico` rather than a wide `string` or `any`.
3. The default `temaGrafico` refers to a registered theme.
4. Both the `Settaggi.skin_id` class initializer and the persisted `settaggiDefault.skin_id` refer to the same registered skin.
5. The TypeScript compiler accepts `astrolabio-girasole` through the **actual public property signature** and rejects an unknown skin with diagnostic TS2322.

The test is also included in `npm run preflight`. A standalone semantic checker probe of the extracted `TemaGrafico` union passed under Node.js 22.16.0 and TypeScript 5.8.3 (accepted the real `astrolabio-girasole` literal; rejected `invalid-chart-skin` with TS2322). The full committed Node suite and Angular/WebGL build have not run in this environment. This is a source/type-contract regression, not proof of WebGL pixels, production asset rights, skin art parity or Astrolabio hardware compatibility.

## Required validation before merge

- `npm ci` (Node 22), `npm run test:skin-theme-types`, `npm run verify:angular`
- For graphical sign-off, compare all seven skins in Chromium and Firefox using the independently approved asset pack and inspect PNG export, including the `astrolabio-girasole` preset
- Recheck the public release/rights audit before any redistribution, deploy or consumer migration

**Compatibility:** additive type-only correction; existing VirgoStars/Astrolabio runtime output remains unchanged. Rollback by reverting this PR. AI-assisted; maintainer review required.
