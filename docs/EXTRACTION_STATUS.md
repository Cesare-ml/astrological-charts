# Extraction status and release gates

**Phase:** INITIAL PRIVATE CODE EXTRACTION, not published and not production-integrated.

## Intended contents

- Active TypeScript source only from `shared/grafici-astrologici/src/` (legacy `renderers/_old` intentionally excluded).
- Angular-compatible library packaging.
- Contributor and AI agent instructions.
- Architectural reference and open issues.

## Pending before describing the package as ready

- Run clean `npm install` and `npm run build`; review any new transitive dependency assumptions.
- Remove self-imports from `grafici-astrologici` internals while keeping the external import name.
- Align `TemaRender` and `OpzioniGrafico` input contracts with actual renderer use.
- Audit symbol/texture/font/resonator asset rights, establish a manifest and private local demo assets.
- Add a synthetic chart fixture and visual snapshots for natal, synastry, transits and latitudes.
- Verify no resource growth after repeated redraw and PNG export.
- Rebuild website, mobile PNG, Astrolabio UI and actual headless/e-ink render before any consumer migration.
- Decide strategy for version pinning and release notes; **no automatic updates to shipped devices**.
- Agree on contributor IP terms before accepting outside contributions or making any public release.

## Deliberately not done

- No backend, account database, user data, `.env` or deployment infrastructure imported.
- No historical Git repository clone or legacy renderer copies.
- No public license; no GitHub Actions; no auto-deploy; no npm publishing.

## Rollback policy

Until explicit sign-off, production continues using `shared/grafici-astrologici` in VirgoStars; reverting a branch or closing a PR in this repository cannot affect the live service.
