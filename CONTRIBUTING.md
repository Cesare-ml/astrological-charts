# Contributing to Astrological Charts

This repository is currently **publicly readable**, but release rights and open-source licensing on `main` remain unresolved. Public visibility alone does not authorize reuse, relicensing or redistribution. Contributions with Codex, Claude Code, or other AI tools are welcome. The maintainer retains final review and merge control.

## Workflow

1. Create a feature branch from `main`, named `feat/...`, `fix/...` or `docs/...`.
2. Read `AGENTS.md` and current extraction status before modifying code.
3. Use synthetic fixture data, never real VirgoStars users' natal charts or credentials.
4. Make a focused change and add geometric/visual tests where possible.
5. On a clean checkout, use the lockfile with `npm ci`, then run `npm run verify:angular` (which runs preflight, library build and demo build in that order). For rendering changes, also run the Chromium and Firefox browser suites with the locally generated synthetic asset pack, as described in `docs/ANGULAR_DEMO.md`. Use only the separate approved `astrological-assets` checkout and its SHA-256 manifest for real images; never copy those assets into this repository.
6. Record the tested commit SHA, Node/npm and browser versions, and each command's PASS, FAIL or NOT RUN status (including exit codes). A passing preflight does not imply Angular builds, browser rendering, visual parity or licensing approval.
7. Open a PR with scope, screenshots for rendering changes, test results, risks, and effects on website/Astrolabio.
8. Wait for maintainer approval. Do not merge or deploy without authorization.

## AI-assisted changes

AI-assisted contributions are welcome, but their author is responsible for reviewing generated code, licensing, security and correctness. Avoid full-repo rewriting agents that modify unrelated code. Never submit prompts or logs containing private data.

## Public release and intellectual property

The GitHub repository is already public, but has no open-source `LICENSE` on `main` and has not passed the source-rights/public-release gate. Do not publish packages, change the license or redistribute third-party artwork on the assumption that public GitHub visibility is sufficient. Before accepting external contributions, establish written permission/terms allowing VirgoStars to use, modify, commercially distribute, and potentially open-source accepted contributions in future. Each contributor confirms they have the right to contribute their work and that new assets are properly licensed.

## Review gates

- correct layers, positions, symbols, house cusps, aspects and rotation;
- changes documented in public inputs/options;
- no regressions to natal, transits, synastry or latitude modes;
- no GPU resource leaks or abandoned animation timelines;
- no breaking asset paths for headless Astrolabio;
- no impact on live VirgoStars without separate reviewed integration.
