# Astrological Charts

Publicly readable **Angular 20 / TypeScript / Three.js** collaboration repository extracted from VirgoStars' `grafici-astrologici` code. Public visibility does **not** mean the source has been cleared for open-source reuse.

**Status (GitHub metadata checked 2026-11-10):** this repository is **public** but **not cleared for an open-source release**. No `LICENSE` is committed on `main`, and `package.json` still has `private: true`. Source and third-party redistribution rights require review; visibility alone does not grant reuse rights. Library/demo builds have been reported locally, but original-artwork parity, production integration and Astrolabio compatibility are unverified. No npm release or automatic deployment is configured. See [audit gate #20](https://github.com/Cesare-ml/astrological-charts/issues/20).

## Purpose

Invite known contributors to develop the astrological renderer using Codex, Claude Code and other AI tools. Angular is the official framework; rewriting for React/Vue or an agnostic core is not a current goal.

## Current capability

The imported source includes Three.js rendering of natal charts, transits, synastry and latitude charts, plus browser PNG export. Calculation of planetary positions and interpretation of astrology are not part of the library.

Celestial glyphs use a collision-aware layout: isolated natal planets and roomy two-body pairs are larger and sit farther inward from the signs, while genuinely crowded conjunctions retain equal-size compact symbols on one or, only where crowded, two fixed-radius tracks, within ±5° of their true longitude. A three-body knot tries to keep two symbols by the zodiac before moving one toward the houses. Extremely dense, geometrically impossible clusters still have a collision-safe adaptive fallback. The lighter-gray outward connector marks the true degree; a short independent tick **touches the outer house boundary** without intruding into the house-number ring and marks that longitude without a spoke from glyph to house. Degree badges are checked geometrically against **all house ticks** to prevent overlap. `mostraGradiElementiCelesti` (default `true`) shows **only the integer sign degree** inward of each planet. The natal house/aspect wheel is slightly smaller to leave room for the planets. The external one-degree scale appears **only when transits are enabled** (on every skin); true-degree aspect-endpoint dots remain shared by all skins. Shorter ASC and MC shafts have reference-proportioned open V arrowheads; bold Times-like canvas headings use the correct texture aspect ratio to avoid horizontally compressed letters (ASC then degrees below; MC degrees then heading above the arrow). **DS** and IC do not repeat their opposite degrees; both are closer to their circular terminal discs. The planetary-hour glyph is centred above the ASC heading; the optional MC direction triangle is midway between the sign ring and the arrowhead base. See [symbol layout and integration notes](docs/PLANET_SYMBOL_LAYOUT.md).

The new default `virgostars` skin provides the official pastel zodiac, subtle wheel background and coordinated axis colors. Geometry, angular references and collision rules are shared by **all eight selectable skins**, including the seven previous skins. See [official skin and layout specification](docs/VIRGOSTARS_OFFICIAL_SKIN.md).

In transit charts, planetary glyphs prefer an orbit just beyond the external
degree grid, each with a translucent line anchored to its true longitude; the
four axis strokes remain visible but their textual annotations are hidden.
The overlaid natal planet band keeps full-size glyphs and house/planet spacing.
In synastry, the shorter planet-band edge no longer displaces true-degree house
ticks, which now physically touch the actual house ring.

**Important:** The renderer loads images from a host asset root; the library does not bundle them. A private owner-authorized image pack is available separately in `astrological-assets`, without the unknown-license font. Building TypeScript does not by itself prove visual correctness.

## Start developing

Clone `main` for the integrated library and synthetic demo. The [PR history](https://github.com/Cesare-ml/astrological-charts/pull/13) records the ordered extraction.

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

These commands and `npm run preflight` passed on Windows with Node 22.18.0. The localhost tests require loopback access. They verify the build and asset tooling; separate synthetic browser tests exercise rendering without validating original artwork. No CI or GitHub Actions is used.

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
- [Angular renderer demo and browser tests](docs/ANGULAR_DEMO.md)
- [Official VirgoStars skin and shared geometry](docs/VIRGOSTARS_OFFICIAL_SKIN.md)
- [Opt-in natal planet hover API](docs/NATAL_PLANET_HOVER.md)
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

For the interactive renderer demo, including all four modes and eight selectable skins, follow [the Angular demo guide](docs/ANGULAR_DEMO.md). It uses locally generated placeholder assets; visual compatibility with the original artwork has not been verified.

Before the real images are reviewed/imported, Windows contributors can open a **local gallery of 78 generated checkerboard PNGs** using:

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Then open `http://127.0.0.1:4177/__preview`. This is **only an asset contract smoke test**, not a full astrology chart rendered in Three.js. The script creates original synthetic images in git-ignored `.local/` and serves *only* files verified against the local SHA-256 manifest. See [preview guide](docs/LOCAL_ASSET_PREVIEW.md).
