# Extraction status and release gates

**Phase:** PRIVATE SOURCE EXTRACTED ON A FEATURE BRANCH; unverified build, not published and not production-integrated.

## Imported in this PR

- 25 TypeScript source files from `shared/grafici-astrologici/src/`; `renderers/_old` intentionally excluded.
- Angular 20 / Three.js / TypeScript library workspace and initial package metadata.
- Minimal fixes for three imports from the package into itself (converted to relative imports).
- Contributor instructions, PR template and upstream technical reference snapshots.
- Extraction source-integrity script (`npm run check:extraction`); this **does not** test the renderer.

## Pending before describing the package as ready

- Run clean `npm install`, `npm run check:extraction` and `npm run build` and correct any failures.
- Align `TemaRender` and `OpzioniGrafico` input contracts with actual renderer use.
- Audit symbol/texture/font/resonator asset rights, establish a manifest and private local demo assets.
- Add synthetic chart fixtures and visual snapshots for natal, synastry, transits and latitudes.
- Verify no resource growth after repeated redraw and PNG export.
- Rebuild VirgoStars web, mobile PNG, Astrolabio UI and actual headless/e-ink render before any consumer migration.
- Decide strategy for version pinning and release notes; **no automatic updates to shipped devices**.
- Agree on contributor IP terms before accepting outside contributions or making any public release.

## Deliberately not done

- No backend, account database, user data, `.env` or deployment infrastructure imported.
- No historical Git repository clone or legacy renderer copies.
- No production skin assets or fonts copied yet: asset paths are still external dependencies.
- No public license; no GitHub Actions; no auto-deploy; no npm publishing.
- No build/test execution has been claimed for the extracted code.

## Rollback policy

Until explicit sign-off, production continues using `shared/grafici-astrologici` in VirgoStars; reverting a branch or closing a PR in this repository cannot affect the live service.
