# Astrological Charts

Private collaborative **Angular 20 / TypeScript / Three.js** library extracted from VirgoStars' `grafici-astrologici` code.

**Status:** the stacked draft through [PR #13](https://github.com/Cesare-ml/astrological-charts/pull/13) builds locally after `npm ci`; it is **not visually validated, production-integrated or released**. Earlier PR heads have not independently passed this verification. This repository remains private; no open-source licence or automatic deployments are configured.

## Purpose

Invite known contributors to develop the astrological renderer using Codex, Claude Code and other AI tools. Angular is the official framework; rewriting for React/Vue or an agnostic core is not a current goal.

Source repository: `Cesare-ml/virgo-stars`, subtree `shared/grafici-astrologici/`. Live VirgoStars and Astrolabio continue to use that original source until separately approved.

## Current capability

The imported source includes Three.js rendering of natal charts, transits, synastry and latitude charts, plus browser PNG export. Calculation of planetary positions and interpretation of astrology are not part of the library.

**Important:** The original renderer relies on symbols, fonts and textures from `virgo-stars/public/assets/`. They are not included in this extraction until their rights and packaging are reviewed. Building the TypeScript does not prove visual rendering works.

## Start developing

For the current stacked candidate, check out `feat/verified-asset-preview`. PR #1 and the subsequent branches remain separate draft steps.

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

These commands and `npm run preflight` passed on Windows with Node 22.18.0 against the candidate including the extraction-check fix and lockfile. The localhost tests require loopback access. This verifies the build and asset tooling, not the graphics output. No CI or GitHub Actions is used.

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
- [Asset-only local preview: 78 synthetic PNGs or an approved independent pack](docs/LOCAL_ASSET_PREVIEW.md)
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

## Browser preview of a synthetic asset pack

Before the real images are reviewed/imported, Windows contributors can open a **local gallery of 78 generated checkerboard PNGs** using:

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Then open `http://127.0.0.1:4177/__preview`. This is **only an asset contract smoke test**, not a full astrology chart rendered in Three.js. The script creates original synthetic images in git-ignored `.local/` and serves *only* files verified against the local SHA-256 manifest. See [preview guide](docs/LOCAL_ASSET_PREVIEW.md).
