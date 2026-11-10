# Extraction status and release gates

**Phase:** PRIVATE SOURCE EXTRACTED; isolated build verified, rendering and consumers unverified, not published or production-integrated.

## Imported in this PR

- 25 TypeScript source files from `shared/grafici-astrologici/src/`; `renderers/_old` intentionally excluded.
- Angular 20 / Three.js / TypeScript library workspace and initial package metadata.
- Minimal fixes for three imports from the package into itself (converted to relative imports).
- Contributor instructions, PR template and upstream technical reference snapshots.
- Extraction source-integrity script (`npm run check:extraction`); this **does not** test the renderer.

## Pending before describing the package as ready

- Repeat the locked installation and build on supported contributor environments and verify rendering.
- Align `TemaRender` and `OpzioniGrafico` input contracts with actual renderer use.
- Audit symbol/texture/font/resonator asset rights. Keep the single authoritative source in `virgo-stars/public/assets`; plan an asset manifest for web/Astrolabio and a private demo without duplicating production artwork.
- Add synthetic chart fixtures and visual snapshots for natal, synastry, transits and latitudes.
- Verify no resource growth after repeated redraw and PNG export.
- Rebuild VirgoStars web, mobile PNG, Astrolabio UI and actual headless/e-ink render before any consumer migration.
- Decide strategy for version pinning and release notes; **no automatic updates to shipped devices**.
- Agree on contributor IP terms before accepting outside contributions or making any public release.

## Deliberately not done

- No backend, account database, user data, `.env` or deployment infrastructure imported.
- No historical Git repository clone or legacy renderer copies.
- No production skin assets or fonts copied; instead, `resolveChartAssetUrl` and `GestoreImmagini.configurePublicAssetsBase` provide a host-owned URL contract. Browser URL tests have been added but full WebGL and site/hardware integration have not been validated.
- No public license; no GitHub Actions; no auto-deploy; no npm publishing.
- No browser, visual or production-consumer compatibility is implied by the isolated build.

## Rollback policy

Until explicit sign-off, production continues using `shared/grafici-astrologici` in VirgoStars; reverting a branch or closing a PR in this repository cannot affect the live service.
