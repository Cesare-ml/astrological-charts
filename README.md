# Astrological Charts

Publicly readable **Angular 20 / TypeScript / Three.js** collaboration repository extracted from VirgoStars' `grafici-astrologici` code. Public visibility does **not** mean the source has been cleared for open-source reuse.

**Status (GitHub metadata checked 2026-11-10):** this repository is **public** but **not cleared for an open-source release**. No `LICENSE` is committed on `main`, and `package.json` still has `private: true`. Source and third-party redistribution rights require review; visibility alone does not grant reuse rights. Library/demo builds have been reported locally, but original-artwork parity, production integration and Astrolabio compatibility are unverified. No npm release or automatic deployment is configured. See [audit gate #20](https://github.com/Cesare-ml/astrological-charts/issues/20).

## Purpose

Invite known contributors to develop the astrological renderer using Codex, Claude Code and other AI tools. Angular is the official framework; rewriting for React/Vue or an agnostic core is not a current goal.

## Current capability

The imported source includes Three.js rendering of natal charts, transits, synastry and latitude charts, plus browser PNG export. Calculation of planetary positions and interpretation of astrology are not part of the library.

**Important:** The renderer loads images from a host asset root; the library does not bundle them. An owner-authorized image pack is available in the separate, publicly readable [`astrological-assets`](https://github.com/Cesare-ml/astrological-assets) repository, without the original font. Public access and SHA-256 integrity verification do not grant artwork redistribution rights. Building TypeScript does not by itself prove visual correctness.

## Start developing

Clone `main` for the integrated library and synthetic demo. The [PR history](https://github.com/Cesare-ml/astrological-charts/pull/13) records the ordered extraction.

For invited contributors on Windows:

- [Windows quickstart](docs/CONTRIBUTOR_QUICKSTART.md)
- [Agents guide](AGENTS.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Build and dependency policy](docs/BUILD_AND_DEPENDENCIES.md)

```bash
npm ci
npm run verify:angular
```

`verify:angular` runs preflight, the Angular library build, and the Angular demo build in order. A previous Windows validation used Node 22.18.0; that historical result does not validate a new commit. The localhost browser tests require loopback access and must be run separately for Chromium and Firefox. A successful build does not establish visual parity with approved artwork, and no CI or GitHub Actions is used.

For real artwork, clone `Cesare-ml/astrological-assets` as a **sibling** checkout, run `npm run verify:pack` **inside that repository**, and use `npm run demo:assets:repo` here to serve only manifest-approved local files. The manifest includes per-file SHA-256 values; check actual bytes before relying on them. Do not copy images or fonts into this renderer or hotlink the production site.

## Documentation

- [Extraction status](docs/EXTRACTION_STATUS.md)
- [Original source provenance](docs/UPSTREAM_PROVENANCE.md)
- [Rendering architecture](docs/ARCHITECTURE.md)
- [Graphics asset audit](docs/ASSETS_AUDIT.md)
- [Shared host-owned assets and canonical URLs](docs/SHARED_ASSET_ARCHITECTURE.md)
- [Deterministic asset manifest and offline version comparison](docs/ASSET_MANIFEST.md)
- [Derive the chart-only asset inventory from active TypeScript](docs/ASSET_SELECTION_AUTOMATION.md)
- [Independent contributor asset access and separate asset repository](docs/INDEPENDENT_ASSETS_REPOSITORY.md)
- [Three-repository integration checkpoint, release gates and open blockers](docs/MULTIREPO_INTEGRATION_CHECKPOINT.md)
- [Asset-only local preview: 78 synthetic PNGs or an approved independent pack](docs/LOCAL_ASSET_PREVIEW.md)
- [Angular renderer demo and browser tests](docs/ANGULAR_DEMO.md)
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

For the interactive renderer demo, including all four modes and seven selectable skins, follow [the Angular demo guide](docs/ANGULAR_DEMO.md). It uses locally generated placeholder assets; visual compatibility with the original artwork has not been verified.

Before the real images are reviewed/imported, Windows contributors can open a **local gallery of 78 generated checkerboard PNGs** using:

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Then open `http://127.0.0.1:4177/__preview`. This is **only an asset contract smoke test**, not a full astrology chart rendered in Three.js. The script creates original synthetic images in git-ignored `.local/` and serves *only* files verified against the local SHA-256 manifest. See [preview guide](docs/LOCAL_ASSET_PREVIEW.md).
