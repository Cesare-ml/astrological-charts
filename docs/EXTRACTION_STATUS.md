# Extraction status and release gates

**Phase (checked 2026-11-10): GitHub PUBLIC; source license/public-release audit NOT COMPLETED.** `main` has no `LICENSE`, and the npm package remains `private: true`. Angular build and browser tests were reported locally on Windows using synthetic and owner-authorized original images. Visual parity and production consumers remain unverified. Public visibility should be reviewed against source, third-party dependency and Git-history rights; see [audit gate #20](https://github.com/Cesare-ml/astrological-charts/issues/20).

## Extraction and current implementation

- 25 TypeScript source files from `shared/grafici-astrologici/src/`; `renderers/_old` intentionally excluded.
- Angular 20 / Three.js / TypeScript library workspace and initial package metadata.
- Minimal fixes for three imports from the package into itself (converted to relative imports).
- Contributor instructions, PR template and upstream technical reference snapshots.
- Extraction source-integrity script (`npm run check:extraction`); this **does not** test the renderer.
- An independent Angular demo renders natal, transit, synastry and latitude fixtures with seven selectable skins and PNG export using locally generated placeholder assets.
- Browser smoke tests exercise Chromium and Firefox with both synthetic and private original images; the separate Firefox offline test uses local synthetic files and does not exercise the shipped Astrolabio adapter.
- The extraction and downstream PRs were integrated in order after their local preflight and build checks. The extracted #1 renderer also passed a synthetic browser smoke test; those checks do not establish original-artwork fidelity.

## Pending before describing the package as ready

- Align `TemaRender` and `OpzioniGrafico` input contracts with actual renderer use.
- The owner authorized private sharing of imported artwork, including font-derived images; the font's license and public redistribution remain unresolved. Keep the current production source unchanged and validate the separate pack before any migration.
- Compare the four chart modes and seven skins against approved real-artwork baselines; synthetic screenshots alone do not establish visual fidelity.
- Verify no resource growth after repeated redraw and PNG export.
- Rebuild VirgoStars web, mobile PNG, Astrolabio UI and actual headless/e-ink render before any consumer migration.
- Decide strategy for version pinning and release notes; **no automatic updates to shipped devices**.
- Agree on contributor IP terms before accepting outside contributions or making any public release.

## Deliberately not done

- No backend, account database, user data, `.env` or deployment infrastructure imported.
- No historical Git repository clone or legacy renderer copies.
- No production skin assets or fonts copied; instead, `resolveChartAssetUrl` and `GestoreImmagini.configurePublicAssetsBase` provide a host-owned URL contract. Synthetic WebGL tests do not validate site or hardware integration.
- No public license; no GitHub Actions; no auto-deploy; no npm publishing.
- Local browser and offline smoke results do not establish production-consumer, visual-baseline or device compatibility.

## Rollback policy

Until explicit sign-off, production continues using `shared/grafici-astrologici` in VirgoStars; reverting a branch or closing a PR in this repository cannot affect the live service.

## Public API barrel regression guard

The public package entry point `src/public-api.ts` must retain its established
renderer, model and asset URL re-exports without repeating a module path.
`tests/public-api-surface.test.mjs` checks both invariants and runs as part of
`npm run test:extraction` (included in `npm run preflight`).

Run this focused, dependency-free test with
`node --test tests/public-api-surface.test.mjs`. The check is a static
entry-point contract smoke test; it does **not** substitute for TypeScript
compilation, Angular/browser builds, visual parity, production integration or
source-rights approval.
