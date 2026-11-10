# Astrological Charts

Private collaborative **Angular 20 / TypeScript / Three.js** library extracted from VirgoStars' `grafici-astrologici` code.

**Status:** the isolated extraction builds locally; it is **not visually validated, production-integrated or released**. This repository remains private; no open-source licence or automatic deployments are configured.

## Purpose

Invite known contributors to develop the astrological renderer using Codex, Claude Code and other AI tools. Angular is the official framework; rewriting for React/Vue or an agnostic core is not a current goal.

Source repository: `Cesare-ml/virgo-stars`, subtree `shared/grafici-astrologici/`. Live VirgoStars and Astrolabio continue to use that original source until separately approved.

## Current capability

The imported source includes Three.js rendering of natal charts, transits, synastry and latitude charts, plus browser PNG export. Calculation of planetary positions and interpretation of astrology are not part of the library.

**Important:** The original renderer relies on symbols, fonts and textures from `virgo-stars/public/assets/`. They are not included in this extraction until their rights and packaging are reviewed. Building the TypeScript does not prove visual rendering works.

## Start developing

The extracted source is on `feat/import-virgostars-graphics` while PR #1 is in draft.

For invited contributors on Windows:

- [Windows quickstart](docs/CONTRIBUTOR_QUICKSTART.md)
- [Agents guide](AGENTS.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Build and dependency policy](docs/BUILD_AND_DEPENDENCIES.md)

```bash
npm ci
npm run check:extraction
npm run check:assets
npm run check:types
npm run build
```

On Windows with Node 22.18.0, `npm ci`, `npm run preflight` and `npm run build` passed on the extraction candidate. Browser and consumer compatibility require separate tests. No CI or GitHub Actions is used.

## Documentation

- [Extraction status](docs/EXTRACTION_STATUS.md)
- [Original source provenance](docs/UPSTREAM_PROVENANCE.md)
- [Rendering architecture](docs/ARCHITECTURE.md)
- [Graphics asset audit](docs/ASSETS_AUDIT.md)
- [Shared host-owned assets and canonical URLs](docs/SHARED_ASSET_ARCHITECTURE.md)
- [Deterministic asset manifest and offline version comparison](docs/ASSET_MANIFEST.md)
- [Derive the chart-only asset inventory from active TypeScript](docs/ASSET_SELECTION_AUTOMATION.md)
- [Independent contributor asset access and proposed private asset repository](docs/INDEPENDENT_ASSETS_REPOSITORY.md)
- [Three-repository integration checkpoint, release gates and open blockers](docs/MULTIREPO_INTEGRATION_CHECKPOINT.md)
- [Integration plan — not active](docs/INTEGRATION_PLAN.md)
- [Technical reference snapshots](docs/reference/README.md)

## Project roadmap

- [#2: isolated Angular build](https://github.com/Cesare-ml/astrological-charts/issues/2)
- [#3: assets and rights](https://github.com/Cesare-ml/astrological-charts/issues/3)
- [#4: synthetic fixtures and visual regression](https://github.com/Cesare-ml/astrological-charts/issues/4)
- [#5: WebGL lifecycle](https://github.com/Cesare-ml/astrological-charts/issues/5)
- [#6: private Angular demo](https://github.com/Cesare-ml/astrological-charts/issues/6)
- [#7: controlled integration into VirgoStars/Astrolabio](https://github.com/Cesare-ml/astrological-charts/issues/7)

## Rules

Work on feature branches and submit pull requests. No production changes, AWS access, real users' birth data, unlicensed artwork, automatic deployment or publication. The maintainer approves compatibility and release decisions.
