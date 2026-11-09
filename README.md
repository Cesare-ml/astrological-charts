# Astrological Charts

Private, collaborative Angular/TypeScript/Three.js library for rendering astrological charts, extracted from VirgoStars.

> **Status: extraction workspace / NOT released.** This repository is private. Its code is **not** yet the source of truth for the live VirgoStars website or any deployed Astrolabio. No automatic deployment or publication is configured.

## Purpose

Preserve and develop the existing `grafici-astrologici` rendering library with invited contributors and AI coding agents. **Angular remains the official integration target**. A rewrite for other frameworks is explicitly out of scope.

Original source: `Cesare-ml/virgo-stars/shared/grafici-astrologici/` on branch `master`.

## Source and safety

- Treat `src/` as the extracted library source, not a new implementation.
- Do **not** copy the VirgoStars backend, user data, credentials, `.env`, deployment files, or complete monorepo history here.
- Do **not** copy proprietary imagery, fonts, or third-party assets without verifying redistribution rights.
- The original VirgoStars repository remains the active production source until a separate verified integration.
- All contributions through feature branches and pull requests; no direct production changes.
- This private repository is **not yet licensed for public redistribution**. Contributors should agree on terms before making external contributions.

## Project entry points

- [AGENTS.md](AGENTS.md) — instructions for humans and AI coding assistants
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow and review criteria
- [docs/EXTRACTION_STATUS.md](docs/EXTRACTION_STATUS.md) — migration state and verification gates
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — rendering architecture and consumers

## Current library

The imported code renders natal charts, transit overlays, synastry, and latitude views with Three.js, and supports offscreen PNG rendering. Astro calculation and interpretation remain outside this library.

The original monorepo also contains required visual assets under `public/assets/`. These must be reviewed and intentionally packaged or resolved; a successful TypeScript compilation alone does not prove the renderer works.

## Local commands

Once the source and tooling are committed:

```bash
npm install
npm run build
```

Do not assume these commands pass until validated in a clean checkout. See `docs/EXTRACTION_STATUS.md`.

## Goals

1. Obtain a buildable isolated Angular package with reproducible dependencies.
2. Add fixture-based and visual regression tests.
3. Provide a safe local demo using only synthetic example chart data.
4. Agree on asset licensing and resolve needed paths.
5. Add controlled versioning and integration back into VirgoStars / Astrolabio.
